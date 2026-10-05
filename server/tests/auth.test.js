import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { startApp, makeUser, getOutbox, clearOutbox, PASSWORD, tokenFor } from './helpers.js'
import User from '../src/models/User.js'
import Profile from '../src/models/Profile.js'
import LPAMembership from '../src/models/LPAMembership.js'
import { createLimiters } from '../src/middleware/security.js'

let ctx
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await ctx.stop() })

const codeFrom = (mail) => mail.text.match(/\b(\d{6})\b/)[1]

describe('sign up and email verification', () => {
  const email = 'newmember@example.test'

  it('rejects a weak password with a clear reason', async () => {
    const res = await ctx.api.post('/api/auth/signup').send({ email, password: 'password' })
    expect(res.status).toBe(400)
    expect(res.body.errors.length).toBeGreaterThan(0)
  })

  it('rejects an invalid email address', async () => {
    const res = await ctx.api.post('/api/auth/signup').send({ email: 'not-an-email', password: PASSWORD })
    expect(res.status).toBe(400)
  })

  it('creates the account, requires verification and emails a 6-digit code', async () => {
    clearOutbox()
    const res = await ctx.api.post('/api/auth/signup').send({ email, password: PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.requiresVerification).toBe(true)
    expect(res.body.token).toBeTruthy()

    const user = await User.findOne({ email })
    expect(user.email_verified).toBe(false)
    expect(user.password).not.toBe(PASSWORD) // stored hashed
    expect(await Profile.findOne({ user_id: user._id.toString() })).toBeTruthy()

    const mail = getOutbox().find((m) => m.to === email)
    expect(mail.subject).toMatch(/verify/i)
    expect(codeFrom(mail)).toBe(user.verification_code)
  })

  it('refuses a duplicate email', async () => {
    const res = await ctx.api.post('/api/auth/signup').send({ email, password: PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already registered/i)
  })

  it('rejects a wrong code and accepts the right one', async () => {
    const wrong = await ctx.api.post('/api/auth/verify-email').send({ email, code: '000000' })
    expect(wrong.status).toBe(400)

    const code = codeFrom(getOutbox().find((m) => m.to === email))
    const right = await ctx.api.post('/api/auth/verify-email').send({ email, code })
    expect(right.status).toBe(200)
    expect((await User.findOne({ email })).email_verified).toBe(true)
  })

  it('rejects an expired code', async () => {
    const res = await ctx.api.post('/api/auth/signup').send({ email: 'slow@example.test', password: PASSWORD })
    expect(res.status).toBe(201)
    const user = await User.findOne({ email: 'slow@example.test' })
    user.verification_code_expires = new Date(Date.now() - 1000)
    await user.save()
    const verify = await ctx.api.post('/api/auth/verify-email').send({ email: 'slow@example.test', code: user.verification_code })
    expect(verify.status).toBe(400)
    expect(verify.body.message).toMatch(/expired/i)
  })

  it('resends a fresh code, and answers the same for unknown addresses', async () => {
    clearOutbox()
    const known = await ctx.api.post('/api/auth/resend-verification').send({ email: 'slow@example.test' })
    const unknown = await ctx.api.post('/api/auth/resend-verification').send({ email: 'nobody@example.test' })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(unknown.body).toEqual(known.body)
    expect(getOutbox().filter((m) => m.to === 'slow@example.test')).toHaveLength(1)
    expect(getOutbox().filter((m) => m.to === 'nobody@example.test')).toHaveLength(0)
  })

  it('does not reveal whether an address has an account when verifying', async () => {
    const res = await ctx.api.post('/api/auth/verify-email').send({ email: 'nobody@example.test', code: '123456' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid verification code')
  })
})

describe('log in', () => {
  it('signs in and returns the member without secrets or moderation records', async () => {
    const member = await makeUser()
    member.user.admin_notes.push({ content: 'private note', admin: 'admin@example.test' })
    await member.user.save()
    const res = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.id).toBe(member.id)
    for (const secret of ['password', 'verification_code', 'password_reset_token', 'admin_notes', 'moderation_history']) {
      expect(res.body.user).not.toHaveProperty(secret)
    }
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const member = await makeUser()
    const wrong = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: 'Wrong-Pass-1!' })
    const unknown = await ctx.api.post('/api/auth/login').send({ email: 'ghost@example.test', password: PASSWORD })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.message).toBe(unknown.body.message)
  })

  it('rejects a NoSQL-injection style body', async () => {
    const res = await ctx.api.post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } })
    expect(res.status).toBe(400)
  })

  it.each([
    ['banned', { is_banned: true }],
    ['suspended', { is_suspended: true }],
    ['deleted', { is_deleted: true }],
  ])('refuses a %s account, at login and with an existing token', async (_label, flags) => {
    const member = await makeUser(flags)
    const login = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
    expect(login.status).toBe(403)
    const me = await ctx.api.get('/api/auth/me').set(member.auth)
    expect(me.status).toBe(403)
  })

  it('reactivates a member who took a break when they sign in again', async () => {
    const member = await makeUser({ is_disabled: true, disabled_at: new Date() })
    expect((await ctx.api.get('/api/auth/me').set(member.auth)).status).toBe(403)
    const login = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
    expect(login.status).toBe(200)
    expect((await User.findById(member.id)).is_disabled).toBe(false)
  })

  it('rejects requests with no token, a bad token, or a token for a missing user', async () => {
    expect((await ctx.api.get('/api/auth/me')).status).toBe(401)
    expect((await ctx.api.get('/api/auth/me').set('Authorization', 'Bearer nonsense')).status).toBe(401)
    const ghost = tokenFor('64b000000000000000000001')
    expect((await ctx.api.get('/api/auth/me').set('Authorization', `Bearer ${ghost}`)).status).toBe(401)
  })

  it('can optionally insist on a verified email (ENFORCE_EMAIL_VERIFICATION)', async () => {
    const member = await makeUser({ email_verified: false })
    process.env.ENFORCE_EMAIL_VERIFICATION = 'true'
    try {
      const res = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
      expect(res.status).toBe(403)
      expect(res.body.requiresVerification).toBe(true)
    } finally {
      delete process.env.ENFORCE_EMAIL_VERIFICATION
    }
    const res = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
    expect(res.status).toBe(200)
  })
})

