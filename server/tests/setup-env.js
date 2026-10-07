// Runs before every test file, before any server code is imported.
// Nothing here is a real secret: every value is generated or fake.
import crypto from 'crypto'

process.env.SKIP_DOTENV = '1' // never read a developer's real .env
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
process.env.MAIL_DRIVER = 'memory' // captured in memory, never sent
process.env.STORAGE_DRIVER = 'local' // written to a temp folder, never S3
process.env.LOCAL_UPLOAD_DIR = process.env.TEST_UPLOAD_DIR
process.env.RATE_LIMIT_DISABLED = '1'
process.env.REQUIRE_EMAIL_VERIFICATION = 'true'
process.env.ENABLE_TEST_ROUTES = '1'
process.env.LOG_LEVEL = 'silent'
process.env.FRONTEND_URL = 'http://localhost:4121'
process.env.PUBLIC_API_URL = 'http://localhost:4120'
delete process.env.MONGODB_URI
delete process.env.AWS_ACCESS_KEY_ID
delete process.env.AWS_SECRET_ACCESS_KEY
delete process.env.MAILGUN_API_KEY
