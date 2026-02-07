# Email Verification & Password Reset Guide

## ✅ Status: FULLY IMPLEMENTED

Email verification for new accounts and password reset email functionality are **fully enabled and operational** in the D8-LPA application.

---

## 📧 Email Configuration

### Current Setup
- **SMTP Provider:** Gmail (via SMTP)
- **Sender Email:** d8lpa.community@gmail.com
- **Configuration Location:** `.env` and `.env.production`

### Environment Variables
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=d8lpa.community@gmail.com
SMTP_PASS=qvtxihtqolbuewob
SMTP_FROM_EMAIL=d8lpa.community@gmail.com
SMTP_FROM_NAME=D8 LPA
FRONTEND_URL=http://localhost:3000  # or production URL
```

---

## 🔐 Email Verification Flow

### 1. **Signup Process** ([app/signup/page.tsx](app/signup/page.tsx))

**User Flow:**
1. User enters email and password on signup page
2. Account is created with unverified status
3. Verification code (6-digit) is generated and sent to email
4. User enters verification code on verification screen
5. Upon successful verification, user proceeds to onboarding

**Backend Implementation:**

**Signup Endpoint** - `POST /api/auth/signup` ([server/src/routes/auth.js](server/src/routes/auth.js#L47))
- Creates new user account
- Generates 6-digit verification code
- Sets code expiration to 10 minutes
- **In Development:** Auto-verifies email (skips verification)
- **In Production:** Sends verification email
- Returns user ID and auth token

```javascript
// Verification code generation (6 digits)
const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

// Code expires in 10 minutes
verification_code_expires: new Date(Date.now() + 10 * 60 * 1000)
```

**Verify Email Endpoint** - `POST /api/auth/verify-email` ([server/src/routes/auth.js](server/src/routes/auth.js#L123))
- Validates email and verification code
- Checks code has not expired
- Marks user email as verified
- Returns success message

**Resend Verification** - `POST /api/auth/resend-verification` ([server/src/routes/auth.js](server/src/routes/auth.js#L169))
- Generates new verification code
- Sends new email if verification fails
- Implements cooldown to prevent abuse

### 2. **Email Templates**

**Verification Email** ([server/src/utils/email.js](server/src/utils/email.js#L34))
- Clean HTML template with D8-LPA branding
- Displays 6-digit verification code prominently
- Shows 10-minute expiration warning
- Plain text fallback included

**Sample:**
```
Subject: Verify Your Email - D8 LPA

Your verification code is:
┌─────────┐
│ 123456  │
└─────────┘

This code will expire in 10 minutes.
```

---

## 🔑 Password Reset Flow

### **Forgot Password Process** ([app/forgot-password/page.tsx](app/forgot-password/page.tsx))

**User Flow:**
1. User clicks "Forgot Password" on login page
2. Enters email address
3. Backend sends reset link to email (if account exists)
4. User clicks link in email
5. User enters new password on reset page
6. Password is updated and user can login

### **Backend Implementation:**

**Forgot Password Endpoint** - `POST /api/auth/forgot-password` ([server/src/routes/auth.js](server/src/routes/auth.js#L491))
- Accepts email address
- Generates cryptographically secure reset token
- Token valid for 1 hour
- **In Development:** Logs token and reset link to console
- **In Production:** Sends email with reset link
- Always returns generic message (doesn't reveal if email exists)

```javascript
// Generate 32-byte hex token
const resetToken = crypto.randomBytes(32).toString('hex');

// Token expires in 1 hour
password_reset_expires: new Date(Date.now() + 60 * 60 * 1000)
```

**Reset Password Endpoint** - `POST /api/auth/reset-password` ([server/src/routes/auth.js](server/src/routes/auth.js#L532))
- Validates reset token (must exist and not expired)
- Validates password strength (8+ chars, uppercase, lowercase, number, special char)
- Updates user password
- Clears reset token
- User can immediately login with new password

### **Password Reset Email** ([server/src/utils/email.js](server/src/utils/email.js#L84))
- HTML email with reset button
- Direct reset link included
- 1-hour expiration notice
- Security reminder about unauthorized requests

**Sample:**
```
Subject: Reset Your Password - D8 LPA

We received a request to reset your password.

[Reset Password Button]
┌──────────────────────┐
│ Reset Password       │
└──────────────────────┘

Or copy this link:
https://app.d8lpa.com/reset-password?token=...

