import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startApp, makeUser, makeAdmin } from './helpers.js'
import User from '../src/models/User.js'
import Report from '../src/models/Report.js'
import Notification from '../src/models/Notification.js'
import ModerationAction from '../src/models/ModerationAction.js'
import { seedBulk, clearBulk } from '../src/dev/seed-bulk.js'

let ctx
let admin
beforeAll(async () => {
  ctx = await startApp()
  admin = await makeAdmin({ first_name: 'Avery', last_name: 'Moderator' })
})
afterAll(async () => { await ctx.stop() })

const act = (userId, body, as = admin) => ctx.api.post(`/api/admin/users/${userId}/action`).set(as.auth).send(body)
const log = (query = '') => ctx.api.get(`/api/admin/audit-log${query}`).set(admin.auth)

describe('suspending and banning need a reason', () => {
  it('refuses a suspension or ban with no reason, or a blank one, and changes nothing', async () => {
    const person = await makeUser()
    for (const action of ['suspend', 'ban']) {
      for (const body of [{ action }, { action, message: '   ' }, { action, message: 42 }]) {
        const res = await act(person.id, body)
        expect(res.status, JSON.stringify(body)).toBe(400)
        expect(res.body.message).toMatch(/Please give a reason/)
      }
      // The older one-purpose routes follow the same rule.
      const old = await ctx.api.put(`/api/admin/users/${person.id}/${action}`).set(admin.auth).send({})
      expect(old.status).toBe(400)
    }
    const after = await User.findById(person.id)
    expect([after.is_suspended, after.is_banned, after.status]).toEqual([false, false, 'active'])
    expect(after.moderation_history).toHaveLength(0)
    expect(await ModerationAction.countDocuments({ target_user: person.id })).toBe(0)
    expect(await Notification.countDocuments({ user_id: person.id })).toBe(0)
    // They can still use the app.
    expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(200)
  })

  it('a warning, and lifting a suspension or ban, do not need one', async () => {
    const person = await makeUser()
    expect((await act(person.id, { action: 'warn' })).status).toBe(200)
    expect((await act(person.id, { action: 'suspend', message: 'Cooling off' })).status).toBe(200)
    expect((await act(person.id, { action: 'unsuspend' })).status).toBe(200)
    expect((await act(person.id, { action: 'ban', message: 'Harassment' })).status).toBe(200)
    expect((await act(person.id, { action: 'unban' })).status).toBe(200)
    expect((await act(person.id, { action: 'remove_warning' })).status).toBe(200)
  })

  it('the older routes still answer as before when given a reason, and are logged too', async () => {
    const person = await makeUser()
    const warned = await ctx.api.put(`/api/admin/users/${person.id}/warn`).set(admin.auth).send({ reason: 'Be kind' })
    expect(warned.body).toEqual({ success: true, warnings: 1 })
    expect((await ctx.api.put(`/api/admin/users/${person.id}/suspend`).set(admin.auth).send({ reason: 'A week off' })).body).toEqual({ success: true })
    expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(403)
    expect((await ctx.api.put(`/api/admin/users/${person.id}/unsuspend`).set(admin.auth)).body).toEqual({ success: true })
    expect((await ctx.api.put(`/api/admin/users/${person.id}/ban`).set(admin.auth).send({ reason: 'Scam' })).body).toEqual({ success: true })
    expect((await ctx.api.put(`/api/admin/users/${person.id}/unban`).set(admin.auth)).body).toEqual({ success: true })
    expect((await ctx.api.get('/api/auth/me').set(person.auth)).status).toBe(200)
    const entries = await ModerationAction.find({ target_user: person.id }).sort({ created_at: 1, _id: 1 })
    expect(entries.map((e) => e.action)).toEqual(['warn', 'suspend', 'unsuspend', 'ban', 'unban'])
    expect((await ctx.api.put(`/api/admin/users/0123456789abcdef01234567/unban`).set(admin.auth)).status).toBe(404)
  })
})

