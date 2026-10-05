import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { startApp, makeUser, makeAdmin, makeMatch, PASSWORD, TINY_PNG } from './helpers.js'
import User from '../src/models/User.js'
import Profile from '../src/models/Profile.js'
import Match from '../src/models/Match.js'
import Like from '../src/models/Like.js'
import Block from '../src/models/Block.js'
import Message from '../src/models/Message.js'
import Notification from '../src/models/Notification.js'
import Report from '../src/models/Report.js'
import Event from '../src/models/Event.js'
import UserNotificationSettings from '../src/models/UserNotificationSettings.js'
import UserPrivacySettings from '../src/models/UserPrivacySettings.js'

let ctx
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await ctx.stop() })

const ids = (list) => list.map((p) => String(p.id))
const future = (days) => new Date(Date.now() + days * 86400000).toISOString()

describe('browse', () => {
  it('shows visible members and hides admins, paused, banned, hidden, blocked and passed ones', async () => {
    const viewer = await makeUser({ gender: 'male' })
    const visible = await makeUser()
    const admin = await makeAdmin()
    const paused = await makeUser({ is_disabled: true })
    const banned = await makeUser({ is_banned: true })
    const notOnboarded = await makeUser({ onboarding_completed: false })
    const hidden = await makeUser()
    await UserPrivacySettings.create({ user_id: hidden.id, profile_visible: false })
    const blockedByMe = await makeUser()
    await Block.create({ blocker: viewer.id, blocked: blockedByMe.id })
    const blockedMe = await makeUser()
    await Block.create({ blocker: blockedMe.id, blocked: viewer.id })
    const passed = await makeUser()
    await Like.create({ from_user: viewer.id, to_user: passed.id, type: 'pass' })

    const res = await ctx.api.get('/api/browse').set(viewer.auth)
    expect(res.status).toBe(200)
    const shown = ids(res.body)
    expect(shown).toContain(visible.id)
    for (const other of [viewer, admin, paused, banned, notOnboarded, hidden, blockedByMe, blockedMe, passed]) {
      expect(shown).not.toContain(other.id)
    }
    const card = res.body.find((p) => String(p.id) === visible.id)
    expect(card.distance).toBeNull() // no more made-up distances
    expect(card).not.toHaveProperty('email')
    expect(card.is_liked).toBe(false)
  })

  it('applies "who I want to meet", the other person\'s preference and the age range', async () => {
    const viewer = await makeUser({ gender: 'male', profile: { looking_for_gender: ['female'], age_preference_min: 40, age_preference_max: 60 } })
    const woman = await makeUser({ gender: 'female' })
    const man = await makeUser({ gender: 'male' })
    const womanSeekingWomen = await makeUser({ gender: 'female', profile: { looking_for_gender: ['female'] } })
    const tooYoung = await makeUser({ gender: 'female', birthdate: new Date('2000-01-01') })
    // Saved by an older version of the app with a hyphen: must still match.
    const seeksNonBinary = await makeUser({ gender: 'female', profile: { looking_for_gender: ['non-binary', 'male'] } })

    const shown = ids((await ctx.api.get('/api/browse').set(viewer.auth)).body)
    expect(shown).toContain(woman.id)
    expect(shown).toContain(seeksNonBinary.id)
    expect(shown).not.toContain(man.id)
    expect(shown).not.toContain(womanSeekingWomen.id)
    expect(shown).not.toContain(tooYoung.id)
  })

  it('selective mode shows a member only to people they have liked', async () => {
    const selective = await makeUser()
    await UserPrivacySettings.create({ user_id: selective.id, selective_mode: true })
    const liked = await makeUser()
    const stranger = await makeUser()
    await Like.create({ from_user: selective.id, to_user: liked.id, type: 'like' })
    expect(ids((await ctx.api.get('/api/browse').set(liked.auth)).body)).toContain(selective.id)
    expect(ids((await ctx.api.get('/api/browse').set(stranger.auth)).body)).not.toContain(selective.id)
  })
})

