# Security Implementation Guide

## Overview
This document outlines all security measures implemented for the D8-LPA dating application, covering both frontend and backend security.

---

## 1. Environment-Based Logging (Production Safety)

### Frontend (`lib/logger.ts`)
```typescript
- Automatically disables all console logs in production (NODE_ENV=production)
- Suppresses console.log, console.warn, console.info, console.debug, console.error
- Maintains logger utility for controlled logging in development
```

### Backend (`server/src/utils/logger.js`)
```javascript
- Environment-aware logging that respects NODE_ENV
- Minimizes logs in production to prevent information leakage
- Maintains security event logging for audit trails
- Request logging abbreviated in production
```

### Implementation Pattern
Every route and script now imports and uses:
```javascript
import logger from '../utils/logger.js';
logger.log('message');  // Only shows in development
logger.security('event'); // Always logs for audit trail
```

---

## 2. Security Headers (Helmet)

### Implemented Headers
- **X-Content-Type-Options**: nosniff - Prevents MIME type sniffing
- **X-Frame-Options**: DENY - Prevents clickjacking attacks
- **X-XSS-Protection**: Enabled - XSS filtering in older browsers
- **Content-Security-Policy**: Strict directives for script, style, and resource origins
- **Strict-Transport-Security**: 1 year max-age with subdomains and preload
- **Referrer-Policy**: strict-origin-when-cross-origin - Prevents referrer leakage

### Configuration Location
`server/src/middleware/security.js` - `securityHeaders()` function

---

## 3. Rate Limiting

### API Rate Limiter
- **Limit**: 100 requests per 15 minutes per IP
- **Applied to**: All `/api/*` routes
- **Response**: 429 (Too Many Requests)

### Auth Rate Limiter (Brute Force Protection)
- **Limit**: 5 login attempts per 15 minutes per IP
- **Applied to**: `/api/auth/login`
- **Purpose**: Prevents brute force password attacks

### Signup Rate Limiter
- **Limit**: 5 registrations per hour per IP
- **Applied to**: `/api/auth/signup`
- **Purpose**: Prevents registration spam and bot abuse

### Implementation
Located in `server/src/middleware/security.js` - `createLimiters()` function

---

## 4. Request Validation & Sanitization

### NoSQL Injection Prevention
- Sanitizes all incoming data against NoSQL injection
- Uses `express-mongo-sanitize` middleware
- Replaces prohibited characters automatically
- Logs sanitization events for security monitoring

### Parameter Pollution Prevention (HPP)
- Prevents HTTP Parameter Pollution attacks
- Uses `hpp` middleware with whitelist of safe parameters
- Whitelisted params: sort, page, limit, fields, search

### Request Size Limits
- JSON payload limit: 10MB
- URL-encoded payload limit: 10MB
- File uploads (S3): 5MB per file
- Prevents large payload DoS attacks

