import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const rootEnvPath = path.resolve(__dirname, '../../../.env');
  dotenv.config({ path: rootEnvPath });
}

const isProduction = process.env.NODE_ENV === 'production';

// Mailgun configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_API_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

console.log('[EMAIL] Initializing Mailgun email service');
console.log('[EMAIL] NODE_ENV:', process.env.NODE_ENV);
console.log('[EMAIL] MAILGUN_DOMAIN:', MAILGUN_DOMAIN);
console.log('[EMAIL] MAILGUN_API_KEY set:', !!MAILGUN_API_KEY);

/**
 * Send email via Mailgun API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 * @param {string} text - Plain text email body
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendViaMailgun = async (to, subject, html, text) => {
  if (!isProduction) {
    console.log(`[DEV] Email would be sent to: ${to}`);
    console.log(`[DEV] Subject: ${subject}`);
    return true;
  }

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.error('[EMAIL] Mailgun credentials not configured');
    console.error('[EMAIL] MAILGUN_API_KEY:', !!MAILGUN_API_KEY);
    console.error('[EMAIL] MAILGUN_DOMAIN:', MAILGUN_DOMAIN);
    return false;
  }

  try {
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
    
    const formData = new URLSearchParams();
    formData.append('from', `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);
    formData.append('text', text);

    console.log(`[EMAIL] Sending email to ${to} via Mailgun API`);

    const response = await fetch(`${MAILGUN_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[EMAIL] Mailgun API error:', data);
      return false;
    }

    console.log(`[EMAIL] ✓ Email sent successfully to ${to}`);
    console.log('[EMAIL] Mailgun message ID:', data.id);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending email via Mailgun:', error.message);
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Full error:', error);
    return false;
  }
};

/**
 * Send verification email with verification code
 * @param {string} email - Recipient email
 * @param {string} code - 6-digit verification code
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendVerificationEmail = async (email, code) => {
  const subject = 'Verify Your Email - D8 LPA';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Verify Your Email Address</h2>
      <p>Welcome to D8 LPA! Please verify your email address to complete your registration.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #666;">Your verification code is:</p>
        <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #1a73e8; letter-spacing: 5px;">${code}</p>
      </div>
      <p style="color: #666;">This code will expire in 10 minutes.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        If you didn't create this account, please ignore this email.
      </p>
    </div>
  `;
  
  const text = `Your verification code is: ${code}. This code will expire in 10 minutes.`;

  return sendViaMailgun(email, subject, html, text);
};

/**
 * Send password reset email with reset link
 * @param {string} email - Recipient email
 * @param {string} token - Password reset token
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const subject = 'Reset Your Password - D8 LPA';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to set a new password.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #1a73e8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #666;">Or copy and paste this link in your browser:</p>
      <p style="color: #1a73e8; word-break: break-all;">${resetLink}</p>
      <p style="color: #666;">This link will expire in 1 hour.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        If you didn't request this, please ignore this email and your password will remain unchanged.
      </p>
    </div>
  `;
  
  const text = `Click this link to reset your password: ${resetLink}. This link will expire in 1 hour.`;

  return sendViaMailgun(email, subject, html, text);
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
