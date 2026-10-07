import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startApp, makeUser, makeAdmin, TINY_PNG } from './helpers.js'
import User from '../src/models/User.js'
import Event from '../src/models/Event.js'

let ctx
let admin
let member
let target
let event
beforeAll(async () => {
  ctx = await startApp()
  admin = await makeAdmin()
  member = await makeUser()
  target = await makeUser()
  event = await Event.create({ title: 'Test picnic', location: 'Testville', start_date: new Date(Date.now() + 86400000), created_by: admin.id })
})
afterAll(async () => { await ctx.stop() })

const FAKE_ID = '0123456789abcdef01234567'

// Every route the admin router defines. If a route is added to
// server/src/routes/admin.js, add it here too.
const routes = () => [
  ['get', '/api/admin/users'],
  ['put', `/api/admin/users/${target.id}/warn`, { reason: 'x' }],
  ['put', `/api/admin/users/${target.id}/suspend`, { reason: 'x' }],
  ['put', `/api/admin/users/${target.id}/unsuspend`],
  ['put', `/api/admin/users/${target.id}/ban`, { reason: 'x' }],
  ['put', `/api/admin/users/${target.id}/unban`],
  ...['warn', 'suspend', 'unsuspend', 'ban', 'unban', 'remove_warning'].map((action) => ['post', `/api/admin/users/${target.id}/action`, { action, message: 'x' }]),
  ['get', `/api/admin/users/${target.id}/notes`],
  ['post', `/api/admin/users/${target.id}/notes`, { content: 'note' }],
  ['put', `/api/admin/users/${target.id}/notes`, { noteId: FAKE_ID, content: 'note' }],
  ['delete', `/api/admin/users/${target.id}/notes?noteId=${FAKE_ID}`],
  ['post', '/api/admin/events/photo'],
  ['post', '/api/admin/events', { title: 'Sneaky', location: 'x', start_date: new Date().toISOString() }],
  ['put', `/api/admin/events/${event._id}`, { title: 'Renamed by a non-admin' }],
  ['put', `/api/admin/events/${event._id}/toggle-visibility`],
  ['put', `/api/admin/events/${event._id}/cancel`],
  ['put', `/api/admin/events/${event._id}/uncancel`],
  ['get', `/api/admin/events/${event._id}/attendees`],
  ['delete', `/api/admin/events/${event._id}`],
  ['post', '/api/admin/news', { title: 'Hi', message: 'From a non-admin' }],
  ['get', '/api/admin/news'],
  ['delete', '/api/admin/news?id=abc'],
  ['get', '/api/admin/reports'],
  ['put', `/api/admin/reports/${FAKE_ID}`, { status: 'dismissed' }],
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/audit-log'],
]