describe('forgotten password', () => {
  it('emails a reset link that works once, and the new password signs in', async () => {
    const member = await makeUser()
    clearOutbox()
    const forgot = await ctx.api.post('/api/auth/forgot-password').send({ email: member.user.email })
    expect(forgot.status).toBe(200)

    const mail = getOutbox().find((m) => m.to === member.user.email)
    const token = mail.text.match(/token=([a-f0-9]+)/)[1]

    const weak = await ctx.api.post('/api/auth/reset-password').send({ token, password: 'weak' })
    expect(weak.status).toBe(400)

    const newPassword = 'Brand-New-Pass-9!'
    const reset = await ctx.api.post('/api/auth/reset-password').send({ token, password: newPassword })
    expect(reset.status).toBe(200)

    const again = await ctx.api.post('/api/auth/reset-password').send({ token, password: 'Another-Pass-9!' })
    expect(again.status).toBe(400)

    expect((await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })).status).toBe(401)
    expect((await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: newPassword })).status).toBe(200)
  })

  it('answers identically for an unknown address and sends nothing', async () => {
    clearOutbox()
    const res = await ctx.api.post('/api/auth/forgot-password').send({ email: 'ghost@example.test' })
    expect(res.status).toBe(200)
    expect(getOutbox()).toHaveLength(0)
  })

  it('rejects an expired or made-up token', async () => {
    const member = await makeUser()
    member.user.password_reset_token = 'a'.repeat(64)
    member.user.password_reset_expires = new Date(Date.now() - 1000)
    await member.user.save()
    const expired = await ctx.api.post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'Brand-New-Pass-9!' })
    expect(expired.status).toBe(400)
    const injected = await ctx.api.post('/api/auth/reset-password').send({ token: { $ne: null }, password: 'Brand-New-Pass-9!' })
    expect(injected.status).toBe(400)
  })
})

describe('change password', () => {
  it('lets the member sign in with the new password afterwards (regression: double hashing)', async () => {
    const member = await makeUser()
    const newPassword = 'Changed-Pass-5678!'
    const res = await ctx.api.post('/api/auth/change-password').set(member.auth)
      .send({ current_password: PASSWORD, new_password: newPassword })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/changed/i)

    const login = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: newPassword })
    expect(login.status).toBe(200)
    const old = await ctx.api.post('/api/auth/login').send({ email: member.user.email, password: PASSWORD })
    expect(old.status).toBe(401)
  })

  it('refuses a wrong current password without ending the session (400, not 401)', async () => {
    const member = await makeUser()
    const res = await ctx.api.post('/api/auth/change-password').set(member.auth)
      .send({ current_password: 'Wrong-Pass-1!', new_password: 'Changed-Pass-5678!' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/current password/i)
  })

  it('refuses a weak or unchanged new password, and needs a login', async () => {
    const member = await makeUser()
    const weak = await ctx.api.post('/api/auth/change-password').set(member.auth)
      .send({ current_password: PASSWORD, new_password: 'short' })
    expect(weak.status).toBe(400)
    const same = await ctx.api.post('/api/auth/change-password').set(member.auth)
      .send({ current_password: PASSWORD, new_password: PASSWORD })
    expect(same.status).toBe(400)
    const anonymous = await ctx.api.post('/api/auth/change-password')
      .send({ current_password: PASSWORD, new_password: 'Changed-Pass-5678!' })
    expect(anonymous.status).toBe(401)
  })
})

