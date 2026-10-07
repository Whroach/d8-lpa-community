import { startLocalMongo } from '../../scripts/local-mongo.mjs'
import fs from 'fs'
import os from 'os'
import path from 'path'

let mongod

export async function setup() {
  mongod = await startLocalMongo()
  process.env.TEST_MONGO_BASE_URI = mongod.getUri()
  process.env.TEST_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lpa-test-uploads-'))
}

export async function teardown() {
  if (mongod) await mongod.stop()
  if (process.env.TEST_UPLOAD_DIR) {
    fs.rmSync(process.env.TEST_UPLOAD_DIR, { recursive: true, force: true })
  }
}