describe('like, pass, match, unlike', () => {
  it('a like notifies quietly; a like back makes a match and notifies both', async () => {
    const a = await makeUser()
    const b = await makeUser()

    const first = await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)
    expect(first.body).toMatchObject({ success: true, is_match: false })
    const likeNotice = await Notification.findOne({ user_id: b.id, type: 'like' })
    expect(likeNotice).toBeTruthy()
    expect(likeNotice.related_user).toBeFalsy() // does not give away who

    expect((await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)).status).toBe(400)

    const second = await ctx.api.post(`/api/browse/${a.id}/like`).set(b.auth)
    expect(second.body.is_match).toBe(true)
    expect(await Match.countDocuments({ users: { $all: [a.id, b.id] }, is_active: true })).toBe(1)
    expect(await Notification.countDocuments({ type: 'match', user_id: { $in: [a.id, b.id] } })).toBe(2)

    const matches = await ctx.api.get('/api/matches').set(a.auth)
    expect(matches.body.active).toHaveLength(1)
    expect(String(matches.body.active[0].user.id)).toBe(b.id)

    const liked = await ctx.api.get('/api/browse/liked').set(a.auth)
    expect(ids(liked.body)).toEqual([b.id])
  })

  it('respects notification settings', async () => {
    const a = await makeUser()
    const b = await makeUser()
    await UserNotificationSettings.create({ user_id: b.id, likes: false, matches: false })
    await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)
    await ctx.api.post(`/api/browse/${a.id}/like`).set(b.auth)
    expect(await Notification.countDocuments({ user_id: b.id })).toBe(0)
    expect(await Notification.countDocuments({ user_id: a.id, type: 'match' })).toBe(1)
  })

  it('a pass can later be changed into a like', async () => {
    const a = await makeUser()
    const b = await makeUser()
    expect((await ctx.api.post(`/api/browse/${b.id}/pass`).set(a.auth)).status).toBe(200)
    const like = await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)
    expect(like.status).toBe(200)
    expect(await Like.countDocuments({ from_user: a.id, to_user: b.id })).toBe(1)
    expect((await Like.findOne({ from_user: a.id, to_user: b.id })).type).toBe('like')
  })

  it('unliking ends the match; liking again brings back the same conversation', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const like = await Like.findOne({ from_user: a.id, to_user: b.id })

    expect((await ctx.api.delete(`/api/browse/liked/${like._id}`).set(b.auth)).status).toBe(403)
    expect((await ctx.api.delete(`/api/browse/liked/${like._id}`).set(a.auth)).status).toBe(200)
    expect((await Match.findById(match._id)).is_active).toBe(false)

    const again = await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)
    expect(again.body.is_match).toBe(true)
    expect(await Match.countDocuments({ users: { $all: [a.id, b.id] } })).toBe(1)
    expect((await Match.findById(match._id)).is_active).toBe(true)
  })

  it('unmatching removes the likes and moves the match to inactive', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const outsider = await makeUser()
    const match = await makeMatch(a, b)
    expect((await ctx.api.delete(`/api/matches/${match._id}`).set(outsider.auth)).status).toBe(404)
    expect((await ctx.api.delete(`/api/matches/${match._id}`).set(a.auth)).status).toBe(200)
    expect(await Like.countDocuments({ from_user: { $in: [a.id, b.id] } })).toBe(0)
    const list = await ctx.api.get('/api/matches').set(b.auth)
    expect(list.body.active).toHaveLength(0)
    expect(list.body.inactive).toHaveLength(1)
  })

  it('cannot like yourself, a missing member, or with a malformed id', async () => {
    const a = await makeUser()
    expect((await ctx.api.post(`/api/browse/${a.id}/like`).set(a.auth)).status).toBe(400)
    expect((await ctx.api.post('/api/browse/64b000000000000000000001/like').set(a.auth)).status).toBe(404)
    expect((await ctx.api.post('/api/browse/not-an-id/like').set(a.auth)).status).toBe(404)
  })
})

describe('block, unblock, report', () => {
  it('blocking removes the match, likes and conversation, and hides each from the other', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'hello' })
    await ctx.api.put(`/api/favorites/${b.id}`).set(a.auth)

    expect((await ctx.api.post(`/api/browse/${b.id}/block`).set(a.auth)).status).toBe(200)
    expect((await ctx.api.post(`/api/browse/${b.id}/block`).set(a.auth)).body.already_blocked).toBe(true)

    expect(await Match.countDocuments({ users: { $all: [a.id, b.id] } })).toBe(0)
    expect(await Like.countDocuments({ from_user: { $in: [a.id, b.id] } })).toBe(0)
    expect((await ctx.api.get('/api/messages').set(b.auth)).body).toHaveLength(0)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(b.auth).send({ content: 'still there?' })).status).toBe(404)
    expect((await ctx.api.get('/api/favorites').set(a.auth)).body).toHaveLength(0)

    // Neither can open the other's profile or like them.
    expect((await ctx.api.get(`/api/users/${a.id}`).set(b.auth)).status).toBe(404)
    expect((await ctx.api.get(`/api/users/${b.id}`).set(a.auth)).status).toBe(404)
    expect((await ctx.api.post(`/api/browse/${a.id}/like`).set(b.auth)).status).toBe(404)

    const list = await ctx.api.get('/api/browse/blocked-list').set(a.auth)
    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ id: b.id, first_name: b.user.first_name })
    expect((await ctx.api.get('/api/browse/blocked-list').set(b.auth)).body).toHaveLength(0)
  })

  it('unblocking makes the member visible again; only the blocker can unblock', async () => {
    const a = await makeUser()
    const b = await makeUser()
    await ctx.api.post(`/api/browse/${b.id}/block`).set(a.auth)
    expect((await ctx.api.delete(`/api/browse/${a.id}/unblock`).set(b.auth)).status).toBe(404)
    expect((await ctx.api.delete(`/api/browse/${b.id}/unblock`).set(a.auth)).status).toBe(200)
    expect((await ctx.api.get(`/api/users/${b.id}`).set(a.auth)).status).toBe(200)
    expect(ids((await ctx.api.get('/api/browse').set(a.auth)).body)).toContain(b.id)
  })

  it('reports reach the moderators once, with category and where they came from', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const admin = await makeAdmin()
    const first = await ctx.api.post(`/api/browse/${b.id}/report`).set(a.auth)
      .send({ reason: 'Asked me to buy gift cards', category: 'Asked for money', source: 'chat' })
    expect(first.status).toBe(200)
    const second = await ctx.api.post(`/api/browse/${b.id}/report`).set(a.auth).send({ reason: 'Again today' })
    expect(second.body.already_reported).toBe(true)
    expect(await Report.countDocuments({ reporter: a.id, reported_user: b.id })).toBe(1)
    expect((await ctx.api.post(`/api/browse/${a.id}/report`).set(a.auth).send({ reason: 'x' })).status).toBe(400)

    const queue = await ctx.api.get('/api/admin/reports').set(admin.auth)
    const report = queue.body.find((r) => String(r.reported_user.id) === b.id)
    expect(report).toMatchObject({ category: 'Asked for money', source: 'chat', status: 'pending' })
    expect(report.reporter.first_name).toBe(a.user.first_name)
    expect(report.reason).toContain('Again today')

    const resolved = await ctx.api.put(`/api/admin/reports/${report.id}`).set(admin.auth).send({ status: 'resolved', action_taken: 'warning' })
    expect(resolved.status).toBe(200)
    expect((await ctx.api.put(`/api/admin/reports/${report.id}`).set(admin.auth).send({ status: 'nonsense' })).status).toBe(400)
    expect((await ctx.api.get('/api/admin/reports').set(admin.auth)).body.find((r) => String(r.id) === String(report.id))).toBeUndefined()
  })
})

