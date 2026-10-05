import '../config/env.js';
import { deliverEmail } from '../providers/mail.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Large type and a single obvious button: these emails are read on phones by
// people who may not have their glasses to hand.
const layout = (title, body) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; font-size: 18px; line-height: 1.5; color: #222;">
    <h2 style="color: #222; font-size: 24px;">${title}</h2>
    ${body}
  </div>
`;

/**
 * Send verification email with verification code
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendVerificationEmail = async (email, code) => {
  const subject = 'Verify Your Email - D8 LPA';
  const html = layout('Verify Your Email Address', `
      <p>Welcome to D8 LPA! Please verify your email address to complete your registration.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 16px; color: #444;">Your verification code is:</p>
        <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #1a56b8; letter-spacing: 5px;">${escapeHtml(code)}</p>
      </div>
      <p style="color: #444;">This code will expire in 10 minutes.</p>
      <p style="color: #555; font-size: 14px; margin-top: 30px;">
        If you didn't create this account, please ignore this email.
      </p>
  `);
  const text = `Your verification code is: ${code}. This code will expire in 10 minutes.`;
  return deliverEmail({ to: email, subject, html, text });
};

/**
 * Send password reset email with reset link
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const subject = 'Reset Your Password - D8 LPA';
  const html = layout('Password Reset Request', `
      <p>We received a request to reset your password. Click the button below to set a new password.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #1a56b8; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 18px;">
          Reset Password
        </a>
      </div>
      <p style="color: #444;">Or copy and paste this link in your browser:</p>
      <p style="color: #1a56b8; word-break: break-all;">${resetLink}</p>
      <p style="color: #444;">This link will expire in 1 hour.</p>
      <p style="color: #555; font-size: 14px; margin-top: 30px;">
        If you didn't request this, please ignore this email and your password will remain unchanged.
      </p>
  `);
  const text = `Click this link to reset your password: ${resetLink}. This link will expire in 1 hour.`;
  return deliverEmail({ to: email, subject, html, text });
};

/**
 * Summary of what is waiting for a member: unread messages and upcoming
 * events. Never includes message text - only who wrote and how many.
 * @param {string} email
 * @param {{ firstName: string, unread: {from: string, count: number}[], events: {title: string, when: string, location: string}[] }} digest
 */
export const sendDigestEmail = async (email, digest) => {
  const appUrl = process.env.FRONTEND_URL || '';
  const totalUnread = digest.unread.reduce((sum, row) => sum + row.count, 0);
  const subject = totalUnread > 0
    ? `You have ${totalUnread} new message${totalUnread === 1 ? '' : 's'} - D8 LPA`
    : 'Coming up in the D8 LPA community';

  const unreadHtml = digest.unread.length
    ? `<h3 style="font-size: 20px;">New messages</h3><ul>${digest.unread
        .map((row) => `<li>${escapeHtml(row.from)} - ${row.count} new message${row.count === 1 ? '' : 's'}</li>`)
        .join('')}</ul>`
    : '';
  const eventsHtml = digest.events.length
    ? `<h3 style="font-size: 20px;">Coming up</h3><ul>${digest.events
        .map((event) => `<li><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(event.when)} - ${escapeHtml(event.location)}</li>`)
        .join('')}</ul>`
    : '';

  const html = layout(`Hello ${escapeHtml(digest.firstName || 'there')},`, `
      <p>Here is what is waiting for you on D8 LPA.</p>
      ${unreadHtml}
      ${eventsHtml}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${appUrl}/messages" style="background-color: #1a56b8; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 18px;">
          Open D8 LPA
        </a>
      </div>
      <p style="color: #555; font-size: 14px; margin-top: 30px;">
        You are getting this because you turned on the email summary. You can turn it off any time in Settings, under Notifications.
        We will never ask you for money or your password by email.
      </p>
  `);
  const text = [
    `Hello ${digest.firstName || 'there'},`,
    ...digest.unread.map((row) => `${row.from}: ${row.count} new message(s)`),
    ...digest.events.map((event) => `${event.title} - ${event.when} - ${event.location}`),
    `Open D8 LPA: ${appUrl}/messages`,
    'Turn this email off any time in Settings, under Notifications.',
  ].join('\n');
  return deliverEmail({ to: email, subject, html, text });
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDigestEmail,
};
