# API Logging Setup

## Overview
Enhanced logging has been added to all API middlewares and routes to track request payloads, responses, and errors.

## Changes Made

### 1. **Enhanced Request Logger Middleware** (`server/src/middleware/security.js`)
   - Logs incoming requests with full payloads (POST/PUT/PATCH)
   - Logs outgoing responses with status codes and response data
   - Automatically redacts sensitive fields (password, token, secret, api_key, etc.)
   - Generates unique request IDs for tracking
   - Includes response timing information
   - Logs errors with full context

### 2. **Enhanced Error Handler Middleware** (`server/src/middleware/security.js`)
   - Logs all errors with full stack traces in development
   - Logs minimal safe information in production
   - Includes request context (method, path, user, IP)
   - Request ID correlation for tracking

### 3. **Updated Logger Utility** (`server/src/utils/logger.js`)
   - Added timestamps to all log entries
   - New `logger.api.*` methods for structured API logging
   - Always logs errors (even in production)
   - Development-aware logging to reduce noise in production

### 4. **Enhanced Auth Routes** (`server/src/routes/auth.js`)
   - **Login Endpoint** (`/auth/login`):
     - Logs login attempts with email
     - Logs validation errors
     - Logs successful/failed authentication attempts
     - Logs account status checks (banned, suspended)
     
   - **Forgot Password** (`/auth/forgot-password`):
     - Logs password reset requests
     - Logs reset token generation
     - Logs email sending success/failure
     - Shows reset link in development
     - Detailed error logging for email failures
     
   - **Reset Password** (`/auth/reset-password`):
     - Logs reset attempts
     - Validates token and expiry
     - Logs password strength validation
     - Logs successful password updates

## Log Format

### Request Log Example
```json
{
  "requestId": "1707068400000-a1b2c3d4e",
  "timestamp": "2025-02-03T12:30:45.123Z",
  "method": "POST",
  "path": "/api/auth/login",
  "query": {},
  "userId": "user123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "payload": {
    "email": "user@example.com",
    "password": "***REDACTED***"
  }
}
```

### Response Log Example
```json
{
  "requestId": "1707068400000-a1b2c3d4e",
  "timestamp": "2025-02-03T12:30:45.456Z",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200,
  "duration": "245ms",
  "userId": "user123",
  "ip": "192.168.1.1",
  "response": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "email_verified": true
    },
    "token": "***REDACTED***"
  }
}
```

### Error Log Example
```json
{
  "requestId": "1707068400000-a1b2c3d4e",
  "timestamp": "2025-02-03T12:30:45.789Z",
  "method": "POST",
  "path": "/api/auth/forgot-password",
  "statusCode": 500,
  "error": "SMTP connection failed",
  "userId": "anonymous",
  "ip": "192.168.1.1"
}
```

## Sensitive Data Redaction

The following fields are automatically redacted in logs:
- `password`
- `token`
- `authorization`
- `secret`
- `api_key`
- `apiKey`
- `refresh_token`

This ensures sensitive information is never exposed in logs while maintaining debugging capabilities.

## Environment-Aware Behavior

### Development (`NODE_ENV=development`)
- Full request/response payloads logged
- Stack traces included in errors
- All log levels output

### Production (`NODE_ENV=production`)
- Request/response payloads still logged (for debugging)
- Stack traces omitted from errors
- Minimal safe information in error responses
- Error logs always captured for audit trail

## How to View Logs

### Local Development
```bash
npm run dev
# or
node server/src/index.js
```
All logs will appear in console output.

### Railway Production
1. Go to your BE-DLPA service in Railway dashboard
2. Click the **"Logs"** tab
3. Filter by log level or search for keywords
4. Use Request IDs to correlate logs across multiple entries

## Example Log Queries

### Search for failed login attempts:
```
[LOGIN] Invalid password
```

### Search for password reset requests:
```
[FORGOT-PASSWORD] Reset token generated
```

### Search for email errors:
```
[FORGOT-PASSWORD] Failed to send email
```

### Track a specific user's activity:
```
user123
```

### Find errors:
```
[API ERROR]
```

## Next Steps

1. Deploy to production with new environment variables
2. Monitor logs for "SMTP" or "email" errors
3. Check for "[FORGOT-PASSWORD]" entries to confirm reset flow
4. Use request IDs to track issues end-to-end

## Troubleshooting

### If password reset emails aren't sending:
1. Check Railway logs for `[FORGOT-PASSWORD]` entries
2. Look for `Failed to send email` errors
3. Verify SMTP environment variables are set in Railway:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM_EMAIL`
   - `SMTP_FROM_NAME`
   - `FRONTEND_URL`

### If login is failing:
1. Search logs for `[LOGIN]` entries
2. Check for validation or authentication errors
3. Verify JWT_SECRET is set in environment