describe('admin routes are for admins only', () => {
  it('covers every route the admin router defines', async () => {
    const { default: router } = await import('../src/routes/admin.js')
    const defined = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`)
    const shape = (path) => path
      .replace('/api/admin', '')
      .replace(/\?.*$/, '')
      .replace(new RegExp(`/users/${target.id}`), '/users/:userId')
      .replace(new RegExp(`/events/${event._id}`), '/events/:eventId')
      .replace(new RegExp(`/reports/${FAKE_ID}`), '/reports/:reportId')
    const covered = new Set(routes().map(([method, path]) => `${method} ${shape(path)}`))
    expect(defined.length).toBeGreaterThan(20)
    for (const route of defined) expect(covered, `no access test for ${route}`).toContain(route)
  })

  it('refuses a signed-in member on every route (403) and changes nothing', async () => {
    for (const [method, path, body] of routes()) {
      const res = await ctx.api[method](path).set(member.auth).send(body)
      expect(res.status, `${method} ${path}`).toBe(403)
    }
    const after = await User.findById(target.id)
    expect(after.warnings).toBe(0)
    expect(after.is_banned).toBe(false)
    expect(after.is_suspended).toBe(false)
    expect(after.admin_notes).toHaveLength(0)
    const sameEvent = await Event.findById(event._id)
    expect(sameEvent.title).toBe('Test picnic')
    expect(sameEvent.is_cancelled).toBe(false)
    expect(await Event.countDocuments()).toBe(1)
  })

  it('refuses a request with no token or a bad token on every route (401)', async () => {
    for (const [method, path, body] of routes()) {
      const anonymous = await ctx.api[method](path).send(body)
      expect(anonymous.status, `${method} ${path}`).toBe(401)
      const forged = await ctx.api[method](path).set('Authorization', 'Bearer not-a-real-token').send(body)
      expect(forged.status, `${method} ${path} (bad token)`).toBe(401)
    }
  })

  it('a member who is made admin, then has it taken away, loses access at once', async () => {
    const person = await makeUser()
    await User.updateOne({ _id: person.id }, { role: 'admin' })
    expect((await ctx.api.get('/api/admin/stats').set(person.auth)).status).toBe(200)
    await User.updateOne({ _id: person.id }, { role: 'user' })
    expect((await ctx.api.get('/api/admin/stats').set(person.auth)).status).toBe(403)
  })
})

describe('moderation', () => {
  it('cannot be turned on an admin or on yourself - by the action route or the older routes', async () => {
    const otherAdmin = await makeAdmin()
    for (const victim of [admin, otherAdmin]) {
      for (const action of ['warn', 'suspend', 'ban']) {
        const viaAction = await ctx.api.post(`/api/admin/users/${victim.id}/action`).set(admin.auth).send({ action, message: 'x' })
        expect(viaAction.status, `action ${action}`).toBe(400)
        const viaOld = await ctx.api.put(`/api/admin/users/${victim.id}/${action}`).set(admin.auth).send({ reason: 'x' })
        expect(viaOld.status, `put ${action}`).toBe(400)
      }
      const after = await User.findById(victim.id)
      expect(after.is_banned).toBe(false)
      expect(after.is_suspended).toBe(false)
      expect(after.warnings).toBe(0)
    }
  })

  it('warn, suspend, ban and their reversals work, keep a history, and take effect at sign-in and mid-session', async () => {
    const person = await makeUser()
    const act = (action) => ctx.api.post(`/api/admin/users/${person.id}/action`).set(admin.auth).send({ action, message: `Reason for ${action}` })

    expect((await act('warn')).status).toBe(200)
    expect((await User.findById(person.id)).warnings).toBe(1)
    // A warning does not lock anyone out.
    expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(200)

    for (const [on, off] of [['suspend', 'unsuspend'], ['ban', 'unban']]) {
      expect((await act(on)).status).toBe(200)
      // Mid-session: the token they already hold stops working.
      expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(403)
      expect((await ctx.api.get('/api/browse').set(person.auth)).status).toBe(403)
      // At sign-in.
      const login = await ctx.api.post('/api/auth/login').send({ email: person.user.email, password: 'Test-Pass-1234!' })
      expect(login.status).toBe(403)
      expect(login.body.message).toMatch(/suspended or banned/)
      expect(login.body.token).toBeUndefined()

      expect((await act(off)).status).toBe(200)
      expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(200)
      expect((await ctx.api.post('/api/auth/login').send({ email: person.user.email, password: 'Test-Pass-1234!' })).status).toBe(200)
    }

    expect((await act('remove_warning')).status).toBe(200)
    const after = await User.findById(person.id)
    expect(after.warnings).toBe(0)
    expect(after.status).toBe('active')
    expect(after.moderation_history.map((h) => h.action)).toEqual(['warn', 'suspend', 'unsuspend', 'ban', 'unban', 'remove_warning'])
    expect(after.moderation_history[0]).toMatchObject({ reason: 'Reason for warn', admin: admin.user.email })

    expect((await ctx.api.post(`/api/admin/users/${person.id}/action`).set(admin.auth).send({ action: 'promote' })).status).toBe(400)
    expect((await ctx.api.post(`/api/admin/users/${FAKE_ID}/action`).set(admin.auth).send({ action: 'warn' })).status).toBe(404)
    expect([400, 404]).toContain((await ctx.api.post('/api/admin/users/not-an-id/action').set(admin.auth).send({ action: 'warn' })).status)
  })

  it('lists members with search and pages, and counts them in the stats', async () => {
    const unique = await makeUser({ first_name: 'Zebedee', last_name: 'Quillfeather' })
    const all = await ctx.api.get('/api/admin/users').set(admin.auth)
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(await User.countDocuments())
    const row = all.body.users.find((u) => String(u.id) === unique.id)
    expect(row).toMatchObject({ first_name: 'Zebedee', email: unique.user.email, warnings: 0, is_banned: false, is_suspended: false })
    expect(row).not.toHaveProperty('password')

    const found = await ctx.api.get('/api/admin/users?search=quillfea').set(admin.auth)
    expect(found.body.users.map((u) => String(u.id))).toEqual([unique.id])
    // A search pattern is treated as plain text, not as a regular expression.
    expect((await ctx.api.get('/api/admin/users?search=.*').set(admin.auth)).body.users).toHaveLength(0)

    const paged = await ctx.api.get('/api/admin/users?limit=2&page=2').set(admin.auth)
    expect(paged.body.users.length).toBeLessThanOrEqual(2)
    expect(paged.body.page).toBe(2)
    expect(paged.body.totalPages).toBe(Math.ceil(all.body.total / 2))

    const stats = await ctx.api.get('/api/admin/stats').set(admin.auth)
    expect(stats.body.users.total).toBe(all.body.total)
    expect(stats.body.events.total).toBe(await Event.countDocuments())
    expect(stats.body.reports.pending).toBe(0)
  })
})

describe('admin events', () => {
  it('editing can clear the end time, the limit and the photo, and never moves an untouched date', async () => {
    const photo = await ctx.api.post('/api/admin/events/photo').set(admin.auth).attach('photo', TINY_PNG, { filename: 'e.png', contentType: 'image/png' })
    expect(photo.status).toBe(200)
    const notAPicture = await ctx.api.post('/api/admin/events/photo').set(admin.auth).attach('photo', Buffer.from('nope'), { filename: 'e.png', contentType: 'image/png' })
    expect(notAPicture.status).toBe(400)

    const made = await ctx.api.post('/api/admin/events').set(admin.auth).send({
      title: 'Supper', location: 'Hall', start_date: '2026-11-02T05:30:00.000Z', end_date: '2026-11-02T07:00:00.000Z', max_attendees: 20, image: photo.body.url, category: 'social',
    })
    expect(made.status).toBe(201)

    const renamed = await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send({ title: 'Harvest supper' })
    expect(renamed.status).toBe(200)
    expect(new Date(renamed.body.start_date).toISOString()).toBe('2026-11-02T05:30:00.000Z')
    expect(new Date(renamed.body.end_date).toISOString()).toBe('2026-11-02T07:00:00.000Z')
    expect(renamed.body.max_attendees).toBe(20)

    const cleared = await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send({ end_date: '', max_attendees: '', image: '' })
    expect(cleared.status).toBe(200)
    const stored = await Event.findById(made.body.id)
    expect(stored.end_date).toBeUndefined()
    expect(stored.max_attendees).toBeUndefined()
    expect(stored.image).toBeUndefined()
    expect(stored.start_date.toISOString()).toBe('2026-11-02T05:30:00.000Z')

    // The end still has to come after the start when only one of them changes.
    await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send({ end_date: '2026-11-02T07:00:00.000Z' })
    const tooLate = await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send({ start_date: '2026-11-03T00:00:00.000Z' })
    expect(tooLate.status).toBe(400)
    expect(tooLate.body.message).toMatch(/cannot end before it starts/)
    const tooEarly = await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send({ end_date: '2026-11-01T00:00:00.000Z' })
    expect(tooEarly.status).toBe(400)

    for (const bad of [{ title: ' ' }, { location: '' }, { start_date: 'tomorrow-ish' }, { category: 'rave' }, { max_attendees: 0 }]) {
      expect((await ctx.api.put(`/api/admin/events/${made.body.id}`).set(admin.auth).send(bad)).status, JSON.stringify(bad)).toBe(400)
    }
    expect((await ctx.api.put(`/api/admin/events/${FAKE_ID}`).set(admin.auth).send({ title: 'x' })).status).toBe(404)

    // Hide, show, cancel, restore, who is going, delete.
    expect((await ctx.api.put(`/api/admin/events/${made.body.id}/toggle-visibility`).set(admin.auth)).body.is_hidden).toBe(true)
    expect((await ctx.api.get('/api/events').set(member.auth)).body.some((e) => String(e.id) === String(made.body.id))).toBe(false)
    expect((await ctx.api.put(`/api/admin/events/${made.body.id}/toggle-visibility`).set(admin.auth)).body.is_hidden).toBe(false)
    expect((await ctx.api.post(`/api/events/${made.body.id}/join`).set(member.auth)).status).toBeLessThan(300)
    const going = await ctx.api.get(`/api/admin/events/${made.body.id}/attendees`).set(admin.auth)
    expect(going.body.map((a) => a.email)).toEqual([member.user.email])
    expect((await ctx.api.put(`/api/admin/events/${made.body.id}/cancel`).set(admin.auth)).status).toBe(200)
    expect((await Event.findById(made.body.id)).is_cancelled).toBe(true)
    expect((await ctx.api.put(`/api/admin/events/${made.body.id}/uncancel`).set(admin.auth)).status).toBe(200)
    expect((await Event.findById(made.body.id)).is_cancelled).toBe(false)
    expect((await ctx.api.delete(`/api/admin/events/${made.body.id}`).set(admin.auth)).status).toBe(200)
    expect(await Event.findById(made.body.id)).toBeNull()
    expect((await ctx.api.delete(`/api/admin/events/${made.body.id}`).set(admin.auth)).status).toBe(404)
  })
})
