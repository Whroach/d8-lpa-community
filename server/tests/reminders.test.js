import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startApp, makeUser, makeAdmin } from './helpers.js'
import Event from '../src/models/Event.js'
import Notification from '../src/models/Notification.js'
import { createDueEventReminders, reminderKind, reminderText, communityDay } from '../src/jobs/event-reminders.js'

let ctx
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await ctx.stop() })

const hours = (n) => new Date(Date.now() + n * 3600000)
const reminders = (member) => Notification.find({ user_id: member.id, type: 'event' }).sort({ timestamp: 1 })

async function makeEvent(owner, overrides = {}) {
  return Event.create({
    title: 'Fall Picnic', location: 'Mohawk Park, Shelter 3', created_by: owner.id,
    start_date: hours(24), ...overrides
  })
}

describe('event reminders: which day', () => {
  // Noon US Central on Friday 6 November 2026.
  const now = new Date('2026-11-06T18:00:00Z')

  it('is "day" for later today, "eve" for tomorrow, nothing otherwise (community clock)', () => {
    expect(reminderKind({ start_date: '2026-11-07T00:30:00Z' }, now)).toBe('day') // 6:30 PM today, Central
    expect(reminderKind({ start_date: '2026-11-07T05:30:00Z' }, now)).toBe('day') // 11:30 PM today, Central
    expect(reminderKind({ start_date: '2026-11-07T06:30:00Z' }, now)).toBe('eve') // 12:30 AM tomorrow, Central
    expect(reminderKind({ start_date: '2026-11-08T05:30:00Z' }, now)).toBe('eve') // 11:30 PM tomorrow
    expect(reminderKind({ start_date: '2026-11-08T06:30:00Z' }, now)).toBe(null) // the day after
    expect(reminderKind({ start_date: '2026-11-06T17:00:00Z' }, now)).toBe(null) // already started
    expect(reminderKind({ start_date: 'not a date' }, now)).toBe(null)
  })

  it('handles the days the clocks change', () => {
    // Clocks go back on Sunday 1 November 2026 (a 25-hour day in US Central).
    const saturdayNoon = new Date('2026-10-31T17:00:00Z')
    expect(communityDay(saturdayNoon)).toBe('2026-10-31')
    expect(reminderKind({ start_date: '2026-11-02T05:30:00Z' }, saturdayNoon)).toBe('eve') // Sun 11:30 PM CST
    expect(reminderKind({ start_date: '2026-11-02T06:30:00Z' }, saturdayNoon)).toBe(null) // Mon 12:30 AM CST
    // Clocks go forward on Sunday 14 March 2027 (a 23-hour day).
    const saturdayNight = new Date('2027-03-14T05:30:00Z') // Sat 11:30 PM CST
    expect(reminderKind({ start_date: '2027-03-14T20:00:00Z' }, saturdayNight)).toBe('eve') // Sun 3 PM CDT
    expect(reminderKind({ start_date: '2027-03-15T04:30:00Z' }, saturdayNight)).toBe('eve') // Sun 11:30 PM CDT
    expect(reminderKind({ start_date: '2027-03-15T05:30:00Z' }, saturdayNight)).toBe(null) // Mon 12:30 AM CDT
  })

  it('words the reminder with the time and its zone', () => {
    const text = reminderText({ title: 'Fall Picnic', location: 'Mohawk Park', start_date: '2026-11-07T00:30:00Z' }, 'day')
    expect(text.title).toBe('Today: Fall Picnic')
    expect(text.message).toBe('Today at 6:30 PM CST, Mohawk Park. You said you are going.')
    expect(reminderText({ title: 'Brunch', location: 'Cafe', start_date: '2026-07-04T16:00:00Z' }, 'eve').message)
      .toBe('Tomorrow at 11:00 AM CDT, Cafe. You said you are going.')
  })
})

