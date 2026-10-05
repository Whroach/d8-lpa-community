import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { startApp, makeUser, makeMatch, getOutbox, clearOutbox } from './helpers.js'
import Event from '../src/models/Event.js'
import UserNotificationSettings from '../src/models/UserNotificationSettings.js'
import { sendDigests } from '../src/jobs/digest.js'
import { isWithinQuietHoursServer } from '../src/jobs/quiet-hours.js'
import { isLocalMongoUri } from '../src/utils/script-env.js'
import { calculateAge, keepOwnPhotos, normalizeLookingFor } from '../src/utils/helpers.js'

let ctx
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await ctx.stop() })
beforeEach(() => clearOutbox())

// Midday US Central, so the default quiet hours never interfere.
const NOON = new Date('2026-10-06T18:00:00Z')

describe('email summary (through the captured mail seam - nothing is really sent)', () => {
  it('goes only to members who opted in, without message text, and not twice in a row', async () => {
    const reader = await makeUser({ first_name: 'Opted' })
    const writer = await makeUser({ first_name: 'Writer' })
    const other = await makeUser({ first_name: 'NotOpted' })
    const match = await makeMatch(reader, writer)
    await makeMatch(other, writer)
    await ctx.api.post(`/api/messages/${match._id}`).set(writer.auth).send({ content: 'A private sentence about tomatoes' })
    await Event.create({
      title: 'Autumn Social', location: 'Test Hall', created_by: writer.id,
      start_date: new Date(NOON.getTime() + 3 * 86400000)
    })
    await ctx.api.put('/api/settings').set(reader.auth).send({ notifications: { email_digest: true } })

    const first = await sendDigests({ now: NOON })
    expect(first).toEqual({ considered: 1, sent: 1 })
    const mail = getOutbox()
    expect(mail).toHaveLength(1)
    expect(mail[0].to).toBe(reader.user.email)
    expect(mail[0].subject).toMatch(/1 new message/)
    expect(mail[0].text).toContain('Writer: 1 new message')
    expect(mail[0].text).toContain('Autumn Social')
    expect(mail[0].html + mail[0].text).not.toContain('tomatoes')

    const again = await sendDigests({ now: new Date(NOON.getTime() + 3600 * 1000) })
    expect(again.sent).toBe(0)
    const later = await sendDigests({ now: new Date(NOON.getTime() + 4 * 86400000) })
    expect(later.sent).toBe(1)
  })

  it('skips paused or unverified accounts, quiet hours, and members with nothing waiting', async () => {
    await Event.deleteMany({})
    const paused = await makeUser({ is_disabled: true })
    const unverified = await makeUser({ email_verified: false })
    const nothingWaiting = await makeUser()
    const quiet = await makeUser()
    const writer = await makeUser()
    for (const m of [paused, unverified, quiet]) {
      const match = await makeMatch(m, writer)
      await ctx.api.post(`/api/messages/${match._id}`).set(writer.auth).send({ content: 'hello' })
    }
    for (const m of [paused, unverified, nothingWaiting]) {
      await UserNotificationSettings.create({ user_id: m.id, email_digest: true })
    }
    await UserNotificationSettings.create({
      user_id: quiet.id, email_digest: true, quiet_hours_enabled: true, quiet_hours_start: '00:00', quiet_hours_end: '23:59'
    })
    await UserNotificationSettings.updateMany({ email_digest_last_sent: { $ne: null } }, { email_digest: false })

    const result = await sendDigests({ now: NOON })
    expect(result.sent).toBe(0)
    expect(getOutbox()).toHaveLength(0)
  })
})

describe('small helpers', () => {
  it('quiet hours on the server use the community time zone', () => {
    const settings = { quiet_hours_enabled: true, quiet_hours_start: '21:00', quiet_hours_end: '08:00' }
    expect(isWithinQuietHoursServer(settings, new Date('2026-10-06T04:00:00Z'))).toBe(true) // 11pm Central
    expect(isWithinQuietHoursServer(settings, NOON)).toBe(false)
    expect(isWithinQuietHoursServer({ ...settings, quiet_hours_enabled: false }, new Date('2026-10-06T04:00:00Z'))).toBe(false)
  })

  it('only a local database counts as local', () => {
    expect(isLocalMongoUri('mongodb://127.0.0.1:27017/x')).toBe(true)
    expect(isLocalMongoUri('mongodb://localhost/x')).toBe(true)
    expect(isLocalMongoUri('mongodb+srv://user:pw@cluster.example.net/x')).toBe(false)
    expect(isLocalMongoUri('mongodb://user:pw@db.example.net:27017/x')).toBe(false)
    expect(isLocalMongoUri('mongodb://localhost,db.example.net/x')).toBe(false)
    expect(isLocalMongoUri(undefined)).toBe(false)
  })

  it('age, photo lists and "who I want to meet"', () => {
    expect(calculateAge('1980-10-05', new Date('2026-10-04'))).toBe(45)
    expect(calculateAge('1980-10-04', new Date('2026-10-04'))).toBe(46)
    expect(calculateAge(undefined)).toBeNull()
    expect(keepOwnPhotos(['b', 'x', 'a', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
    expect(keepOwnPhotos('nope', ['a'])).toEqual(['a'])
    expect(normalizeLookingFor(['Non-Binary', 'female', 'robots', 'female'])).toEqual(['non_binary', 'female'])
  })
})
