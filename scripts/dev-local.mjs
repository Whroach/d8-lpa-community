/**
 * One command to run the whole app locally and safely:
 *
 *     npm run dev:local
 *
 * It starts a throwaway in-memory MongoDB, seeds it with fictional members,
 * starts the API (photos saved to a local folder, emails captured in memory -
 * nothing reaches S3 or Mailgun) and starts the Next.js front end.
 *
 * It never reads your .env file and never touches production.
 *
 * Ports: API_PORT (default 5001), WEB_PORT (default 3000), MONGO_PORT (random).
 */
import { spawn } from 'child_process'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { startLocalMongo } from './local-mongo.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPort = process.env.API_PORT || '5001'
const webPort = process.env.WEB_PORT || '3000'
const production = process.argv.includes('--built') // serve `next build` output instead of dev mode

const mongod = await startLocalMongo(process.env.MONGO_PORT ? { port: Number(process.env.MONGO_PORT) } : {})
const mongoUri = `${mongod.getUri()}d8lpa_local`

const children = []
function run(name, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...cleanEnv(), ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  child.on('exit', (code) => {
    console.log(`[${name}] stopped (${code})`)
    shutdown(code || 0)
  })
  children.push(child)
}

// Start from the current environment, minus anything that could point a child
// process at a real service.
function cleanEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(AWS_|MAILGUN_|SMTP_|MONGODB_URI$|JWT_SECRET$|ALLOWED_ORIGINS$|FRONTEND_URL$)/.test(key)) delete env[key]
  }
  return env
}

let stopping = false
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  await mongod.stop().catch(() => {})
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('api', ['server/src/dev/local-server.js'], {
  SKIP_DOTENV: '1',
  NODE_ENV: 'development',
  PORT: apiPort,
  MONGODB_URI: mongoUri,
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), // new every run
  STORAGE_DRIVER: 'local',
  MAIL_DRIVER: 'memory',
  ENABLE_TEST_ROUTES: '1',
  RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED ?? '1',
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION ?? 'true',
  ALLOWED_ORIGINS: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
  FRONTEND_URL: `http://localhost:${webPort}`,
  PUBLIC_API_URL: `http://localhost:${apiPort}`,
  LOG_LEVEL: process.env.LOG_LEVEL || '',
})

run('web', ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '-p', webPort], {
  NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api`,
  NEXT_TELEMETRY_DISABLED: '1',
})

console.log(`
  D8 LPA is starting locally (throwaway data - nothing here is real).

    App:  http://localhost:${webPort}
    API:  http://localhost:${apiPort}/api/health

  Demo sign-ins are listed in docs/LOCAL-DEVELOPMENT.md.
  Press Ctrl+C to stop everything.
`)
