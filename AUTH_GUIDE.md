# Authentication System Guide

This guide covers the complete authentication system for Roastr.ai, including session management, refresh tokens, rate limiting, and security features.

## Table of Contents

1. [Overview](#overview)
2. [Session Management](#session-management)
3. [Token Refresh](#token-refresh)
4. [Rate Limiting](#rate-limiting)
5. [Security Features](#security-features)
6. [API Endpoints](#api-endpoints)
7. [Configuration](#configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Overview

The Roastr.ai authentication system is built on **Supabase Auth** with additional layers for enhanced security and user experience:

- **JWT-based authentication** with automatic refresh
- **Sliding expiration** for active sessions
- **Rate limiting** to prevent brute force attacks
- **Multi-tenant architecture** with Row Level Security (RLS)
- **Mock mode** for development and testing

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Supabase      │
│   React App     │◄──►│   Express API   │◄──►│   Auth Service  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └─────────────►│   Rate Limiter  │
                        │   Redis/Memory  │
                        └─────────────────┘
```

## Session Management

### Frontend Session Handling

The frontend automatically manages user sessions using local storage and HTTP headers:

```javascript
// Session storage
localStorage.setItem('access_token', session.access_token);
localStorage.setItem('refresh_token', session.refresh_token);

// Automatic refresh on API calls
const token = localStorage.getItem('access_token');
const refreshToken = localStorage.getItem('refresh_token');

fetch('/api/protected-endpoint', {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Refresh-Token': refreshToken
  }
});
```

### Session Persistence

Sessions persist across browser reloads and are automatically validated:

- **Access tokens**: Valid for 1 hour
- **Refresh tokens**: Valid for 7 days (configurable)
- **Sliding expiration**: Active users get automatic refresh

### Session State Management

```javascript
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const token = localStorage.getItem('access_token');
  if (token) {
    // Validate and load user profile
    loadUserProfile(token);
  } else {
    setLoading(false);
  }
}, []);
```

## Token Refresh

### Automatic Refresh

The session refresh middleware automatically handles token renewal:

1. **Token Expiry Check**: Tokens within 5 minutes of expiry trigger refresh
2. **Silent Refresh**: Happens transparently during API calls
3. **New Token Headers**: Returned via `X-New-Access-Token` header
4. **Frontend Update**: Client updates tokens automatically

### Backend Middleware

```javascript
// Session refresh middleware
app.use(sessionRefreshMiddleware);

// Automatic refresh flow
if (isTokenNearExpiry(token) && refreshToken) {
  const newSession = await refreshUserSession(refreshToken);
  res.set({
    'x-new-access-token': newSession.access_token,
    'x-new-refresh-token': newSession.refresh_token,
    'x-token-refreshed': 'true'
  });
}
```

### Sliding Expiration

Active users experience seamless session extension:

- **Activity Detection**: API calls reset expiration timer
- **Graceful Degradation**: Expired tokens trigger re-authentication
- **User Notification**: Clear messaging for expired sessions

### Manual Refresh Endpoint

```bash
POST /api/auth/session/refresh
Content-Type: application/json

{
  "refresh_token": "user-refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "new-jwt-token",
    "refresh_token": "new-refresh-token",
    "expires_at": 1642784400000,
    "expires_in": 3600,
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    }
  }
}
```

## Rate Limiting

### Login Attempt Limiting

Protects against brute force attacks using IP + email combination:

- **Limit**: 5 attempts per 15 minutes
- **Block Duration**: 15 minutes after limit exceeded
- **Key Generation**: SHA-256 hash of IP + email (privacy-preserving)
- **Storage**: In-memory with Redis fallback

### Rate Limit Logic

```javascript
// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const WINDOW_DURATION = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

// Key generation (privacy-preserving)
function getKey(ip, email) {
  const emailHash = crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return `${ip}:${emailHash}`;
}
```

### Rate Limit Responses

**Too Many Attempts (429):**

```json
{
  "success": false,
  "error": "Too many login attempts. Please try again later.",
  "code": "RATE_LIMITED",
  "retryAfter": 12,
  "message": "For security reasons, please wait before attempting to log in again."
}
```

### Rate Limit Metrics (Mock Mode)

```bash
GET /api/auth/rate-limit/metrics
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalAttempts": 150,
    "blockedAttempts": 8,
    "uniqueIPs": 45,
    "activeAttempts": 12,
    "currentlyBlocked": 3,
    "rateLimitEnabled": true,
    "timestamp": 1642784400000
  }
}
```

## Security Features

### JWT Validation

All protected endpoints validate JWT tokens:

```javascript
const authenticateToken = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