describe('saved profiles (favourites)', () => {
  it('saves, lists and removes a profile, privately', async () => {
    const a = await makeUser()
    const b = await makeUser()
    expect((await ctx.api.put(`/api/favorites/${b.id}`).set(a.auth)).body.is_favorite).toBe(true)
    await ctx.api.put(`/api/favorites/${b.id}`).set(a.auth) // twice is fine
    const list = await ctx.api.get('/api/favorites').set(a.auth)
    expect(ids(list.body)).toEqual([b.id])
    expect((await ctx.api.get('/api/favorites').set(b.auth)).body).toHaveLength(0)
    expect((await ctx.api.get(`/api/users/${b.id}`).set(a.auth)).body.relationship.is_favorite).toBe(true)
    expect(await Notification.countDocuments({ user_id: b.id })).toBe(0) // the other person is never told
    expect((await ctx.api.delete(`/api/favorites/${b.id}`).set(a.auth)).body.is_favorite).toBe(false)
    expect((await ctx.api.get('/api/favorites').set(a.auth)).body).toHaveLength(0)
    expect((await ctx.api.put(`/api/favorites/${a.id}`).set(a.auth)).status).toBe(400)
  })
})

describe('messages', () => {
  it('sends, lists, counts unread, marks read, edits, unsends and clears a conversation', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)

    const sent = await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: '  Hello there  ' })
    expect(sent.status).toBe(201)
    expect(sent.body).toMatchObject({ content: 'Hello there', sender_id: a.id, match_id: match._id.toString() })
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'Second' })

    // Only the first message from a person creates a notification.
    expect(await Notification.countDocuments({ user_id: b.id, type: 'message' })).toBe(1)

    const inbox = await ctx.api.get('/api/messages').set(b.auth)
    expect(inbox.body[0]).toMatchObject({ unread_count: 2, last_message: 'Second', has_messages: true })

    const thread = await ctx.api.get(`/api/messages/${match._id}`).set(b.auth)
    expect(thread.body.map((m) => m.content)).toEqual(['Hello there', 'Second'])
    expect((await ctx.api.get('/api/messages').set(b.auth)).body[0].unread_count).toBe(0)
    expect((await ctx.api.get(`/api/messages/${match._id}`).set(a.auth)).body.every((m) => m.read)).toBe(true)

    const edited = await ctx.api.put(`/api/messages/${match._id}/${sent.body.id}`).set(a.auth).send({ content: 'Hello!' })
    expect(edited.body.content).toBe('Hello!')
    expect(edited.body.edited_at).toBeTruthy()
    expect((await ctx.api.put(`/api/messages/${match._id}/${sent.body.id}`).set(b.auth).send({ content: 'hijack' })).status).toBe(403)

    const second = thread.body[1]
    expect((await ctx.api.delete(`/api/messages/${match._id}/${second.id}`).set(b.auth)).status).toBe(403)
    const unsent = await ctx.api.delete(`/api/messages/${match._id}/${second.id}`).set(a.auth)
    expect(unsent.body).toMatchObject({ is_unsent: true, content: '' })
    expect((await Message.findById(second.id)).content).toBe('') // really gone
    expect((await ctx.api.delete(`/api/messages/${match._id}/${second.id}`).set(a.auth)).status).toBe(409)
    expect((await ctx.api.get('/api/messages').set(b.auth)).body[0].last_message).toBe('Message unsent')

    expect((await ctx.api.delete(`/api/messages/${match._id}`).set(b.auth)).status).toBe(200)
    expect((await ctx.api.get(`/api/messages/${match._id}`).set(b.auth)).body).toHaveLength(0)
    expect((await ctx.api.get(`/api/messages/${match._id}`).set(a.auth)).body).toHaveLength(2) // only cleared for b
  })

  it('refuses empty, over-long and non-text messages', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: '   ' })).status).toBe(400)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'x'.repeat(2001) })).status).toBe(400)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: { $ne: 1 } })).status).toBe(400)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'x'.repeat(2000) })).status).toBe(201)
  })

  it('an unsent unread message does not leave an unread badge behind', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const sent = await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'oops' })
    await ctx.api.delete(`/api/messages/${match._id}/${sent.body.id}`).set(a.auth)
    expect((await ctx.api.get('/api/messages').set(b.auth)).body[0].unread_count).toBe(0)
  })

  it('nobody outside a conversation can read it, write to it or change it', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const outsider = await makeUser()
    const match = await makeMatch(a, b)
    const sent = await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'private' })

    expect((await ctx.api.get(`/api/messages/${match._id}`).set(outsider.auth)).status).toBe(404)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(outsider.auth).send({ content: 'hi' })).status).toBe(404)
    expect((await ctx.api.put(`/api/messages/${match._id}/${sent.body.id}`).set(outsider.auth).send({ content: 'x' })).status).toBe(404)
    expect((await ctx.api.delete(`/api/messages/${match._id}/${sent.body.id}`).set(outsider.auth)).status).toBe(404)
    expect((await ctx.api.delete(`/api/messages/${match._id}`).set(outsider.auth)).status).toBe(404)
    expect((await ctx.api.get('/api/messages').set(outsider.auth)).body).toHaveLength(0)
    expect((await ctx.api.get(`/api/messages/${match._id}`)).status).toBe(401)
    expect((await ctx.api.get('/api/messages/not-an-id').set(a.auth)).status).toBe(404)
    // The old unauthenticated broadcast endpoint is gone.
    expect((await ctx.api.post('/api/messages/broadcast').send({ matchId: match._id, message: { content: 'fake' } })).status).toBe(401)
  })

  it('cannot message after unmatching, and read receipts can be switched off', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'seen?' })
    await ctx.api.put('/api/settings').set(b.auth).send({ privacy: { readReceipts: false } })
    await ctx.api.get(`/api/messages/${match._id}`).set(b.auth)
    expect((await ctx.api.get(`/api/messages/${match._id}`).set(a.auth)).body[0].read).toBe(false)
    await ctx.api.put('/api/settings').set(b.auth).send({ privacy: { readReceipts: true } })
    expect((await ctx.api.get(`/api/messages/${match._id}`).set(a.auth)).body[0].read).toBe(true)

    await ctx.api.delete(`/api/matches/${match._id}`).set(a.auth)
    expect((await ctx.api.post(`/api/messages/${match._id}`).set(b.auth).send({ content: 'hello?' })).status).toBe(404)
  })
})

