import nodemailer from 'nodemailer';
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

// Create transporter only in production
let transporter = null;

if (isProduction) {
  console.log('[EMAIL] Production mode detected, initializing SMTP transporter');
  console.log('[EMAIL] SMTP_HOST:', process.env.SMTP_HOST);
  console.log('[EMAIL] SMTP_PORT:', process.env.SMTP_PORT);
  console.log('[EMAIL] SMTP_USER:', process.env.SMTP_USER);
  console.log('[EMAIL] SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL);
  
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  
  console.log('[EMAIL] SMTP transporter created successfully');
  console.log('[EMAIL] Transporter config:', {
    host: transporter.options.host,
    port: transporter.options.port,
    secure: transporter.options.secure,
    user: transporter.options.auth?.user
  });
  
  // Test the connection
  transporter.verify((error, success) => {
    if (error) {
      console.error('[EMAIL] SMTP connection verification failed:', error.message);
      console.error('[EMAIL] Error code:', error.code);
      console.error('[EMAIL] Full error:', error);
    } else {
      console.log('[EMAIL] SMTP connection verified successfully');
    }
  });
} else {
  console.log('[EMAIL] Development mode - emails will be logged to console');
}

/**
 * Send verification email with verification code
 * @param {string} email - Recipient email
 * @param {string} code - 6-digit verification code
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendVerificationEmail = async (email, code) => {
  if (!isProduction) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return true;
  }

  try {
    if (!transporter) {
      console.error('[EMAIL] Email transporter not configured in production!');
      console.error('[EMAIL] Check SMTP environment variables are set');
      return false;
    }

    console.log(`[EMAIL] Sending verification email to ${email}`);

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email - D8 LPA',
      html: `
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
      `,
      text: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Verification email sent to ${email}:`, info.response);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending verification email:', error.message);
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Full error:', error);
    return false;
  }
};

/**
 * Send password reset email with reset link
 * @param {string} email - Recipient email
 * @param {string} token - Password reset token
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendPasswordResetEmail = async (email, token) => {
  if (!isProduction) {
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
    return true;
  }

  try {
    if (!transporter) {
      console.error('[EMAIL] Email transporter not configured in production!');
      console.error('[EMAIL] Check SMTP environment variables are set');
      return false;
    }

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    console.log(`[EMAIL] Sending password reset email to ${email}`);

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Reset Your Password - D8 LPA',
      html: `
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
      `,
      text: `Click this link to reset your password: ${resetLink}. This link will expire in 1 hour.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Password reset email sent to ${email}:`, info.response);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending password reset email:', error.message);
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Full error:', error);
    return false;
  }
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