describe('the activity log', () => {
  it('records who, to whom, when, what and why for every action, and nothing for a refused one', async () => {
    const person = await makeUser({ first_name: 'Noel', last_name: 'Example' })
    const before = Date.now()
    const done = await act(person.id, { action: 'suspend', message: '  Sent unkind messages after being asked to stop.  ' })
    expect(done.status).toBe(200)
    expect(done.body.user).toMatchObject({ is_suspended: true, is_banned: false, status: 'suspended' })
    expect(done.body.action_id).toBeTruthy()

    const entry = await ModerationAction.findById(done.body.action_id)
    expect(entry.toObject()).toMatchObject({
      action: 'suspend',
      target_user: person.id,
      target_name: 'Noel Example',
      target_email: person.user.email,
      admin_id: admin.id,
      admin_name: 'Avery Moderator',
      admin_email: admin.user.email,
      reason: 'Sent unkind messages after being asked to stop.',
      report_id: null,
    })
    expect(entry.created_at.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(entry.created_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000)

    // Refused: on an admin, on yourself, unknown action, unknown member.
    const count = await ModerationAction.countDocuments()
    const otherAdmin = await makeAdmin()
    expect((await act(otherAdmin.id, { action: 'ban', message: 'x' })).status).toBe(400)
    expect((await act(admin.id, { action: 'suspend', message: 'x' })).status).toBe(400)
    expect((await act(person.id, { action: 'promote', message: 'x' })).status).toBe(400)
    expect((await act('0123456789abcdef01234567', { action: 'ban', message: 'x' })).status).toBe(404)
    expect(await ModerationAction.countDocuments()).toBe(count)

    // Lifting it is logged as well, with its optional reason.
    expect((await act(person.id, { action: 'unsuspend', message: 'Apologised.' })).status).toBe(200)
    const mine = await log(`?user_id=${person.id}`)
    expect(mine.status).toBe(200)
    expect(mine.body.total).toBe(2)
    expect(mine.body.entries.map((e) => [e.action, e.reason])).toEqual([
      ['unsuspend', 'Apologised.'],
      ['suspend', 'Sent unkind messages after being asked to stop.'],
    ])
    expect(mine.body.entries[0]).toMatchObject({
      target: { id: person.id, name: 'Noel Example', email: person.user.email },
      admin: { id: admin.id, name: 'Avery Moderator', email: admin.user.email },
    })
  })

  it('can be searched, filtered by action and paged; members cannot read it', async () => {
    const person = await makeUser({ first_name: 'Winifred', last_name: 'Quillfeather' })
    for (let i = 0; i < 3; i += 1) await act(person.id, { action: 'warn', message: `Reminder number ${i + 1}` })
    await act(person.id, { action: 'ban', message: 'Zanzibar-unique-reason' })

    const byName = await log('?q=quillfeather')
    expect(byName.body.total).toBe(4)
    expect((await log('?q=Zanzibar-unique')).body.entries.map((e) => e.action)).toEqual(['ban'])
    expect((await log('?q=.*')).body.total).toBe(0) // typed text is not a pattern
    expect((await log('?q=quillfeather&action=warn')).body.total).toBe(3)
    expect((await log('?action=explode')).status).toBe(400)

    const first = await log('?q=quillfeather&limit=3&page=1')
    const second = await log('?q=quillfeather&limit=3&page=2')
    expect([first.body.entries.length, second.body.entries.length]).toEqual([3, 1])
    expect([first.body.page, first.body.totalPages, second.body.page]).toEqual([1, 2, 2])
    // Newest first.
    expect(first.body.entries[0].action).toBe('ban')
    // A page past the end gives the last page.
    expect((await log('?q=quillfeather&limit=3&page=99')).body.page).toBe(2)

    const member = await makeUser()
    expect((await ctx.api.get('/api/admin/audit-log').set(member.auth)).status).toBe(403)
    expect((await ctx.api.get('/api/admin/audit-log')).status).toBe(401)
    // The member it is about never sees any of it.
    await act(person.id, { action: 'unban' })
    const me = await ctx.api.get('/api/auth/me').set(person.auth)
    expect(JSON.stringify(me.body)).not.toMatch(/Zanzibar|moderation_history/)
  })
})

describe('acting on a report', () => {
  const fileReport = async (reported, reporter) => Report.create({
    reporter: reporter.id, reported_user: reported.id, category: 'Rude or abusive messages', reason: 'Unkind words.', source: 'chat',
  })

  it('suspending from a report closes it, links it in the log, and Undo puts it back', async () => {
    const reported = await makeUser({ first_name: 'Noel' })
    const reporter = await makeUser({ first_name: 'Gray' })
    const report = await fileReport(reported, reporter)

    // A report id that is not about this member is refused.
    const someoneElse = await makeUser()
    expect((await act(someoneElse.id, { action: 'suspend', message: 'x', report_id: report.id })).status).toBe(400)
    expect((await act(reported.id, { action: 'suspend', message: 'x', report_id: 'nonsense' })).status).toBe(400)
    expect((await User.findById(reported.id)).is_suspended).toBe(false)

    const done = await act(reported.id, { action: 'suspend', message: 'Unkind messages.', report_id: report.id })
    expect(done.status).toBe(200)
    let stored = await Report.findById(report.id)
    expect([stored.status, stored.action_taken, stored.reviewed_by]).toEqual(['resolved', 'suspension', admin.id])
    expect(stored.reviewed_at).toBeInstanceOf(Date)
    const entry = await ModerationAction.findById(done.body.action_id)
    expect(entry.report_id).toBe(report.id)
    expect((await User.findById(reported.id)).moderation_history.at(-1)).toMatchObject({ action: 'suspend', report_id: report.id })
    // The notice the member gets carries the reason and never the reporter.
    const notice = await Notification.findOne({ user_id: reported.id, title: 'Account Suspended' })
    expect(notice.message).toBe('Unkind messages.')
    expect(JSON.stringify(notice.toObject())).not.toMatch(new RegExp(`Gray|${reporter.id}|${reporter.user.email}`))

    // Undo: lifted, and the report is waiting again.
    const undone = await act(reported.id, { action: 'unsuspend', message: 'Undone straight away', report_id: report.id, reopen_report: true })
    expect(undone.status).toBe(200)
    stored = await Report.findById(report.id)
    expect([stored.status, stored.action_taken]).toEqual(['pending', 'none'])
    expect((await User.findById(reported.id)).is_suspended).toBe(false)
    expect((await ctx.api.get('/api/auth/me').set(reported.auth)).status).toBe(200)
    const trail = await log(`?user_id=${reported.id}`)
    expect(trail.body.entries.map((e) => [e.action, e.report_id])).toEqual([['unsuspend', report.id], ['suspend', report.id]])
  })

  it('warning and banning from a report record the right outcome', async () => {
    const reporter = await makeUser()
    for (const [action, outcome] of [['warn', 'warning'], ['ban', 'ban']]) {
      const reported = await makeUser()
      const report = await fileReport(reported, reporter)
      expect((await act(reported.id, { action, message: 'Reason given', report_id: report.id })).status).toBe(200)
      const stored = await Report.findById(report.id)
      expect([stored.status, stored.action_taken]).toEqual(['resolved', outcome])
    }
  })

  it('dismissing and reopening a report are logged', async () => {
    const reported = await makeUser({ first_name: 'Rowan', last_name: 'Example' })
    const report = await fileReport(reported, await makeUser())
    const put = (body) => ctx.api.put(`/api/admin/reports/${report.id}`).set(admin.auth).send(body)
    expect((await put({ status: 'dismissed', action_taken: 'none', reason: 'A misunderstanding.' })).status).toBe(200)
    expect((await put({ status: 'dismissed', action_taken: 'none' })).status).toBe(200) // no second entry
    expect((await put({ status: 'pending' })).status).toBe(200)
    const trail = await log(`?user_id=${reported.id}`)
    expect(trail.body.entries.map((e) => [e.action, e.reason, e.report_id, e.target.name])).toEqual([
      ['reopen_report', '', report.id, 'Rowan Example'],
      ['dismiss_report', 'A misunderstanding.', report.id, 'Rowan Example'],
    ])
    expect((await ctx.api.put('/api/admin/reports/0123456789abcdef01234567').set(admin.auth).send({ status: 'dismissed' })).status).toBe(404)
  })
})

describe('at the size of a real community (300 members, 250 reports)', () => {
  let counts
  beforeAll(async () => {
    const seeded = await seedBulk({ members: 300, reports: 250 })
    expect(seeded).toMatchObject({ skipped: false, members: 300, reports: 250 })
    expect((await seedBulk()).skipped).toBe(true) // never doubles up
    counts = {
      all: await User.countDocuments(),
      suspended: await User.countDocuments({ is_suspended: true }),
      banned: await User.countDocuments({ is_banned: true }),
    }
  })

  const users = (query = '') => ctx.api.get(`/api/admin/users${query}`).set(admin.auth)
  const reports = (query = '') => ctx.api.get(`/api/admin/reports${query}`).set(admin.auth)

  it('pages through members without repeating or missing anyone', async () => {
    const seen = new Set()
    const first = await users('?limit=25&page=1')
    expect(first.body.total).toBe(counts.all)
    expect(first.body.totalPages).toBe(Math.ceil(counts.all / 25))
    for (let page = 1; page <= first.body.totalPages; page += 1) {
      const res = await users(`?limit=25&page=${page}`)
      expect(res.body.page).toBe(page)
      expect(res.body.users.length).toBeLessThanOrEqual(25)
      for (const u of res.body.users) {
        expect(seen.has(String(u.id)), `member ${u.email} listed twice`).toBe(false)
        seen.add(String(u.id))
      }
    }
    expect(seen.size).toBe(counts.all)
    expect((await users('?limit=25&page=999')).body.page).toBe(first.body.totalPages)
    // Callers that ask for no page still get the first 500, as before.
    const plain = await users()
    expect(plain.body.users.length).toBe(Math.min(500, counts.all))
    expect(JSON.stringify(plain.body)).not.toMatch(/\$2[aby]\$/)
  })

  it('counts come from the whole community, not the page, and the filters agree with them', async () => {
    const page = await users('?limit=10&page=3&q=nightingale')
    expect(page.body.counts).toMatchObject({ all: counts.all, suspended: counts.suspended, banned: counts.banned })
    const { active, warned, suspended, banned, all } = page.body.counts
    expect(suspended).toBeGreaterThan(5)
    expect(banned).toBeGreaterThan(5)
    expect(warned).toBeGreaterThan(5)
    expect(active + warned + suspended + banned).toBe(all)
    for (const [status, expected] of [['active', active], ['warned', warned], ['suspended', suspended], ['banned', banned], ['all', all]]) {
      const res = await users(`?status=${status}&limit=5`)
      expect(res.body.total, status).toBe(expected)
    }
    expect((await users('?status=suspended&limit=100')).body.users.every((u) => u.is_suspended)).toBe(true)
    expect((await users('?status=active&limit=100')).body.users.every((u) => !u.is_suspended && !u.is_banned && !u.warnings)).toBe(true)
    expect((await users('?status=nonsense')).status).toBe(400)
  })

  it('searches members by name, full name, email and id, together with a filter', async () => {
    expect((await users('?q=nightingale&limit=100')).body.total).toBe(20)
    expect((await users('?q=NIGHTINGALE%20pearl')).body.users.map((u) => `${u.first_name} ${u.last_name}`)).toEqual(['Pearl Nightingale'])
    expect((await users('?q=bulk-member-042@example.test')).body.users).toHaveLength(1)
    // The older parameter name still works.
    expect((await users('?search=bulk-member-042')).body.users).toHaveLength(1)
    const one = (await users('?q=bulk-member-042')).body.users[0]
    expect((await users(`?q=${one.id}`)).body.users.map((u) => u.email)).toEqual(['bulk-member-042@example.test'])
    expect((await users('?q=nobody-by-this-name')).body).toMatchObject({ total: 0, users: [], page: 1, totalPages: 1 })
    const both = await users('?q=nightingale&status=suspended&limit=100')
    expect(both.body.total).toBeGreaterThan(0)
    expect(both.body.users.every((u) => u.last_name === 'Nightingale' && u.is_suspended)).toBe(true)
  })

  it('pages, filters and searches reports, with counts from the server', async () => {
    const first = await reports('?page=1&limit=10')
    expect(first.body.counts).toEqual({
      pending: await Report.countDocuments({ status: 'pending' }),
      resolved: await Report.countDocuments({ status: 'resolved' }),
      dismissed: await Report.countDocuments({ status: 'dismissed' }),
      all: await Report.countDocuments(),
    })
    expect(first.body.total).toBe(first.body.counts.pending)
    expect(first.body.reports).toHaveLength(10)
    expect(first.body.totalPages).toBe(Math.ceil(first.body.counts.pending / 10))
    const seen = new Set()
    for (let page = 1; page <= first.body.totalPages; page += 1) {
      for (const r of (await reports(`?page=${page}&limit=10`)).body.reports) seen.add(String(r.id))
    }
    expect(seen.size).toBe(first.body.counts.pending)
    expect((await reports('?page=1&status=dismissed')).body.reports.every((r) => r.status === 'dismissed')).toBe(true)
    expect((await reports('?page=1&status=all')).body.total).toBe(first.body.counts.all)

    // By a person's name (either side of the report), or by words in it.
    const byName = await reports('?page=1&limit=100&status=all&q=pearl%20nightingale')
    expect(byName.body.total).toBeGreaterThan(0)
    expect(byName.body.reports.every((r) => [r.reported_user, r.reporter].some((p) => p.first_name === 'Pearl' && p.last_name === 'Nightingale'))).toBe(true)
    const byWords = await reports('?page=1&limit=100&status=all&q=asked%20for%20a%20loan')
    expect(byWords.body.total).toBe(await Report.countDocuments({ reason: /Asked for a loan/ }))
    expect((await reports('?page=1&q=.*')).body.total).toBe(0)

    // Callers that ask for no page still get the plain list (up to 200).
    const plain = await reports()
    expect(Array.isArray(plain.body)).toBe(true)
    expect(plain.body.length).toBe(Math.min(200, first.body.counts.pending))
  })

  it('acting on a member on a later page leaves every other page as it was', async () => {
    const before = await users('?limit=25&page=4')
    const target = before.body.users.find((u) => !u.is_suspended && !u.is_banned)
    expect((await act(target.id, { action: 'suspend', message: 'Test' })).status).toBe(200)
    const after = await users('?limit=25&page=4')
    expect(after.body.users.map((u) => String(u.id))).toEqual(before.body.users.map((u) => String(u.id)))
    expect(after.body.users.find((u) => String(u.id) === String(target.id)).is_suspended).toBe(true)
    expect(after.body.counts.suspended).toBe(before.body.counts.suspended + 1)
  })

  it('the bulk data can be removed again without touching anyone else', async () => {
    const others = await User.countDocuments({ email: { $not: /^bulk-member-/ } })
    const cleared = await clearBulk()
    expect(cleared.members).toBe(300)
    expect(await User.countDocuments()).toBe(others)
    expect(await Report.countDocuments({ category: 'Something else' })).toBe(0)
  })
})