describe('profiles', () => {
  it('returns my profile with real stats (no invented numbers)', async () => {
    const me = await makeUser()
    const res = await ctx.api.get('/api/users/profile').set(me.auth)
    expect(res.status).toBe(200)
    expect(res.body.stats).toEqual({ matches_count: 0, likes_received: 0, profile_views: null })
    expect(res.body.user).not.toHaveProperty('password')
  })

  it('updates my profile and gives a readable 400 for bad input', async () => {
    const me = await makeUser()
    const ok = await ctx.api.put('/api/users/profile').set(me.auth)
      .send({ bio: 'Updated bio', interests: ['Fishing'], location_city: 'Norman', looking_for: ['non-binary'] })
    expect(ok.status).toBe(200)
    expect(ok.body.profile).toMatchObject({ bio: 'Updated bio', location_city: 'Norman', looking_for_gender: ['non_binary'] })

    const tooLong = await ctx.api.put('/api/users/profile').set(me.auth).send({ bio: 'x'.repeat(501) })
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.message).toMatch(/too long/i)
    const minor = await ctx.api.put('/api/users/profile').set(me.auth).send({ birthdate: '2015-01-01' })
    expect(minor.status).toBe(400)
    expect((await ctx.api.put('/api/users/profile').set(me.auth).send({ first_name: '  ' })).status).toBe(400)
  })

  it('shows another member only what is public: age but no birth date, email or flags', async () => {
    const me = await makeUser()
    const other = await makeUser()
    const res = await ctx.api.get(`/api/users/${other.id}`).set(me.auth)
    expect(res.status).toBe(200)
    expect(res.body.user.age).toBeGreaterThan(40)
    for (const hidden of ['birthdate', 'email', 'password', 'role', 'admin_notes', 'warnings']) {
      expect(res.body.user).not.toHaveProperty(hidden)
    }
    expect(res.body.profile).not.toHaveProperty('lpa_membership_id')
    expect((await ctx.api.get('/api/users/not-an-id').set(me.auth)).status).toBe(404)
    const gone = await makeUser({ is_deleted: true })
    expect((await ctx.api.get(`/api/users/${gone.id}`).set(me.auth)).status).toBe(404)
  })

  it('permanent delete needs the password', async () => {
    const me = await makeUser()
    expect((await ctx.api.delete('/api/users/profile').set(me.auth).send({})).status).toBe(400)
    expect(await User.findById(me.id)).toBeTruthy()
    expect((await ctx.api.delete('/api/users/profile').set(me.auth).send({ password: PASSWORD })).status).toBe(200)
    expect(await User.findById(me.id)).toBeNull()
  })
})

describe('photos', () => {
  const upload = (member, buffer, filename, contentType) =>
    ctx.api.post('/api/users/photos').set(member.auth).attach('photo', buffer, { filename, contentType })

  it('uploads to local test storage (never S3), sets the first as profile picture, reorders and deletes', async () => {
    const me = await makeUser()
    const first = await upload(me, TINY_PNG, 'one.png', 'image/png')
    expect(first.status).toBe(200)
    expect(first.body.url).toMatch(/^http:\/\/localhost:4120\/local-uploads\//)
    expect(first.body.url).not.toMatch(/amazonaws/)
    expect(first.body.isProfilePicture).toBe(true)
    const stored = path.join(process.env.LOCAL_UPLOAD_DIR, first.body.url.split('/local-uploads/')[1])
    expect(fs.existsSync(stored)).toBe(true)

    const second = await upload(me, TINY_PNG, 'two.png', 'image/png')
    let profile = await Profile.findOne({ user_id: me.id })
    expect(profile.photos).toEqual([first.body.url, second.body.url])

    // Reorder; a URL that is not mine is silently dropped.
    const reorder = await ctx.api.put('/api/users/profile').set(me.auth)
      .send({ photos: [second.body.url, 'https://evil.example/x.png', first.body.url] })
    expect(reorder.body.profile.photos).toEqual([second.body.url, first.body.url])

    expect((await ctx.api.put('/api/users/profile-picture').set(me.auth).send({ photoUrl: 'https://evil.example/x.png' })).status).toBe(400)
    expect((await ctx.api.put('/api/users/profile-picture').set(me.auth).send({ photoUrl: second.body.url })).status).toBe(200)

    expect((await ctx.api.delete('/api/users/photos').set(me.auth).send({ url: second.body.url })).status).toBe(200)
    profile = await Profile.findOne({ user_id: me.id })
    expect(profile.photos).toEqual([first.body.url])
    expect(profile.profile_picture_url).toBe(first.body.url)
  })

  it('refuses SVG, files that only pretend to be images, oversized files and anonymous uploads', async () => {
    const me = await makeUser()
    const svg = await upload(me, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml')
    expect(svg.status).toBe(400)
    const fake = await upload(me, Buffer.from('<html><script>alert(1)</script></html>'), 'x.png', 'image/png')
    expect(fake.status).toBe(400)
    const huge = await upload(me, Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]), 'big.png', 'image/png')
    expect(huge.status).toBe(400)
    expect(huge.body.message).toMatch(/too large/i)
    const anonymous = await ctx.api.post('/api/users/photos').attach('photo', TINY_PNG, { filename: 'a.png', contentType: 'image/png' })
    expect(anonymous.status).toBe(401)
    expect((await Profile.findOne({ user_id: me.id })).photos).toHaveLength(0)
  })

  it('caps the number of photos', async () => {
    const me = await makeUser({ profile: { photos: Array.from({ length: 9 }, (_, i) => `http://localhost:4120/local-uploads/p${i}.png`) } })
    const res = await upload(me, TINY_PNG, 'ten.png', 'image/png')
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/up to 9/)
  })
})

