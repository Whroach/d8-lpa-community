/**
 * Photo storage seam.
 *
 * Production: AWS S3, exactly as before (same bucket, same key layout, same
 * public URL shape).
 *
 * Local development / tests (STORAGE_DRIVER=local, ignored in production):
 * files are written under server/.local-uploads and served by the API at
 * /local-uploads, so nothing ever reaches a real bucket.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NODE_ENV = process.env.NODE_ENV || 'production';
export const ENVIRONMENT_FOLDER = NODE_ENV === 'development' ? 'development' : 'production';

export const LOCAL_UPLOAD_DIR =
  process.env.LOCAL_UPLOAD_DIR || path.resolve(__dirname, '../../.local-uploads');

// Only formats every browser can display, and nothing that can carry script
// (SVG) - the old check accepted anything whose type started with "image/".
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function imageExtensionFor(mimetype) {
  return ALLOWED_IMAGE_TYPES[mimetype] || null;
}

export function imageFileFilter(req, file, cb) {
  if (imageExtensionFor(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Please choose a JPG, PNG, WebP or GIF picture.');
    error.status = 400;
    cb(error);
  }
}

/** Checks the first bytes really are the image type the browser claimed. */
export function looksLikeImage(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;
  const hex = buffer.subarray(0, 12).toString('hex');
  switch (mimetype) {
    case 'image/jpeg': return hex.startsWith('ffd8ff');
    case 'image/png': return hex.startsWith('89504e470d0a1a0a');
    case 'image/gif': return hex.startsWith('474946383761') || hex.startsWith('474946383961');
    case 'image/webp': return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
    default: return false;
  }
}

let s3Client = null;
function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Stores one file and returns its public URL.
 * @param {{ key: string, body: Buffer, contentType: string }} file
 */
export async function storeFile({ key, body, contentType }) {
  if (config.storageDriver === 'local') {
    const target = path.join(LOCAL_UPLOAD_DIR, key);
    if (!target.startsWith(LOCAL_UPLOAD_DIR)) throw new Error('Invalid upload path');
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, body);
    return `${config.publicApiUrl}/local-uploads/${key}`;
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  await getS3().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  logger.log('[UPLOAD] Stored in S3:', { key });
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export function randomFileName(extension) {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
}
