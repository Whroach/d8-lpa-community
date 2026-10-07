/**
 * Email delivery seam.
 *
 * Production: Mailgun's HTTP API, exactly as before.
 * Development: nothing is sent (as before) - the message is only logged.
 * Tests / local demo (MAIL_DRIVER=memory, ignored in production): messages are
 * captured in memory so a test can read the verification code or reset link.
 */
import config from '../config/env.js';

const outbox = [];

export function getOutbox() {
  return outbox;
}

export function clearOutbox() {
  outbox.length = 0;
}

export async function deliverEmail({ to, subject, html, text }) {
  if (config.mailDriver === 'memory') {
    outbox.push({ to, subject, html, text, sent_at: new Date().toISOString() });
    return true;
  }

  if (!config.isProduction) {
    console.log(`[DEV] Email would be sent to: ${to}`);
    console.log(`[DEV] Subject: ${subject}`);
    return true;
  }

  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
  const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.error('[EMAIL] Mailgun credentials not configured');
    return false;
  }

  try {
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
    const fromName = process.env.SMTP_FROM_NAME || 'D8 LPA';
    const fromEmail = process.env.SMTP_FROM_EMAIL;

    const formData = new URLSearchParams();
    formData.append('from', `${fromName} <${fromEmail}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);
    formData.append('text', text);

    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
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
    console.log('[EMAIL] Sent. Mailgun message ID:', data.id);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending email via Mailgun:', error.message);
    return false;
  }
}