describe('notifications', () => {
  it('lists, counts, marks read, marks all read and deletes - only my own', async () => {
    const me = await makeUser()
    const other = await makeUser()
    const mine = await Notification.create({ user_id: me.id, type: 'system', title: 'One', message: 'm' })
    await Notification.create({ user_id: me.id, type: 'news', title: 'Two', message: 'm' })
    const theirs = await Notification.create({ user_id: other.id, type: 'system', title: 'Theirs', message: 'm' })

    const list = await ctx.api.get('/api/notifications').set(me.auth)
    expect(list.body.map((n) => n.title).sort()).toEqual(['One', 'Two'])
    expect((await ctx.api.get('/api/notifications/unread-count').set(me.auth)).body.count).toBe(2)

    expect((await ctx.api.put(`/api/notifications/${mine._id}/read`).set(me.auth)).status).toBe(200)
    expect((await ctx.api.get('/api/notifications/unread-count').set(me.auth)).body.count).toBe(1)
    expect((await ctx.api.put(`/api/notifications/${theirs._id}/read`).set(me.auth)).status).toBe(404)
    expect((await ctx.api.delete(`/api/notifications/${theirs._id}`).set(me.auth)).status).toBe(404)

    expect((await ctx.api.put('/api/notifications/mark-all-read').set(me.auth)).status).toBe(200)
    expect((await ctx.api.get('/api/notifications/unread-count').set(me.auth)).body.count).toBe(0)
    expect((await Notification.findById(theirs._id)).read).toBe(false)

    expect((await ctx.api.delete(`/api/notifications/${mine._id}`).set(me.auth)).status).toBe(200)
    expect((await ctx.api.get('/api/notifications').set(me.auth)).body).toHaveLength(1)
  })
})