### Request Sanitization

OAuth parameters are sanitized to prevent injection:

```javascript
function sanitizePlatform(platform) {
  if (!platform || typeof platform !== 'string') {
    throw new Error('Platform parameter is required');
  }

  // Remove dangerous characters
  const sanitized = platform.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (!SUPPORTED_PLATFORMS.includes(sanitized)) {
    throw new Error(`Unsupported platform: ${sanitized}`);
  }

  return sanitized;
}
```

### State Parameter Validation

OAuth state parameters use secure validation:

```javascript
function generateState(userId, platform) {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const payload = `${userId}:${platform}:${timestamp}:${random}`;
  return Buffer.from(payload).toString('base64url');
}

function parseState(state) {
  const payload = Buffer.from(state, 'base64url').toString();
  const [userId, platform, timestamp, random] = payload.split(':');

  const age = Date.now() - parseInt(timestamp);
  const maxAge = 10 * 60 * 1000; // 10 minutes

  if (age > maxAge) {
    throw new Error('State parameter expired');
  }

  return { userId, platform, timestamp: parseInt(timestamp) };
}
```

### Error Message Security

Generic error messages prevent user enumeration:

- **Login failures**: "Wrong email or password" (never reveals if email exists)
- **Password resets**: "If account exists, reset link sent" (always success response)
- **Rate limiting**: Generic messages without specific timing information

## API Endpoints

### Authentication Endpoints

| Endpoint                    | Method | Description          | Auth Required |
| --------------------------- | ------ | -------------------- | ------------- |
| `/api/auth/register`        | POST   | Register new user    | No            |
| `/api/auth/login`           | POST   | Email/password login | No            |
| `/api/auth/magic-link`      | POST   | Send magic link      | No            |
| `/api/auth/logout`          | POST   | Logout user          | Yes           |
| `/api/auth/me`              | GET    | Get user profile     | Yes           |
| `/api/auth/session/refresh` | POST   | Refresh session      | No            |
| `/api/auth/reset-password`  | POST   | Send reset email     | No            |
| `/api/auth/update-password` | POST   | Update password      | Special       |

### Admin Endpoints

| Endpoint                            | Method | Description          | Admin Required |
| ----------------------------------- | ------ | -------------------- | -------------- |
| `/api/auth/admin/users`             | GET    | List all users       | Yes            |
| `/api/auth/admin/users`             | POST   | Create user manually | Yes            |
| `/api/auth/admin/users/:id`         | GET    | Get user details     | Yes            |
| `/api/auth/admin/users/:id`         | DELETE | Delete user          | Yes            |
| `/api/auth/admin/users/:id/suspend` | POST   | Suspend user         | Yes            |
| `/api/auth/admin/users/:id/plan`    | POST   | Update user plan     | Yes            |

### Rate Limiting Endpoints

| Endpoint                       | Method | Description          | Access         |
| ------------------------------ | ------ | -------------------- | -------------- |
| `/api/auth/rate-limit/metrics` | GET    | Get rate limit stats | Mock only      |
| `/api/auth/rate-limit/reset`   | POST   | Reset rate limit     | Mock/Test only |

## Configuration

### Environment Variables

**Required:**

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Feature Flags
ENABLE_SESSION_REFRESH=true
ENABLE_RATE_LIMIT=true
```

**Optional:**

```bash
# Debug Settings
DEBUG_SESSION=false
DEBUG_RATE_LIMIT=false

# Mock Mode (Development)
ENABLE_MOCK_MODE=false

# Rate Limiting
RATE_LIMIT_MAX_ATTEMPTS=5
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_BLOCK_MINUTES=15
```

### Frontend Configuration

```bash
# React Environment Variables
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_ENABLE_SESSION_REFRESH=true
REACT_APP_ENABLE_MOCK_MODE=false
```

### Feature Flags

```javascript
const { flags } = require('./src/config/flags');