describe('onboarding', () => {
  it('saves the profile, marks onboarding complete and records the LPA membership', async () => {
    const member = await makeUser({ onboarding_completed: false, first_name: '', birthdate: undefined, gender: '' })
    const res = await ctx.api.put('/api/auth/complete-onboarding').set(member.auth).send({
      first_name: 'Robin',
      last_name: 'Fictional',
      birthdate: '1970-03-02',
      gender: 'non_binary',
      location_city: 'Tulsa',
      location_state: 'Oklahoma',
      district_number: '8',
      lpa_membership_id: 'test-0001',
      bio: 'Hello!',
      interests: ['Cooking'],
      looking_for: ['everyone'],
      agreed_to_guidelines: true,
      photos: ['https://evil.example/not-mine.jpg'],
    })
    expect(res.status).toBe(200)
    expect(res.body.user.onboarding_completed).toBe(true)
    expect(res.body.profile.looking_for_gender).toEqual(['everyone'])
    // A photo URL the member never uploaded is not accepted.
    expect(res.body.profile.photos).toEqual([])
    const membership = await LPAMembership.findOne({ user_id: member.id })
    expect(membership.lpa_membership_id).toBe('TEST-0001')
  })

  it('refuses anyone under 18', async () => {
    const member = await makeUser({ onboarding_completed: false })
    const tooYoung = new Date()
    tooYoung.setFullYear(tooYoung.getFullYear() - 17)
    const res = await ctx.api.put('/api/auth/complete-onboarding').set(member.auth)
      .send({ first_name: 'Young', birthdate: tooYoung.toISOString() })
    expect(res.status).toBe(400)
    expect((await User.findById(member.id)).onboarding_completed).toBe(false)
  })

  it('answers a bad choice with a 400 and a readable message, not a 500', async () => {
    const member = await makeUser({ onboarding_completed: false })
    const res = await ctx.api.put('/api/auth/complete-onboarding').set(member.auth)
      .send({ first_name: 'Pat', gender: 'not-a-real-option' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/gender/i)
  })

  it('checks whether an LPA membership number is taken - members only', async () => {
    const owner = await makeUser()
    await LPAMembership.create({ user_id: owner.id, lpa_membership_id: 'TAKEN-1' })
    const other = await makeUser()

    expect((await ctx.api.post('/api/auth/check-membership-id').send({ lpa_membership_id: 'TAKEN-1' })).status).toBe(401)
    const taken = await ctx.api.post('/api/auth/check-membership-id').set(other.auth).send({ lpa_membership_id: 'taken-1' })
    expect(taken.body.exists).toBe(true)
    const mine = await ctx.api.post('/api/auth/check-membership-id').set(owner.auth).send({ lpa_membership_id: 'TAKEN-1' })
    expect(mine.body.exists).toBe(false)
    const free = await ctx.api.post('/api/auth/check-membership-id').set(other.auth).send({ lpa_membership_id: 'FREE-1' })
    expect(free.body.exists).toBe(false)
  })
})

describe('rate limiting', () => {
  it('blocks repeated failed sign-ins but never counts successful ones', async () => {
    const limiters = createLimiters({ force: true, authMax: 3 })
    const app = express()
    app.use(express.json())
    app.post('/login', limiters.authLimiter, (req, res) =>
      req.body.ok ? res.json({ ok: true }) : res.status(401).json({ message: 'no' }))

    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post('/login').send({ email: 'a@example.test', ok: true })).status).toBe(200)
    }
    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).post('/login').send({ email: 'a@example.test' })).status).toBe(401)
    }
    const blocked = await request(app).post('/login').send({ email: 'a@example.test' })
    expect(blocked.status).toBe(429)
    expect(blocked.body.message).toMatch(/15 minutes/)
    // A different member on the same address is not locked out with them.
    expect((await request(app).post('/login').send({ email: 'b@example.test' })).status).toBe(401)
  })
})

describe('plumbing', () => {
  it('health check answers, unknown routes are a JSON 404', async () => {
    expect((await ctx.api.get('/api/health')).body.status).toBe('ok')
    const missing = await ctx.api.get('/api/nope')
    expect(missing.status).toBe(404)
    expect(missing.body.message).toBeTruthy()
  })

  it('sends security headers and refuses other origins', async () => {
    const res = await ctx.api.get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    const cross = await ctx.api.get('/api/health').set('Origin', 'https://evil.example')
    expect(cross.status).toBe(403)
    expect(cross.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers malformed JSON with a 400', async () => {
    const res = await ctx.api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
    expect(res.status).toBe(400)
  })
})