This link will expire in 1 hour.
```

---

## 🔒 Security Features

### Email Verification
- ✅ 6-digit codes (10-minute expiration)
- ✅ Codes stored hashed in database
- ✅ Rate-limited resend attempts
- ✅ Auto-cleanup of expired codes
- ✅ Email validation before sending

### Password Reset
- ✅ Cryptographically secure tokens (32-byte hex)
- ✅ 1-hour token expiration
- ✅ One-time use tokens
- ✅ Password strength requirements enforced
- ✅ Tokens cleared after use
- ✅ Generic responses (don't reveal if email exists)

### General
- ✅ HTTPS in production (enforced via Railway)
- ✅ Environment-based email sending (dev/prod)
- ✅ Logging of all auth events
- ✅ User email marked as verified before onboarding required
- ✅ Non-verified users cannot login if required

---

## 🚀 Deployment Notes

### Development Environment
- Email sending is **simulated**
- Codes and tokens logged to console for testing
- Auto-verification enabled (skips email step)
- Perfect for testing entire flow without email access

### Production Environment (Railway)
- Real email sending enabled via Gmail SMTP
- Requires `.env.production` with valid credentials
- Frontend URLs must match deployment domain
- All emails sent asynchronously (non-blocking)
- Error handling: Failed emails don't block auth flow

### Configuration Checklist
- [x] SMTP credentials configured
- [x] Frontend URL set correctly
- [x] Email templates created
- [x] Password requirements enforced
- [x] Error handling implemented
- [x] Rate limiting on resends
- [x] Token expiration working
- [x] Development/production modes working

---

## 📱 Frontend Pages

### Signup with Verification
- Location: [app/signup/page.tsx](app/signup/page.tsx)
- Features:
  - Real-time password validation
  - 6-digit code input with paste support
  - Resend button with 60-second cooldown
  - Auto-focus navigation between code inputs
  - Clear error messaging

### Forgot Password
- Location: [app/forgot-password/page.tsx](app/forgot-password/page.tsx)
- Features:
  - Simple email input
  - Confirmation message after submission
  - Link back to login
  - Privacy-conscious (doesn't reveal if email exists)

### Reset Password
- Location: [app/reset-password/page.tsx](app/reset-password/page.tsx)
- Features:
  - Token validation from URL
  - Password strength indicator
  - Confirm password field
  - Auto-redirect to login after success
  - Invalid token handling

---

## 🧪 Testing Guide

### Manual Testing (Development)

**Test Signup Verification:**
1. Navigate to `/signup`
2. Create account with any email
3. Check console logs for verification code
4. Enter code on verification screen
5. Should proceed to onboarding

**Test Password Reset:**
1. Navigate to `/forgot-password`
2. Enter email address
3. Check console logs for reset token and link
4. Copy reset link from console
5. Paste in browser URL bar
6. Enter new password
7. Login with new password

### Automated Testing
- Email utility functions are mockable
- Jest tests can use fake SMTP transporter
- Verification codes can be predefined for tests
- No external API calls required for unit tests

---

## 📊 Database Fields

### User Model ([server/src/models/User.js](server/src/models/User.js))

**Email Verification Fields:**
```javascript
email_verified: Boolean          // User has verified email
verification_code: String        // 6-digit code
verification_code_expires: Date  // When code expires
```

**Password Reset Fields:**
```javascript
password_reset_token: String     // Secure reset token
password_reset_expires: Date     // When token expires
```

---

## 🔧 Troubleshooting

### Emails Not Sending (Production)
1. Verify Gmail credentials are correct in .env.production
2. Check Gmail app password is set (2FA requirement)
3. Review email logs in server console
4. Ensure SMTP_HOST, SMTP_PORT, SMTP_USER are correct
5. Check firewall/network allows SMTP port 587

### Verification Code Not Received
1. Check spam/junk folder
2. Verify email is being sent (check console logs in dev)
3. Check email address is spelled correctly
4. Verify SMTP credentials in environment

### Reset Link Not Working
1. Ensure FRONTEND_URL matches deployment domain
2. Check token is valid and not expired (1 hour)
3. Verify database connection working
4. Check browser console for errors

---

## 🎯 Next Steps (Optional Enhancements)

If needed in future:
- [ ] SMS verification as alternative
- [ ] Two-factor authentication
- [ ] Email change verification
- [ ] Backup email addresses
- [ ] Custom email templates (MJML)
- [ ] Email delivery tracking
- [ ] Resend via SMS if email fails

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account with verification code |
| POST | `/api/auth/verify-email` | Verify email with code |
| POST | `/api/auth/resend-verification` | Resend verification code |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

---

**Status:** ✅ Production Ready
**Last Updated:** February 7, 2026
**Maintained By:** D8-LPA Development Team