// Check if feature is enabled
if (flags.isEnabled('ENABLE_SESSION_REFRESH')) {
  // Enable automatic session refresh
}

if (flags.isEnabled('ENABLE_RATE_LIMIT')) {
  // Apply rate limiting middleware
}
```

## Testing

### Unit Tests

```bash
# Run authentication tests
npm test -- tests/unit/middleware/sessionRefresh.test.js
npm test -- tests/unit/middleware/rateLimiter.test.js

# Run auth service tests
npm test -- tests/unit/services/authService.test.js
```

### Integration Tests

```bash
# Run authentication integration tests
npm test -- tests/integration/auth.test.js

# Run OAuth mock tests
npm test -- tests/integration/oauth-mock.test.js
```

### Frontend Tests

```bash
# Run React component tests
npm test -- src/__tests__/auth/

# Run E2E authentication tests
npm run test:e2e -- --grep "authentication"
```

### Mock Mode Testing

Enable mock mode for predictable testing:

```bash
# Enable mock mode
ENABLE_MOCK_MODE=true npm test

# Test session refresh
curl -X POST http://localhost:3000/api/auth/session/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "mock-refresh-token"}'

# Test rate limiting
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrong"}' \
    -w "\n%{http_code}\n"
done
```

## Troubleshooting

### Common Issues

**1. Token Refresh Not Working**

Check headers are being sent:

```javascript
// Ensure refresh token header is included
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'X-Refresh-Token': refreshToken
}
```

**2. Rate Limiting Too Aggressive**

Adjust configuration:

```bash
# Increase limits temporarily
RATE_LIMIT_MAX_ATTEMPTS=10
RATE_LIMIT_WINDOW_MINUTES=30
```

**3. Session Not Persisting**

Check local storage:

```javascript
// Debug session storage
console.log('Access Token:', localStorage.getItem('access_token'));
console.log('Refresh Token:', localStorage.getItem('refresh_token'));
```

**4. CORS Issues with Refresh**

Ensure proper CORS headers:

```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['X-New-Access-Token', 'X-New-Refresh-Token']
  })
);
```

### Debug Mode

Enable debug logging:

```bash
# Backend debugging
DEBUG_SESSION=true
DEBUG_RATE_LIMIT=true

# Frontend debugging
REACT_APP_DEBUG_AUTH=true
```

**Debug Output:**

```
Session middleware: Token near expiry, attempting refresh
Rate limiter: Recording attempt for key 192.168.1.1:a1b2c3d4
OAuth: Mock connection initiated for user123:twitter
```

### Health Checks

**Session Health:**

```bash
GET /api/auth/me
Authorization: Bearer <token>
```

**Rate Limit Status:**

```bash
GET /api/auth/rate-limit/metrics
```

**Feature Flag Status:**

```bash
GET /api/health
```

### Performance Monitoring

Monitor authentication performance:

- **Token refresh latency**: < 200ms target
- **Rate limit check time**: < 10ms target
- **Failed login rate**: < 5% target
- **Session expiry rate**: < 1% for active users

### Security Monitoring

Watch for security indicators:

- **High rate limit triggers**: Possible attack
- **Unusual refresh patterns**: Potential token theft
- **Geographic anomalies**: Account compromise
- **Bulk registration**: Spam/bot activity

## Best Practices

### Frontend

1. **Always handle token refresh transparently**
2. **Show clear error messages for expired sessions**
3. **Implement proper logout flows**
4. **Store tokens securely (avoid XSS)**
5. **Handle offline/online state changes**

### Backend

1. **Validate all JWT tokens on protected routes**
2. **Use environment variables for secrets**
3. **Implement proper error handling**
4. **Log security events appropriately**
5. **Regular security audits**

### Production Deployment

1. **Use HTTPS only in production**
2. **Set secure cookie flags**
3. **Configure proper CORS policies**
4. **Enable rate limiting in production**
5. **Monitor authentication metrics**
6. **Regular token rotation**

This authentication system provides enterprise-grade security while maintaining excellent user experience through features like automatic refresh and intelligent rate limiting.
