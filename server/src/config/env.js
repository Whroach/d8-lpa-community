/**
 * Single place that loads environment variables.
 *
 * Production behaviour is unchanged: the root `.env` is loaded if it exists
 * (Railway injects real variables, which always win over the file).
 *
 * Local development and tests set SKIP_DOTENV=1 so a developer's real `.env`
 * is never read by a throwaway server, or ENV_FILE to point at another file.
 *
 * Import this module before anything that reads process.env at load time.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.SKIP_DOTENV !== '1') {
  const envPath = process.env.ENV_FILE
    ? path.resolve(process.env.ENV_FILE)
    : path.resolve(__dirname, '../../../.env');
  dotenv.config({ path: envPath });
}

export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Switches that only exist for local development and automated tests. Every
 * one of them is ignored in production, whatever the environment says.
 */
const devOnly = (value) => !isProduction && value;

export const config = {
  isProduction,
  // 's3' (default, production) or 'local' (files on disk, dev/test only)
  storageDriver: devOnly(process.env.STORAGE_DRIVER === 'local') ? 'local' : 's3',
  // 'mailgun' (default, production) or 'memory' (captured, never sent)
  mailDriver: devOnly(process.env.MAIL_DRIVER === 'memory') ? 'memory' : 'mailgun',
  // Production always verifies email. Dev auto-verifies unless asked not to,
  // which lets the tests exercise the real verification flow.
  requireEmailVerification:
    isProduction || process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  rateLimitDisabled: Boolean(devOnly(process.env.RATE_LIMIT_DISABLED === '1')),
  testRoutesEnabled: Boolean(devOnly(process.env.ENABLE_TEST_ROUTES === '1')),
  publicApiUrl: process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5001}`,
};

export default config;