describe('settings', () => {
  it('starts with sensible defaults', async () => {
    const me = await makeUser()
    const res = await ctx.api.get('/api/settings').set(me.auth)
    expect(res.body.notifications).toEqual({
      matches: true, messages: true, likes: true, events: true, admin_news: true, sound: true,
      quiet_hours_enabled: false, quiet_hours_start: '21:00', quiet_hours_end: '08:00', email_digest: false,
    })
    expect(res.body.privacy).toEqual({ profileVisible: true, selectiveMode: false, showOnline: true, readReceipts: true })
  })

  it.each([
    ['notifications', 'matches', false], ['notifications', 'messages', false], ['notifications', 'likes', false],
    ['notifications', 'events', false], ['notifications', 'admin_news', false], ['notifications', 'sound', false],
    ['notifications', 'quiet_hours_enabled', true], ['notifications', 'email_digest', true],
    ['privacy', 'profileVisible', false], ['privacy', 'selectiveMode', true],
    ['privacy', 'showOnline', false], ['privacy', 'readReceipts', false],
  ])('toggle %s.%s persists and leaves the others alone', async (group, key, value) => {
    const me = await makeUser()
    const before = (await ctx.api.get('/api/settings').set(me.auth)).body
    expect((await ctx.api.put('/api/settings').set(me.auth).send({ [group]: { [key]: value } })).status).toBe(200)
    const after = (await ctx.api.get('/api/settings').set(me.auth)).body
    expect(after[group][key]).toBe(value)
    expect({ ...after[group], [key]: before[group][key] }).toEqual(before[group])
    const otherGroup = group === 'privacy' ? 'notifications' : 'privacy'
    expect(after[otherGroup]).toEqual(before[otherGroup])
  })

  it('saves who I want to meet, the age range (clamped) and quiet-hours times (validated)', async () => {
    const me = await makeUser()
    await ctx.api.put('/api/settings').set(me.auth).send({ lookingFor: ['female', 'non-binary', 'bogus'], agePreferenceMin: 70, agePreferenceMax: 45 })
    let s = (await ctx.api.get('/api/settings').set(me.auth)).body
    expect(s.lookingFor).toEqual(['female', 'non_binary'])
    expect([s.agePreferenceMin, s.agePreferenceMax]).toEqual([45, 70])

    expect((await ctx.api.put('/api/settings').set(me.auth).send({ notifications: { quiet_hours_start: '25:99' } })).status).toBe(400)
    await ctx.api.put('/api/settings').set(me.auth).send({ notifications: { quiet_hours_start: '22:30', quiet_hours_end: '07:15' } })
    s = (await ctx.api.get('/api/settings').set(me.auth)).body
    expect([s.notifications.quiet_hours_start, s.notifications.quiet_hours_end]).toEqual(['22:30', '07:15'])
  })

  it('hiding my profile really removes me from Browse', async () => {
    const me = await makeUser()
    const viewer = await makeUser()
    expect(ids((await ctx.api.get('/api/browse').set(viewer.auth)).body)).toContain(me.id)
    await ctx.api.put('/api/settings').set(me.auth).send({ privacy: { profileVisible: false } })
    expect(ids((await ctx.api.get('/api/browse').set(viewer.auth)).body)).not.toContain(me.id)
  })

  it('turning message notifications off stops the notification being created', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    await ctx.api.put('/api/settings').set(b.auth).send({ notifications: { messages: false } })
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'hi' })
    expect(await Notification.countDocuments({ user_id: b.id })).toBe(0)
  })

  it('take a break: wrong password is a 400; right password pauses until next sign-in', async () => {
    const me = await makeUser()
    const viewer = await makeUser()
    expect((await ctx.api.post('/api/settings/disable').set(me.auth).send({ password: 'Wrong-Pass-1!' })).status).toBe(400)
    expect((await ctx.api.post('/api/settings/disable').set(me.auth).send({})).status).toBe(400)
    expect((await ctx.api.post('/api/settings/disable').set(me.auth).send({ password: PASSWORD, reason: 'busy' })).status).toBe(200)
    expect((await ctx.api.get('/api/auth/me').set(me.auth)).status).toBe(403)
    expect(ids((await ctx.api.get('/api/browse').set(viewer.auth)).body)).not.toContain(me.id)
    expect((await ctx.api.post('/api/auth/login').send({ email: me.user.email, password: PASSWORD })).status).toBe(200)
    expect(ids((await ctx.api.get('/api/browse').set(viewer.auth)).body)).toContain(me.id)
  })

  it('delete account: needs the password, then the account cannot be used or seen', async () => {
    const me = await makeUser()
    const friend = await makeUser()
    await makeMatch(me, friend)
    expect((await ctx.api.post('/api/settings/delete').set(me.auth).send({ password: 'Wrong-Pass-1!' })).status).toBe(400)
    expect((await ctx.api.post('/api/settings/delete').set(me.auth).send({ password: PASSWORD })).status).toBe(200)
    expect((await ctx.api.get('/api/auth/me').set(me.auth)).status).toBe(403)
    expect((await ctx.api.post('/api/auth/login').send({ email: me.user.email, password: PASSWORD })).status).toBe(403)
    expect((await ctx.api.get('/api/matches').set(friend.auth)).body.active).toHaveLength(0)
    expect((await ctx.api.get('/api/messages').set(friend.auth)).body).toHaveLength(0)
  })
})

