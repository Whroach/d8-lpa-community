/**
 * Stand-ins for Amazon S3 and Mailgun, for the production-like smoke run
 * (`npm run smoke:prod`). One small HTTP server on 127.0.0.1:
 *
 *   PUT  /<bucket>/<key>          what the AWS SDK sends for PutObject - kept in memory
 *   GET  /<bucket>/<key>          serves a stored object back (the browser test points S3 picture URLs here)
 *   POST /v3/<domain>/messages    what the API sends to Mailgun - kept in memory, never sent
 *   GET  /__outbox?to=<email>     captured emails, for the test to read the code / reset link
 *   GET  /__objects               keys of the stored objects
 *   GET  /__blocked               hosts the API tried to reach and was refused (should stay empty)
 *   POST /__blocked               (used by no-egress.mjs to report one)
 *
 * Nothing here talks to the internet.
 */
import http from 'http'

export function startFakeServices(port) {
  const objects = new Map() // "bucket/key" -> { body, contentType }
  const outbox = []
  const blocked = []

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })

  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(value))
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      const pathname = decodeURIComponent(url.pathname)

      if (pathname === '/__outbox') {
        const to = (url.searchParams.get('to') || '').toLowerCase()
        return json(res, 200, to ? outbox.filter((mail) => mail.to.toLowerCase() === to) : outbox)
      }
      if (pathname === '/__objects') return json(res, 200, [...objects.keys()])
      if (pathname === '/__blocked') {
        if (req.method === 'POST') {
          blocked.push((await readBody(req)).toString('utf8'))
          return json(res, 200, { ok: true })
        }
        return json(res, 200, blocked)
      }

      // Mailgun: POST /v3/<domain>/messages (form-encoded, Basic auth)
      const mailgun = pathname.match(/^\/v3\/([^/]+)\/messages$/)
      if (mailgun && req.method === 'POST') {
        if (!/^Basic /.test(req.headers.authorization || '')) return json(res, 401, { message: 'Forbidden' })
        const form = new URLSearchParams((await readBody(req)).toString('utf8'))
        outbox.push({
          domain: mailgun[1],
          from: form.get('from') || '',
          to: form.get('to') || '',
          subject: form.get('subject') || '',
          html: form.get('html') || '',
          text: form.get('text') || '',
          sent_at: new Date().toISOString(),
        })
        return json(res, 200, { id: `<fake-${outbox.length}@${mailgun[1]}>`, message: 'Queued. Thank you.' })
      }

      // S3, path style: /<bucket>/<key...>
      const key = pathname.replace(/^\//, '')
      if (key.includes('/')) {
        if (req.method === 'PUT') {
          objects.set(key, { body: await readBody(req), contentType: req.headers['content-type'] || 'application/octet-stream' })
          res.writeHead(200, { ETag: `"fake-${objects.size}"` })
          return res.end()
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
          const found = objects.get(key)
          if (!found) {
            res.writeHead(404, { 'Content-Type': 'application/xml' })
            return res.end('<Error><Code>NoSuchKey</Code></Error>')
          }
          res.writeHead(200, { 'Content-Type': found.contentType, 'Content-Length': found.body.length, 'Access-Control-Allow-Origin': '*' })
          return res.end(req.method === 'HEAD' ? undefined : found.body)
        }
      }
      json(res, 404, { message: 'Not part of the fake services' })
    } catch (error) {
      json(res, 500, { message: String(error?.message || error) })
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({ server, objects, outbox, blocked, stop: () => new Promise((done) => server.close(done)) }))
  })
}
