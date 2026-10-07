import crypto from 'crypto'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { io as ioClient } from 'socket.io-client'
import { createApp } from '../src/app.js'
import User from '../src/models/User.js'
import Profile from '../src/models/Profile.js'
import Match from '../src/models/Match.js'
import Like from '../src/models/Like.js'
import { getOutbox, clearOutbox } from '../src/providers/mail.js'

export { getOutbox, clearOutbox }

// A password that satisfies the app's strength rules. Fictional, test-only.
export const PASSWORD = 'Test-Pass-1234!'

let counter = 0

/**
 * Starts the API on a random local port against a fresh, uniquely named
 * database inside the in-memory MongoDB.
 */
export async function startApp() {
  const dbName = `t_${crypto.randomBytes(6).toString('hex')}`
  const base = process.env.TEST_MONGO_BASE_URI
  if (!base || !/^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(base)) {
    throw new Error('Tests only run against the local in-memory MongoDB')
  }
  await mongoose.connect(`${base}${dbName}`)
  const { app, httpServer, io } = createApp()
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const port = httpServer.address().port
  const url = `http://127.0.0.1:${port}`
  clearOutbox()

  return {
    app,
    io,
    url,
    api: request(app),
    async stop() {
      io.close()
      await new Promise((resolve) => httpServer.close(resolve))
      await mongoose.connection.dropDatabase()
      await mongoose.disconnect()
    },
  }
}

export function tokenFor(userId) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' })
}

/** Creates a fully onboarded, obviously fictional member. */
export async function makeUser(overrides = {}) {
  counter += 1
  const {
    profile: profileOverrides = {},
    ...userOverrides
  } = overrides
  const user = await User.create({
    email: `member${counter}-${crypto.randomBytes(3).toString('hex')}@example.test`,
    password: PASSWORD,
    first_name: `Tester${counter}`,
    last_name: 'Example',
    birthdate: new Date('1975-06-15'),
    gender: 'female',
    onboarding_completed: true,
    email_verified: true,
    agreed_to_guidelines: true,
    ...userOverrides,
  })
  const profile = await Profile.create({
    user_id: user._id.toString(),
    bio: 'A fictional test member.',
    location_city: 'Testville',
    location_state: 'Oklahoma',
    interests: ['Gardening', 'Board games'],
    ...profileOverrides,
  })
  const token = tokenFor(user._id)
  return {
    user,
    profile,
    id: user._id.toString(),
    token,
    auth: { Authorization: `Bearer ${token}` },
  }
}

export async function makeAdmin(overrides = {}) {
  return makeUser({ role: 'admin', first_name: 'Admin', ...overrides })
}

/** Two members who have liked each other and have an active match. */
export async function makeMatch(a, b) {
  await Like.create({ from_user: a.id, to_user: b.id, type: 'like' })
  await Like.create({ from_user: b.id, to_user: a.id, type: 'like' })
  return Match.create({ users: [a.id, b.id] })
}

export function connectSocket(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    })
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', (error) => {
      socket.close()
      reject(error)
    })
  })
}

/** Resolves with the first payload of `event`, or rejects after `ms`. */
export function waitFor(socket, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No "${event}" within ${ms}ms`)), ms)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

/** Resolves true if `event` does NOT arrive within `ms`. */
export function expectSilence(socket, event, ms = 500) {
  return new Promise((resolve) => {
    const handler = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      socket.off(event, handler)
      resolve(true)
    }, ms)
    socket.once(event, handler)
  })
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 1x1 PNG, generated - not a photo of anyone.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