describe('events', () => {
  let admin
  beforeAll(async () => { admin = await makeAdmin() })

  const createEvent = (overrides = {}) =>
    ctx.api.post('/api/admin/events').set(admin.auth).send({
      title: 'Test Potluck', description: 'Bring a dish', location: 'Community Hall, Testville',
      start_date: future(7), end_date: future(7.1), category: 'social', ...overrides,
    })

  it('lists events once people have RSVP\'d (regression: this returned a 500)', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const event = (await createEvent()).body
    expect((await ctx.api.post(`/api/events/${event.id}/join`).set(a.auth)).body).toMatchObject({ is_joined: true, attendees: 1 })
    expect((await ctx.api.post(`/api/events/${event.id}/join`).set(a.auth)).status).toBe(400)

    const forA = await ctx.api.get('/api/events').set(a.auth)
    expect(forA.status).toBe(200)
    expect(forA.body.find((e) => String(e.id) === String(event.id))).toMatchObject({ attendees: 1, is_joined: true })
    const forB = await ctx.api.get('/api/events').set(b.auth)
    expect(forB.body.find((e) => String(e.id) === String(event.id))).toMatchObject({ attendees: 1, is_joined: false })

    expect((await ctx.api.post(`/api/events/${event.id}/leave`).set(a.auth)).body).toMatchObject({ is_joined: false, attendees: 0 })
  })

  it('enforces the number of places, cancellation and hidden drafts', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const small = (await createEvent({ max_attendees: 1 })).body
    expect((await ctx.api.post(`/api/events/${small.id}/join`).set(a.auth)).status).toBe(200)
    const full = await ctx.api.post(`/api/events/${small.id}/join`).set(b.auth)
    expect(full.status).toBe(400)
    expect(full.body.message).toMatch(/full/i)

    await ctx.api.put(`/api/admin/events/${small.id}/cancel`).set(admin.auth)
    expect(await Notification.countDocuments({ user_id: a.id, title: 'Event Cancelled' })).toBe(1)
    await ctx.api.post(`/api/events/${small.id}/leave`).set(a.auth)
    expect((await ctx.api.post(`/api/events/${small.id}/join`).set(a.auth)).status).toBe(400)
    await ctx.api.put(`/api/admin/events/${small.id}/uncancel`).set(admin.auth)
    expect((await ctx.api.post(`/api/events/${small.id}/join`).set(a.auth)).status).toBe(200)

    const toggled = await ctx.api.put(`/api/admin/events/${small.id}/toggle-visibility`).set(admin.auth)
    expect(toggled.body.is_hidden).toBe(true)
    expect((await ctx.api.get('/api/events').set(b.auth)).body.find((e) => String(e.id) === String(small.id))).toBeUndefined()
    expect((await ctx.api.get(`/api/events/${small.id}`).set(b.auth)).status).toBe(404)
    expect((await ctx.api.get('/api/events').set(admin.auth)).body.find((e) => String(e.id) === String(small.id))).toBeTruthy()
  })

  it('who\'s going shows first names and notes, and leaves out people I have blocked', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const c = await makeUser()
    const event = (await createEvent()).body
    for (const m of [a, b, c]) await ctx.api.post(`/api/events/${event.id}/join`).set(m.auth)

    expect((await ctx.api.put(`/api/events/${event.id}/note`).set(a.auth).send({ note: 'Driving from Tulsa, 2 seats free' })).status).toBe(200)
    expect((await ctx.api.put(`/api/events/${event.id}/note`).set(a.auth).send({ note: 'x'.repeat(141) })).status).toBe(400)
    const outsider = await makeUser()
    expect((await ctx.api.put(`/api/events/${event.id}/note`).set(outsider.auth).send({ note: 'hi' })).status).toBe(400)

    await ctx.api.post(`/api/browse/${c.id}/block`).set(b.auth)
    const going = await ctx.api.get(`/api/events/${event.id}/attendees`).set(b.auth)
    expect(going.body.map((p) => p.first_name).sort()).toEqual([a.user.first_name, b.user.first_name].sort())
    expect(going.body.find((p) => String(p.id) === a.id).note).toBe('Driving from Tulsa, 2 seats free')
    expect(going.body[0]).not.toHaveProperty('email')
    expect(going.body[0]).not.toHaveProperty('last_name')

    const adminView = await ctx.api.get(`/api/admin/events/${event.id}/attendees`).set(admin.auth)
    expect(adminView.body).toHaveLength(3)
    expect(adminView.body[0].email).toBeTruthy()
  })

  it('admin create validates, notifies members who want event news, and update cannot overwrite attendees', async () => {
    const wants = await makeUser()
    const optedOut = await makeUser()
    await UserNotificationSettings.create({ user_id: optedOut.id, events: false })

    expect((await createEvent({ title: '' })).status).toBe(400)
    expect((await createEvent({ start_date: 'not a date' })).status).toBe(400)
    expect((await createEvent({ end_date: future(1) })).status).toBe(400) // ends before it starts
    expect((await createEvent({ category: 'nonsense' })).status).toBe(400)

    const event = (await createEvent({ title: 'Notified Event' })).body
    expect(await Notification.countDocuments({ user_id: wants.id, related_event: String(event.id) })).toBe(1)
    expect(await Notification.countDocuments({ user_id: optedOut.id, related_event: String(event.id) })).toBe(0)

    await ctx.api.post(`/api/events/${event.id}/join`).set(wants.auth)
    const updated = await ctx.api.put(`/api/admin/events/${event.id}`).set(admin.auth)
      .send({ title: 'Renamed Event', attendees: [], created_by: 'someone-else' })
    expect(updated.body.title).toBe('Renamed Event')
    const stored = await Event.findById(event.id)
    expect(stored.attendees).toEqual([wants.id])
    expect(stored.created_by).toBe(admin.id)

    expect((await ctx.api.delete(`/api/admin/events/${event.id}`).set(admin.auth)).status).toBe(200)
    expect((await ctx.api.get(`/api/events/${event.id}`).set(wants.auth)).status).toBe(404)
  })

  it('uploads an event picture through the storage seam', async () => {
    const res = await ctx.api.post('/api/admin/events/photo').set(admin.auth)
      .attach('photo', TINY_PNG, { filename: 'e.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/local-uploads\/.*events\//)
    const bad = await ctx.api.post('/api/admin/events/photo').set(admin.auth)
      .attach('photo', Buffer.from('<svg/>'), { filename: 'e.svg', contentType: 'image/svg+xml' })
    expect(bad.status).toBe(400)
  })
})

