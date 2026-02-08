# Mailgun Email Integration Setup

## Overview

The D8-LPA application has been switched from Gmail SMTP to **Mailgun HTTP API** for reliable email delivery, especially in production environments like Railway.

## Why Mailgun Instead of SMTP?

1. **Network Compatibility**: Mailgun uses HTTP API (port 443), which works reliably on Railway
2. **No SMTP Blocks**: Railway was blocking SMTP port 587, causing `ETIMEDOUT` errors
3. **Better Reliability**: HTTP API is more stable than SMTP for transactional emails
4. **Production Ready**: Mailgun is designed for application email delivery at scale

## Current Configuration

### Credentials (Sandbox)
- **API Key**: `[See environment variables - not shown in documentation for security]`
- **Domain**: `sandbox41802c0033964ca194eac5306f3eee50.mailgun.org`
- **From Address**: `noreply@sandbox41802c0033964ca194eac5306f3eee50.mailgun.org`

### Environment Variables
```
MAILGUN_API_KEY=<your_mailgun_api_key>
MAILGUN_DOMAIN=sandbox41802c0033964ca194eac5306f3eee50.mailgun.org
SMTP_FROM_EMAIL=noreply@sandbox41802c0033964ca194eac5306f3eee50.mailgun.org
SMTP_FROM_NAME=D8 LPA
```

Both `.env` (development) and `.env.production` files have been updated with these values.

## Email Functions

### 1. Verification Email
- **Trigger**: User signs up or requests resend verification
- **Code**: 6-digit verification code
- **Expiration**: 10 minutes
- **File**: `server/src/routes/auth.js` → `/api/auth/signup` & `/api/auth/resend-verification`

### 2. Password Reset Email
- **Trigger**: User clicks "Forgot Password"
- **Content**: Reset link with one-time token
- **Expiration**: 1 hour
- **File**: `server/src/routes/auth.js` → `/api/auth/forgot-password`

## Implementation Details

### HTTP API Structure
All emails are sent via POST request to Mailgun's HTTP API:

```javascript
POST https://api.mailgun.net/v3/{domain}/messages
Authorization: Basic base64(api:{API_KEY})
Content-Type: application/x-www-form-urlencoded

from=noreply@sandbox...&to=user@example.com&subject=...&html=...
```

### Error Handling
- Logs detailed errors if email fails to send
- Validates credentials before sending
- Returns false if Mailgun API returns error
- Development mode logs to console without sending

## Testing Email Delivery

### In Development
1. Start the server: `npm run dev`
2. Emails are logged to console (not actually sent)
3. Check logs for email content and recipient

### In Production (Railway)
1. **Add test email to authorized recipients in Mailgun**:
   - Go to Mailgun dashboard
   - Navigate to Sandbox Domain settings
   - Add your test email to "Authorized Recipients"
   - Confirm the authorization email
   
2. **Sign up with test email**
   - Verification email should arrive within 1-2 seconds
   - Check spam folder if not in inbox

3. **Monitor logs**
   - Check Railway logs for `[EMAIL]` log entries
   - Should show: `✓ Email sent successfully to...`

## Transitioning from Sandbox to Production Domain

When ready to move to production:

1. **Upgrade Mailgun Account** to access production domain
2. **Verify your domain** in Mailgun (DNS records)
3. **Update Environment Variables**:
   ```
   MAILGUN_DOMAIN=yourdomain.com
   MAILGUN_API_KEY=your_production_key
   SMTP_FROM_EMAIL=noreply@yourdomain.com
   ```
4. **No code changes needed** - email utility uses environment variables

## Mailgun Dashboard Access

- **URL**: https://app.mailgun.com
- **Current**: Sandbox domain
- **Features Available**:
  - View sent emails (Logs)
  - Add authorized recipients (sandbox only)
  - Create API keys
  - Domain verification
  - Email tracking

## File Changes

### Modified Files
- `server/src/utils/email.js` - Switched from nodemailer SMTP to Mailgun HTTP API
- `.env` - Updated email configuration variables
- `.env.production` - Updated email configuration variables
- `server/package.json` - Removed nodemailer dependency

### Key Functions
```javascript
// server/src/utils/email.js

export const sendVerificationEmail(email, code)
// Sends 6-digit verification code

export const sendPasswordResetEmail(email, token)
// Sends password reset link
```

Both functions:
- Use Mailgun HTTP API in production
- Return Promise<boolean>
- Include comprehensive error logging
- Have formatted HTML email templates

## Troubleshooting

### Email Not Arriving
1. **Check Mailgun logs**: https://app.mailgun.com/logs
2. **Verify recipient email**: Must be authorized in sandbox
3. **Check spam folder**: Legitimate emails sometimes go there
4. **Review API response**: Check server logs for Mailgun API errors

### Authorization Errors
- Verify `MAILGUN_API_KEY` is correct
- Verify `MAILGUN_DOMAIN` is correct
- Check credentials are set in `.env` or environment variables

### Development Testing
- In dev mode, emails are logged to console only
- Set `NODE_ENV=production` to actually send via Mailgun

## Security Notes

1. **API Key**: Already stored in environment variables (not in code)
2. **Sandbox Domain**: Limited to authorized recipients only
3. **Production**: Should use custom domain for branding
4. **CORS**: Email service is backend-only, not exposed to frontend

## Additional Resources

- Mailgun Documentation: https://documentation.mailgun.com/
- HTTP API Reference: https://documentation.mailgun.com/api-sending.html
- Email Troubleshooting: https://help.mailgun.com/hc/en-us

## Next Steps

1. ✅ Mailgun HTTP API integrated
2. ✅ Environment variables configured
3. ⏳ Deploy to Railway
4. ⏳ Test email delivery with real account
5. ⏳ Monitor production emails for 24 hours
6. ⏳ Consider transitioning to production domain

---

**Last Updated**: During email system overhaul - switching from Gmail SMTP to Mailgun HTTP API
**Status**: Ready for production deployment
