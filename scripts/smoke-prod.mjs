/**
 * Production-like smoke run, entirely on this computer:
 *
 *     npm run smoke:prod            build, start, run the smoke tests, stop
 *     node scripts/smoke-prod.mjs   build and start, then leave it running to look at (Ctrl+C stops it)
 *
 * What is the same as on Railway:
 *   - the website is `next build` + `next start`
 *   - the API is `node src/index.js` in `server/` with NODE_ENV=production, so
 *     every local-only switch is ignored: rate limits are ON, `trust proxy`
 *     takes its production default, email verification is required, the test
 *     routes and the local photo folder do not exist, photos go through the
 *     S3 code path and email through the Mailgun code path.
 *
 * What is different:
 *   - the database is a throwaway in-memory MongoDB
 *   - S3 and Mailgun are stand-ins on 127.0.0.1 (scripts/smoke/fake-services.mjs)
 *   - the API process is prevented from connecting to anything that is not
 *     this computer (scripts/smoke/no-egress.mjs)
 *   - every secret is generated or fake; no .env file is read
 *
 * Ports: SMOKE_API_PORT (5201), SMOKE_WEB_PORT (3201), SMOKE_FAKE_PORT (5202),
 * SMOKE_MONGO_PORT (random). Flags: --test (run the tests, then stop),
 * --no-build (reuse the last build).
 */
import { spawn } from 'child_process'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { startLocalMongo } from './local-mongo.mjs'
import { startFakeServices } from './smoke/fake-services.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPort = process.env.SMOKE_API_PORT || '5201'
const webPort = process.env.SMOKE_WEB_PORT || '3201'
const fakePort = process.env.SMOKE_FAKE_PORT || '5202'
const runTests = process.argv.includes('--test')
const skipBuild = process.argv.includes('--no-build')
const distDir = '.next-smoke'
const fakeUrl = `http://127.0.0.1:${fakePort}`
const bucket = 'smoke-bucket'
const region = 'us-east-1'

// Start from the current environment, minus anything that could point a child
// process at a real service.
function cleanEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(AWS_|MAILGUN_|SMTP_|MONGODB_URI$|JWT_SECRET$|ALLOWED_ORIGINS$|FRONTEND_URL$|TRUST_PROXY$|RATE_LIMIT_|ENABLE_TEST_ROUTES$|STORAGE_DRIVER$|MAIL_DRIVER$|ENFORCE_EMAIL_VERIFICATION$|NEXT_PUBLIC_)/.test(key)) delete env[key]
  }
  return env
}

const children = []
let stopping = false
let fakes = null
let mongod = null
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  if (fakes) await fakes.stop().catch(() => {})
  if (mongod) await mongod.stop().catch(() => {})
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function start(name, args, options) {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options })
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`[${name}] stopped unexpectedly (${code})`)
      shutdown(code || 1)
    }
  })
  children.push(child)
  return child
}

function runToEnd(args, options) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options })
    children.push(child)
    child.on('exit', (code) => {
      children.splice(children.indexOf(child), 1)
      resolve(code ?? 1)
    })
  })
}

async function waitFor(url, label, seconds = 120) {
  const deadline = Date.now() + seconds * 1000
  for (;;) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`${label} did not start within ${seconds}s (${url})`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

try {
  fakes = await startFakeServices(Number(fakePort))
  mongod = await startLocalMongo(process.env.SMOKE_MONGO_PORT ? { port: Number(process.env.SMOKE_MONGO_PORT) } : {})
  const mongoUri = `${mongod.getUri()}d8lpa_smoke`

  const webEnv = {
    ...cleanEnv(),
    NODE_ENV: 'production',
    NEXT_DIST_DIR: distDir,
    NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api`,
    NEXT_TELEMETRY_DISABLED: '1',
  }
  if (!skipBuild) {
    console.log('\n[smoke] next build ...')
    const code = await runToEnd(['node_modules/next/dist/bin/next', 'build'], { cwd: root, env: webEnv })
    if (code !== 0) throw new Error(`next build failed (${code})`)
  }

  // The API exactly as Railway starts it (`node src/index.js` in server/),
  // plus the no-egress guard.
  start('api', ['--import', pathToFileURL(path.join(root, 'scripts/smoke/no-egress.mjs')).href, 'src/index.js'], {
    cwd: path.join(root, 'server'),
    env: {
      ...cleanEnv(),
      NODE_ENV: 'production',
      SKIP_DOTENV: '1',
      PORT: apiPort,
      MONGODB_URI: mongoUri,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      ALLOWED_ORIGINS: `http://localhost:${webPort}`,
      FRONTEND_URL: `http://localhost:${webPort}`,
      // Fake values; the SDK is pointed at the stand-in and can reach nothing else.
      AWS_REGION: region,
      AWS_ACCESS_KEY_ID: 'smoke-fake-key',
      AWS_SECRET_ACCESS_KEY: 'smoke-fake-secret',
      AWS_S3_BUCKET_NAME: bucket,
      AWS_ENDPOINT_URL_S3: fakeUrl,
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_CONFIG_FILE: path.join(root, '.next-smoke', 'no-aws-config'),
      AWS_SHARED_CREDENTIALS_FILE: path.join(root, '.next-smoke', 'no-aws-credentials'),
      MAILGUN_API_KEY: 'smoke-fake-key',
      MAILGUN_DOMAIN: 'mg.example.test',
      SMTP_FROM_EMAIL: 'no-reply@example.test',
      SMOKE_FAKE_URL: fakeUrl,
    },
  })
  start('web', ['node_modules/next/dist/bin/next', 'start', '-p', webPort], { cwd: root, env: webEnv })

  await waitFor(`http://localhost:${apiPort}/api/health`, 'The API')
  await waitFor(`http://localhost:${webPort}/login`, 'The website')

  console.log(`
  Production-like stack is up (throwaway data, nothing real, nothing leaves this computer).

    App:        http://localhost:${webPort}
    API:        http://localhost:${apiPort}/api/health
    Emails:     ${fakeUrl}/__outbox
    Photos:     ${fakeUrl}/__objects
`)

  if (runTests) {
    const code = await runToEnd(['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.smoke.config.ts'], {
      cwd: root,
      env: {
        ...process.env,
        SMOKE_API_URL: `http://localhost:${apiPort}`,
        SMOKE_WEB_URL: `http://localhost:${webPort}`,
        SMOKE_FAKE_URL: fakeUrl,
        SMOKE_MONGO_URI: mongoUri,
        SMOKE_BUCKET_HOST: `${bucket}.s3.${region}.amazonaws.com`,
        SMOKE_BUCKET: bucket,
      },
    })
    console.log(code === 0 ? '\n[smoke] PASSED' : `\n[smoke] FAILED (${code})`)
    await shutdown(code)
  }
} catch (error) {
  console.error(`\n[smoke] ${error.message}`)
  await shutdown(1)
}