describe('event reminders: who gets one', () => {
  it('a member who is going gets one when they open notifications - once only, counted as unread, linked to the event', async () => {
    const owner = await makeAdmin()
    const going = await makeUser()
    const notGoing = await makeUser()
    const event = await makeEvent(owner)
    await ctx.api.post(`/api/events/${event._id}/join`).set(going.auth).expect(200)

    const first = await ctx.api.get('/api/notifications').set(going.auth).expect(200)
    expect(first.body).toHaveLength(1)
    expect(first.body[0]).toMatchObject({ type: 'event', read: false, related_event: event._id.toString() })
    expect(first.body[0].title).toMatch(/^(Today|Tomorrow): Fall Picnic$/)
    expect(first.body[0].message).toContain('Mohawk Park, Shelter 3')

    // Asking again - by either route, several at once - never repeats it.
    await Promise.all([
      ctx.api.get('/api/notifications').set(going.auth),
      ctx.api.get('/api/notifications/unread-count').set(going.auth),
      ctx.api.get('/api/notifications').set(going.auth),
      createDueEventReminders(),
    ])
    expect(await reminders(going)).toHaveLength(1)
    expect((await ctx.api.get('/api/notifications/unread-count').set(going.auth)).body.count).toBe(1)

    expect((await ctx.api.get('/api/notifications').set(notGoing.auth)).body).toHaveLength(0)
  })

  it('two requests arriving together create one reminder, not two', async () => {
    const owner = await makeAdmin()
    const member = await makeUser()
    await makeEvent(owner, { attendees: [member.id] })
    await Promise.all(Array.from({ length: 6 }, () => ctx.api.get('/api/notifications/unread-count').set(member.auth)))
    expect(await reminders(member)).toHaveLength(1)
  })

  it('the day before and the day itself each get their own reminder', async () => {
    const owner = await makeAdmin()
    const member = await makeUser()
    const start = new Date('2026-11-08T00:30:00Z') // Sat 7 Nov, 6:30 PM Central
    const event = await makeEvent(owner, { start_date: start, attendees: [member.id] })

    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-05T18:00:00Z') })).toBe(0) // Thursday
    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-06T18:00:00Z') })).toBe(1) // Friday
    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-06T22:00:00Z') })).toBe(0)
    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-07T15:00:00Z') })).toBe(1) // Saturday
    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-07T20:00:00Z') })).toBe(0)
    expect(await createDueEventReminders({ userId: member.id, now: new Date('2026-11-08T01:00:00Z') })).toBe(0) // started

    const titles = (await reminders(member)).map((n) => n.title)
    expect(titles).toEqual(['Tomorrow: Fall Picnic', 'Today: Fall Picnic'])
    expect((await Event.findById(event._id)).reminders_sent.sort()).toEqual([`${member.id}:day`, `${member.id}:eve`])
  })

  it('a deleted reminder does not come back', async () => {
    const owner = await makeAdmin()
    const member = await makeUser()
    await makeEvent(owner, { attendees: [member.id] })
    const list = await ctx.api.get('/api/notifications').set(member.auth)
    await ctx.api.delete(`/api/notifications/${list.body[0].id}`).set(member.auth).expect(200)
    expect((await ctx.api.get('/api/notifications').set(member.auth)).body).toHaveLength(0)
  })

  it('no reminder after "I can\'t go", for cancelled, hidden, past or far-off events', async () => {
    const owner = await makeAdmin()
    const member = await makeUser()
    const left = await makeEvent(owner, { title: 'Left' })
    await ctx.api.post(`/api/events/${left._id}/join`).set(member.auth).expect(200)
    await ctx.api.post(`/api/events/${left._id}/leave`).set(member.auth).expect(200)
    await makeEvent(owner, { title: 'Cancelled', attendees: [member.id], is_cancelled: true })
    await makeEvent(owner, { title: 'Hidden', attendees: [member.id], is_hidden: true })
    await makeEvent(owner, { title: 'Past', attendees: [member.id], start_date: hours(-3) })
    await makeEvent(owner, { title: 'Next week', attendees: [member.id], start_date: hours(24 * 7) })

    expect((await ctx.api.get('/api/notifications').set(member.auth)).body).toHaveLength(0)
    expect(await createDueEventReminders()).toBe(0)
  })

  it('respects the Events notification switch', async () => {
    const owner = await makeAdmin()
    const member = await makeUser()
    await ctx.api.put('/api/settings').set(member.auth).send({ notifications: { events: false } }).expect(200)
    await makeEvent(owner, { attendees: [member.id] })
    expect((await ctx.api.get('/api/notifications').set(member.auth)).body).toHaveLength(0)
    // Switching it back on later does not produce a late reminder for the same day.
    await ctx.api.put('/api/settings').set(member.auth).send({ notifications: { events: true } }).expect(200)
    expect((await ctx.api.get('/api/notifications').set(member.auth)).body).toHaveLength(0)
  })

  it('the scheduled version reminds every attendee except banned, paused and closed accounts', async () => {
    const owner = await makeAdmin()
    const active = await makeUser()
    const banned = await makeUser({ is_banned: true })
    const paused = await makeUser({ is_disabled: true })
    const closed = await makeUser({ is_deleted: true })
    await makeEvent(owner, { title: 'Everyone', attendees: [active.id, banned.id, paused.id, closed.id] })

    expect(await createDueEventReminders()).toBe(1)
    expect(await reminders(active)).toHaveLength(1)
    for (const member of [banned, paused, closed]) expect(await reminders(member)).toHaveLength(0)
    // A banned member cannot trigger one through the API either.
    await ctx.api.get('/api/notifications').set(banned.auth).expect(403)
    expect(await reminders(banned)).toHaveLength(0)
  })

  it('a failure while preparing reminders does not stop notifications loading', async () => {
    const member = await makeUser()
    const original = Event.find
    Event.find = () => { throw new Error('boom') }
    try {
      await ctx.api.get('/api/notifications').set(member.auth).expect(200)
      await ctx.api.get('/api/notifications/unread-count').set(member.auth).expect(200)
    } finally {
      Event.find = original
    }
  })
})
