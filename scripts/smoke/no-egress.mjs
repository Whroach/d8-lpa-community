/**
 * Loaded into the API process during the production-like smoke run
 * (`node --import ./scripts/smoke/no-egress.mjs src/index.js`).
 *
 * The API runs with NODE_ENV=production, so its own local switches (local
 * photo folder, in-memory mail) are off and it behaves exactly as it does on
 * Railway. This file makes sure that still cannot reach the outside world:
 *
 *  1. Requests to Mailgun's address are sent to the local stand-in instead.
 *  2. Looking up ANY host name other than localhost is refused, so nothing in
 *     the process can open a connection to the internet. Each refusal is
 *     reported to the stand-in (`GET /__blocked`), and the smoke test fails
 *     if there was one.
 *
 * (S3 is pointed at the stand-in with the AWS SDK's own AWS_ENDPOINT_URL_S3
 * variable, set by scripts/smoke-prod.mjs.)
 *
 * This file is never loaded by the real server.
 */
import dns from 'dns'

const fakeBase = process.env.SMOKE_FAKE_URL
if (!fakeBase || !/^http:\/\/127\.0\.0\.1:\d+$/.test(fakeBase)) {
  console.error('no-egress.mjs: SMOKE_FAKE_URL must be http://127.0.0.1:<port>')
  process.exit(1)
}

const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])
const realFetch = globalThis.fetch

function report(host) {
  console.error(`[smoke] BLOCKED an outgoing connection to ${host}`)
  realFetch(`${fakeBase}/__blocked`, { method: 'POST', body: host }).catch(() => {})
}

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  if (url.startsWith('https://api.mailgun.net/')) {
    return realFetch(url.replace('https://api.mailgun.net', fakeBase), init)
  }
  return realFetch(input, init)
}

const refuse = (hostname) => {
  report(hostname)
  const error = new Error(`smoke run: outgoing connection to ${hostname} refused`)
  error.code = 'ENOTFOUND'
  return error
}

const realLookup = dns.lookup
dns.lookup = function lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback
  if (LOCAL.has(String(hostname).toLowerCase())) return realLookup.call(dns, hostname, options, callback)
  process.nextTick(() => cb(refuse(hostname)))
  return {}
}
const realPromiseLookup = dns.promises.lookup
dns.promises.lookup = async function lookup(hostname, options) {
  if (LOCAL.has(String(hostname).toLowerCase())) return realPromiseLookup.call(dns.promises, hostname, options)
  throw refuse(hostname)
}