describe('admin', () => {
  it('every admin route refuses ordinary members and anonymous callers', async () => {
    const member = await makeUser()
    const target = await makeUser()
    const id = target.id
    const routes = [
      ['get', '/api/admin/users'], ['put', `/api/admin/users/${id}/warn`], ['put', `/api/admin/users/${id}/suspend`],
      ['put', `/api/admin/users/${id}/unsuspend`], ['put', `/api/admin/users/${id}/ban`], ['put', `/api/admin/users/${id}/unban`],
      ['post', `/api/admin/users/${id}/action`], ['get', `/api/admin/users/${id}/notes`], ['post', `/api/admin/users/${id}/notes`],
      ['put', `/api/admin/users/${id}/notes`], ['delete', `/api/admin/users/${id}/notes?noteId=x`],
      ['post', '/api/admin/events'], ['put', `/api/admin/events/${id}`], ['put', `/api/admin/events/${id}/cancel`],
      ['put', `/api/admin/events/${id}/uncancel`], ['put', `/api/admin/events/${id}/toggle-visibility`],
      ['get', `/api/admin/events/${id}/attendees`], ['delete', `/api/admin/events/${id}`],
      ['post', '/api/admin/news'], ['get', '/api/admin/news'], ['delete', '/api/admin/news?id=x'],
      ['get', '/api/admin/reports'], ['put', `/api/admin/reports/${id}`], ['get', '/api/admin/stats'],
    ]
    for (const [method, url] of routes) {
      const asMember = await ctx.api[method](url).set(member.auth).send({ action: 'ban', content: 'x', message: 'x' })
      expect([method, url, asMember.status]).toEqual([method, url, 403])
      const anonymous = await ctx.api[method](url).send({})
      expect([method, url, anonymous.status]).toEqual([method, url, 401])
    }
    const photo = await ctx.api.post('/api/admin/events/photo').set(member.auth)
      .attach('photo', TINY_PNG, { filename: 'e.png', contentType: 'image/png' })
    expect(photo.status).toBe(403)
    expect((await User.findById(id)).is_banned).toBe(false)
  })

  it('lists and searches members without leaking password hashes', async () => {
    const admin = await makeAdmin()
    const target = await makeUser({ first_name: 'Zebediah' })
    const all = await ctx.api.get('/api/admin/users').set(admin.auth)
    expect(all.status).toBe(200)
    expect(JSON.stringify(all.body)).not.toMatch(/\$2[aby]\$/)
    const found = await ctx.api.get('/api/admin/users?search=zebed').set(admin.auth)
    expect(found.body.users.map((u) => String(u.id))).toEqual([target.id])
    const regex = await ctx.api.get('/api/admin/users?search=.*').set(admin.auth)
    expect(regex.body.users).toHaveLength(0) // treated as text, not a pattern
  })

  it('warn, suspend, unsuspend, ban, unban and remove warning all work and are recorded', async () => {
    const admin = await makeAdmin()
    const target = await makeUser()
    const act = (action, message) => ctx.api.post(`/api/admin/users/${target.id}/action`).set(admin.auth).send({ action, message })

    expect((await act('warn', 'Please be kind')).status).toBe(200)
    let user = await User.findById(target.id)
    expect([user.warnings, user.status]).toEqual([1, 'warned'])
    expect(await Notification.countDocuments({ user_id: target.id, title: 'Account Warning' })).toBe(1)

    await act('suspend')
    expect((await ctx.api.get('/api/auth/me').set(target.auth)).status).toBe(403)
    await act('unsuspend')
    expect((await ctx.api.get('/api/auth/me').set(target.auth)).status).toBe(200)

    await act('ban')
    expect((await ctx.api.post('/api/auth/login').send({ email: target.user.email, password: PASSWORD })).status).toBe(403)
    await act('unban')
    expect((await ctx.api.post('/api/auth/login').send({ email: target.user.email, password: PASSWORD })).status).toBe(200)

    await act('remove_warning')
    user = await User.findById(target.id)
    expect([user.warnings, user.status]).toEqual([0, 'active'])
    expect(user.moderation_history.map((h) => h.action)).toEqual(['warn', 'suspend', 'unsuspend', 'ban', 'unban', 'remove_warning'])
    expect(user.moderation_history[0]).toMatchObject({ reason: 'Please be kind', admin: admin.user.email })

    expect((await act('explode')).status).toBe(400)
    // The member never sees the moderation record.
    const me = await ctx.api.get('/api/auth/me').set(target.auth)
    expect(me.body.user).not.toHaveProperty('moderation_history')
  })

  it('cannot ban or suspend an admin (including yourself)', async () => {
    const admin = await makeAdmin()
    const otherAdmin = await makeAdmin()
    for (const id of [admin.id, otherAdmin.id]) {
      const res = await ctx.api.post(`/api/admin/users/${id}/action`).set(admin.auth).send({ action: 'ban' })
      expect(res.status).toBe(400)
    }
    expect((await User.findById(admin.id)).is_banned).toBe(false)
  })

  it('notes can be added, edited, listed and deleted', async () => {
    const admin = await makeAdmin()
    const target = await makeUser()
    const base = `/api/admin/users/${target.id}/notes`
    const added = await ctx.api.post(base).set(admin.auth).send({ content: 'First contact made' })
    expect(added.status).toBe(201)
    expect((await ctx.api.post(base).set(admin.auth).send({ content: '  ' })).status).toBe(400)
    const edited = await ctx.api.put(base).set(admin.auth).send({ noteId: added.body.id, content: 'Edited note' })
    expect(edited.body.content).toBe('Edited note')
    expect((await ctx.api.get(base).set(admin.auth)).body.map((n) => n.content)).toEqual(['Edited note'])
    expect((await ctx.api.delete(`${base}?noteId=${added.body.id}`).set(admin.auth)).status).toBe(200)
    expect((await ctx.api.get(base).set(admin.auth)).body).toHaveLength(0)
  })

  it('announcements go to members who want them and can be withdrawn', async () => {
    const admin = await makeAdmin()
    const wants = await makeUser()
    const optedOut = await makeUser()
    await UserNotificationSettings.create({ user_id: optedOut.id, admin_news: false })

    expect((await ctx.api.post('/api/admin/news').set(admin.auth).send({ title: 'Empty' })).status).toBe(400)
    const sent = await ctx.api.post('/api/admin/news').set(admin.auth).send({ title: 'Picnic moved', message: 'Now on Sunday.' })
    expect(sent.status).toBe(200)
    expect(await Notification.countDocuments({ user_id: wants.id, announcement_id: sent.body.id })).toBe(1)
    expect(await Notification.countDocuments({ user_id: optedOut.id, announcement_id: sent.body.id })).toBe(0)

    const list = await ctx.api.get('/api/admin/news').set(admin.auth)
    expect(list.body.find((a) => a.id === sent.body.id)).toMatchObject({ title: 'Picnic moved', message: 'Now on Sunday.' })

    const removed = await ctx.api.delete(`/api/admin/news?id=${sent.body.id}`).set(admin.auth)
    expect(removed.body.removed).toBeGreaterThan(0)
    expect(await Notification.countDocuments({ announcement_id: sent.body.id })).toBe(0)
  })

  it('stats add up', async () => {
    const admin = await makeAdmin()
    const res = await ctx.api.get('/api/admin/stats').set(admin.auth)
    expect(res.status).toBe(200)
    expect(res.body.users.total).toBe(await User.countDocuments())
    expect(res.body.reports.pending).toBe(await Report.countDocuments({ status: 'pending' }))
  })
})
