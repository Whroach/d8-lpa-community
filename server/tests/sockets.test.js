import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { startApp, makeUser, makeMatch, connectSocket, waitFor, expectSilence, sleep, tokenFor } from './helpers.js'

let ctx
const open = []
const connect = async (member) => {
  const socket = await connectSocket(ctx.url, member?.token)
  open.push(socket)
  return socket
}

beforeAll(async () => { ctx = await startApp() })
afterEach(() => { while (open.length) open.pop().close() })
afterAll(async () => { await ctx.stop() })

describe('realtime: who may connect', () => {
  it('refuses a connection with no token, a bad token, or a token for a banned member', async () => {
    await expect(connectSocket(ctx.url, null)).rejects.toThrow(/unauthorized/)
    await expect(connectSocket(ctx.url, 'not-a-token')).rejects.toThrow(/unauthorized/)
    await expect(connectSocket(ctx.url, tokenFor('64b000000000000000000001'))).rejects.toThrow(/unauthorized/)
    const banned = await makeUser({ is_banned: true })
    await expect(connectSocket(ctx.url, banned.token)).rejects.toThrow(/unauthorized/)
  })
})

describe('realtime: chat between two members', () => {
  it('delivers a new message to the open conversation and a badge ping to the recipient', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const socketB = await connect(b)
    socketB.emit('join-conversation', match._id.toString())
    await sleep(150)

    const gotMessage = waitFor(socketB, 'new-message')
    const gotPing = waitFor(socketB, 'new-notification')
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'Hello in real time' })

    expect(await gotMessage).toMatchObject({ content: 'Hello in real time', sender_id: a.id, match_id: match._id.toString() })
    expect(await gotPing).toMatchObject({ type: 'message', match_id: match._id.toString(), from: a.user.first_name })
  })

  it('pushes edits and unsends to the other person', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const sent = await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'tpyo' })
    const socketB = await connect(b)

    const edited = waitFor(socketB, 'message-updated')
    await ctx.api.put(`/api/messages/${match._id}/${sent.body.id}`).set(a.auth).send({ content: 'typo' })
    expect(await edited).toMatchObject({ id: sent.body.id, content: 'typo' })

    const unsent = waitFor(socketB, 'message-updated')
    await ctx.api.delete(`/api/messages/${match._id}/${sent.body.id}`).set(a.auth)
    expect(await unsent).toMatchObject({ id: sent.body.id, is_unsent: true, content: '' })
  })

  it('relays "typing" only to the other person in the conversation', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const socketA = await connect(a)
    const socketB = await connect(b)
    socketA.emit('join-conversation', match._id.toString())
    socketB.emit('join-conversation', match._id.toString())
    await sleep(150)

    const typing = waitFor(socketB, 'typing')
    const echo = expectSilence(socketA, 'typing')
    socketA.emit('typing', { match_id: match._id.toString() })
    expect(await typing).toMatchObject({ match_id: match._id.toString(), user_id: a.id, typing: true })
    expect(await echo).toBe(true)
  })

  it('tells the sender when their message has been read - unless the reader switched receipts off', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const socketA = await connect(a)

    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'one' })
    const read = waitFor(socketA, 'messages-read')
    await ctx.api.get(`/api/messages/${match._id}`).set(b.auth)
    expect(await read).toMatchObject({ match_id: match._id.toString(), reader_id: b.id })

    await ctx.api.put('/api/settings').set(b.auth).send({ privacy: { readReceipts: false } })
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'two' })
    const silent = expectSilence(socketA, 'messages-read')
    await ctx.api.get(`/api/messages/${match._id}`).set(b.auth)
    expect(await silent).toBe(true)
  })

  it('announces a match to both people in real time', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const socketA = await connect(a)
    const socketB = await connect(b)
    await ctx.api.post(`/api/browse/${b.id}/like`).set(a.auth)
    const pingA = waitFor(socketA, 'new-notification')
    const pingB = waitFor(socketB, 'new-notification')
    await ctx.api.post(`/api/browse/${a.id}/like`).set(b.auth)
    expect((await pingA).type).toBe('match')
    expect((await pingB).type).toBe('match')
  })
})

describe('realtime: nobody can listen in', () => {
  it('an outsider who tries to join the conversation or the personal room hears nothing', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const outsider = await makeUser()
    const match = await makeMatch(a, b)
    const spy = await connect(outsider)
    spy.emit('join-conversation', match._id.toString())
    spy.emit('join', b.id) // the old server joined whatever id was sent
    spy.emit('join', `match-${match._id}`)
    await sleep(200)

    const noMessage = expectSilence(spy, 'new-message', 700)
    const noPing = expectSilence(spy, 'new-notification', 700)
    const noTyping = expectSilence(spy, 'typing', 700)
    spy.emit('typing', { match_id: match._id.toString() })
    await ctx.api.post(`/api/messages/${match._id}`).set(a.auth).send({ content: 'private' })
    expect(await noMessage).toBe(true)
    expect(await noPing).toBe(true)
    expect(await noTyping).toBe(true)
  })

  it('an outsider cannot make "typing" appear in someone else\'s conversation', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const outsider = await makeUser()
    const match = await makeMatch(a, b)
    const socketB = await connect(b)
    socketB.emit('join-conversation', match._id.toString())
    const spy = await connect(outsider)
    await sleep(150)
    const silent = expectSilence(socketB, 'typing', 600)
    spy.emit('typing', { match_id: match._id.toString() })
    spy.emit('typing', { match_id: { $ne: null } })
    spy.emit('join-conversation', { $ne: null })
    expect(await silent).toBe(true)
  })

  it('blocking closes the conversation on the other person\'s screen', async () => {
    const a = await makeUser()
    const b = await makeUser()
    const match = await makeMatch(a, b)
    const socketB = await connect(b)
    const closed = waitFor(socketB, 'conversation-closed')
    await ctx.api.post(`/api/browse/${b.id}/block`).set(a.auth)
    expect(await closed).toEqual({ match_id: match._id.toString() })
  })

  it('suspending a member disconnects them from live chat at once', async () => {
    const admin = await makeUser({ role: 'admin' })
    const member = await makeUser()
    const socket = await connect(member)
    const dropped = waitFor(socket, 'disconnect')
    await ctx.api.post(`/api/admin/users/${member.id}/action`).set(admin.auth).send({ action: 'suspend' })
    await dropped
    expect(socket.connected).toBe(false)
  })
})

describe('online status', () => {
  it('shows a member as online while connected, unless they chose to hide it', async () => {
    const a = await makeUser()
    const b = await makeUser()
    await makeMatch(a, b)
    expect((await ctx.api.get('/api/messages').set(a.auth)).body[0].user.is_online).toBe(false)
    await connect(b)
    expect((await ctx.api.get('/api/messages').set(a.auth)).body[0].user.is_online).toBe(true)
    await ctx.api.put('/api/settings').set(b.auth).send({ privacy: { showOnline: false } })
    expect((await ctx.api.get('/api/messages').set(a.auth)).body[0].user.is_online).toBe(false)
  })
})