### Input Validation
- Content-Type validation for POST/PUT/PATCH requests
- Rejects unsupported media types
- Validates email format with `express-validator`
- All passwords validated for complexity:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (!@#$%^&*(),.?":{}|<>)

---

## 5. Password Security

### Password Hashing
- Uses `bcryptjs` library with automatic salting
- Applied to all user passwords at registration and reset
- Passwords never stored in plaintext

### Password Complexity Requirements
Enforced at signup with:
```javascript
- Min 8 characters
- 1 uppercase letter
- 1 lowercase letter
- 1 number
- 1 special character
```

### Password Reset Flow
1. User requests password reset via email
2. Unique reset token generated (15 minute expiration)
3. Reset link sent securely via email
4. Token validated before allowing password change
5. New password must meet complexity requirements

---

## 6. JWT Token Security

### Token Configuration
- **Access Token**: 7 days expiration
- **Refresh Token**: 30 days expiration
- **Secret**: Stored in environment variables only
- **Claims**: User ID included in token
- **Algorithm**: HS256 (HMAC SHA-256)

### Token Validation
Applied to all protected routes via `auth` middleware:
- Verifies token signature
- Checks token expiration
- Extracts user ID for request context

---

## 7. CORS Configuration

### Development Mode
```javascript
Allowed origins: 
- http://localhost:3000
- http://localhost:3001
- https://*.vercel.app
```

### Production Mode
```javascript
Allowed origins:
- https://*.vercel.app (only production domain)
```

### Configuration
- `credentials: true` - Allows cookies/auth headers
- `maxAge: 86400` - 24 hours cache for preflight
- Explicit methods: GET, POST, PUT, DELETE, PATCH
- Explicit headers: Content-Type, Authorization

---

## 8. Environment-Based Security

### Production (NODE_ENV=production)
- ✅ All logs disabled (except security events)
- ✅ Detailed error messages suppressed
- ✅ Email verification required
- ✅ Development tools disabled
- ✅ Rate limiting enforced
- ✅ Helmet security headers enabled
- ✅ S3 data stored in `/production/` folder

### Development (NODE_ENV=development)
- ✅ Full logging enabled for debugging
- ✅ Detailed error messages with stack traces
- ✅ Email verification auto-skipped
- ✅ Dev banner displayed in UI
- ✅ Console errors visible
- ✅ S3 data stored in `/development/` folder

---

## 9. Data Storage Security

### S3 Bucket Organization
```
s3://d8-lpa-app-demo/
├── production/
│   └── users/
│       └── {userId}/
│           ├── photos/
│           └── profilePicture/
└── development/
    └── users/
        └── {userId}/
            ├── photos/
            └── profilePicture/
```

### AWS Credentials
- Stored only in root `.env` file
- Never committed to version control
- Environment variables only in process
- Accessed via `process.env` at runtime

---

## 10. Error Handling

### Production Error Response
```javascript
// Returns minimal info to prevent info leakage
{
  "message": "Internal server error",
  "status": 500
}
```

### Development Error Response
```javascript
// Returns detailed error info for debugging
{
  "message": "Specific error message",
  "status": 500,
  "stack": "Full stack trace..."
}
```

### Implementation
`server/src/middleware/security.js` - `errorHandler()` function

---

## 11. Security Event Logging

### Logged Events
- Failed login attempts
- Duplicate registration attempts
- Invalid verification codes
- Rate limit exceeded
- NoSQL injection attempts
- Parameter pollution attempts
- Password reset requests
- Account delete/disable actions

### Log Format
```javascript
logger.security('Event type', details, timestamp)
```

### Audit Trail
Security events are always logged for compliance and investigation purposes.

---

## 12. HTTPS Enforcement

### Strict-Transport-Security (HSTS)
- **Max-Age**: 31,536,000 seconds (1 year)
- **includeSubDomains**: true
- **Preload**: true (for browser preload list)

This ensures all subsequent connections use HTTPS.

---

## 13. Cookie Security (If Applicable)

### Secure Attributes
When cookies are used (not currently, but if added):
- `secure: true` - Only sent over HTTPS
- `httpOnly: true` - Not accessible via JavaScript
- `sameSite: 'Strict'` - CSRF protection

---

## 14. Database Security

### MongoDB
- Credentials stored in environment variables
- Connection string never logged or exposed
- Input validation prevents injection
- No dynamic query construction from user input

### Schema Validation
- Mongoose enforces field types
- Enum values restrict invalid data
- Required fields prevent null injections

---

## 15. Email Security

### Email Verification
- Production only (auto-skipped in dev)
- 10-minute code expiration
- Unique 6-digit codes
- Cannot be reused

### Password Reset
- 15-minute token expiration
- Unique cryptographic tokens
- HTTPS-only reset link
- Token validated before password change

---

## 16. File Upload Security

### Validation
- **Type**: Image files only (validated by MIME type)
- **Size**: 5MB maximum per file
- **Naming**: Random names prevent traversal attacks
- **Storage**: S3 bucket with environment isolation

### S3 Upload Process
1. Receive file with multipart/form-data
2. Validate file type (image/* only)
3. Validate file size (< 5MB)
4. Generate secure filename with random string
5. Upload to S3 with environment prefix
6. Return signed S3 URL
7. Add URL to user's photos array

---

## 17. Security Headers Summary

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | MIME type sniffing prevention |
| X-Frame-Options | DENY | Clickjacking prevention |
| X-XSS-Protection | 1; mode=block | XSS filtering |
| Strict-Transport-Security | max-age=31536000 | HTTPS enforcement |
| Content-Security-Policy | Restrictive directives | XSS and injection prevention |
| Referrer-Policy | strict-origin-when-cross-origin | Information leakage prevention |

---

## 18. Security Dependencies

### Installed Packages
```json
{
  "helmet": "^7.1.0",              // Security headers
  "express-rate-limit": "^7.1.5", // Rate limiting
  "express-mongo-sanitize": "^2.2.0", // NoSQL injection
  "hpp": "^0.2.3",                 // Parameter pollution
  "bcryptjs": "^2.4.3",            // Password hashing
  "jsonwebtoken": "^9.0.2",        // JWT tokens
  "express-validator": "^7.2.0"    // Input validation
}
```

---

## 19. Security Checklist

- ✅ Helmet security headers enabled
- ✅ Rate limiting on all routes
- ✅ Rate limiting on auth endpoints
- ✅ Rate limiting on signup
- ✅ CORS properly configured
- ✅ NoSQL injection prevention
- ✅ Parameter pollution prevention
- ✅ Password complexity required
- ✅ Password hashing with bcrypt
- ✅ JWT tokens with expiration
- ✅ Production logging disabled
- ✅ Error messages hidden in production
- ✅ S3 data organized by environment
- ✅ Email verification in production
- ✅ Request size limits enforced
- ✅ Content-Type validation
- ✅ Security event logging
- ✅ Development banner for dev mode

---

## 20. Deployment Security Recommendations

### Pre-Deployment
1. ✅ Verify `NODE_ENV=production` in environment
2. ✅ Verify all environment variables are set in production
3. ✅ Use a `.env.production` file for production secrets
4. ✅ Never commit `.env` files
5. ✅ Rotate JWT_SECRET before production
6. ✅ Update MONGODB_URI for production database
7. ✅ Configure production domain in CORS
8. ✅ Enable HTTPS on production server
9. ✅ Set strong passwords for database
10. ✅ Review and test all security middleware

### Post-Deployment
1. ✅ Monitor security event logs regularly
2. ✅ Set up alerts for rate limit violations
3. ✅ Regularly update dependencies for security patches
4. ✅ Use `npm audit` to check for vulnerabilities
5. ✅ Implement Web Application Firewall (WAF)
6. ✅ Set up DDoS protection (Cloudflare, AWS Shield)
7. ✅ Enable database backups
8. ✅ Implement database access logs
9. ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault)
10. ✅ Set up security monitoring and alerting

---

## Summary

This application implements a multi-layered security approach covering:
- **Authentication**: JWT tokens with expiration, password complexity
- **Authorization**: User middleware validation
- **Encryption**: HTTPS enforcement, bcrypt password hashing
- **Input Validation**: NoSQL injection, parameter pollution, type checking
- **Rate Limiting**: Brute force, DoS prevention
- **Error Handling**: Safe error responses in production
- **Logging**: Security event auditing, development-only verbose logging
- **Data Isolation**: Environment-based S3 folder structure
- **HTTP Headers**: Comprehensive security headers via Helmet

All these measures work together to create a secure, production-ready application.
