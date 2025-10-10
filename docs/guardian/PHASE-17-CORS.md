# Guardian API - CORS Configuration Guide

**Phase 17: Governance Interface & Alerts**
**Last Updated:** October 10, 2025

---

## Overview

The Guardian Dashboard (admin-dashboard React frontend) makes API calls to the Guardian backend server. Since the frontend and backend run on different origins during development, proper CORS (Cross-Origin Resource Sharing) configuration is required to allow the browser to make these requests.

This document provides guidance on configuring CORS headers for the Guardian API backend.

---

## Required CORS Headers

The Guardian backend must return the following CORS headers to allow the frontend to make API calls:

### Essential Headers

```http
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

### Header Explanations

| Header | Purpose | Guardian Value |
|--------|---------|----------------|
| `Access-Control-Allow-Origin` | Specifies which origins can access the API | `http://localhost:3000` (dev), specific domain (prod) |
| `Access-Control-Allow-Methods` | HTTP methods allowed for cross-origin requests | `GET, POST, PUT, DELETE, PATCH, OPTIONS` |
| `Access-Control-Allow-Headers` | Headers the client can send in actual requests | `Content-Type, Authorization, X-Requested-With` |
| `Access-Control-Allow-Credentials` | Whether credentials (cookies, auth headers) are allowed | `true` |
| `Access-Control-Max-Age` | How long preflight results can be cached (seconds) | `86400` (24 hours) |

---

## Express.js Implementation

If the Guardian backend uses Express.js, configure CORS using the `cors` middleware:

### Installation

```bash
npm install cors
```

### Basic Configuration

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Your Guardian API routes
app.get('/api/guardian/cases', (req, res) => {
  // Handle request
});

app.post('/api/guardian/cases/:caseId/approve', (req, res) => {
  // Handle request
});

app.listen(3001, () => {
  console.log('Guardian API running on http://localhost:3001');
});
```

### Advanced Configuration (Multiple Origins)

For production environments with multiple frontend origins (e.g., staging + production):

```javascript
const allowedOrigins = [
  'http://localhost:3000',           // Local development
  'https://staging.roastr-ai.com',   // Staging environment
  'https://app.roastr-ai.com'        // Production
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
```

---

## Environment-Based Configuration

Use environment variables to configure CORS based on the deployment environment:

```javascript
// .env.development
FRONTEND_URL=http://localhost:3000
CORS_ENABLED=true

// .env.production
FRONTEND_URL=https://app.roastr-ai.com
CORS_ENABLED=true

// .env.test
FRONTEND_URL=http://localhost:3000
CORS_ENABLED=false
```

```javascript
// server.js
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};

if (process.env.CORS_ENABLED === 'true') {
  app.use(cors(corsOptions));
}
```

---

## Preflight Requests (OPTIONS)

Browsers send an OPTIONS preflight request before certain cross-origin requests (e.g., requests with custom headers, PUT/DELETE methods). The `cors` middleware handles this automatically, but if implementing CORS manually, you must handle OPTIONS requests:

```javascript
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(204); // No Content
});
```

---

## Testing CORS Configuration

### 1. Browser DevTools

Open the Guardian Dashboard in your browser and check the Network tab:

1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Network tab
3. Reload the page
4. Click on any API request to the Guardian backend
5. Check the **Response Headers** section for CORS headers

**Expected Headers:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

If these headers are missing, CORS is not configured correctly.

### 2. cURL Command

Test CORS headers using cURL:

```bash
# Test preflight request
curl -i -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3001/api/guardian/cases

# Expected output:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
# Access-Control-Allow-Credentials: true
# Access-Control-Max-Age: 86400
```

### 3. Fetch API Test

Test CORS from the browser console:

```javascript
fetch('http://localhost:3001/api/guardian/cases', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' // Important for cookies/auth
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('CORS Error:', error));
```

**If CORS is not configured:**
```
Access to fetch at 'http://localhost:3001/api/guardian/cases' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**If CORS is configured correctly:**
```
Success: { cases: [...], total: 5 }
```

---

## Common CORS Errors

### Error 1: "No 'Access-Control-Allow-Origin' header"

**Error Message:**
```
Access to fetch at 'http://localhost:3001/api/guardian/cases' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solution:**
- Ensure `cors` middleware is configured and applied: `app.use(cors(corsOptions))`
- Check that `origin` in `corsOptions` matches the frontend origin

### Error 2: "The 'Access-Control-Allow-Origin' header contains multiple values"

**Error Message:**
```
The 'Access-Control-Allow-Origin' header contains multiple values 'http://localhost:3000, http://localhost:3000',
but only one is allowed.
```

**Solution:**
- CORS middleware is applied multiple times
- Ensure `app.use(cors(corsOptions))` is only called once
- Check that no other middleware is adding CORS headers

### Error 3: "Credentials mode is 'include' but the 'Access-Control-Allow-Credentials' header is ''"

**Error Message:**
```
Access to fetch at 'http://localhost:3001/api/guardian/cases' from origin 'http://localhost:3000'
has been blocked by CORS policy: The value of the 'Access-Control-Allow-Credentials' header in the response is ''
which must be 'true' when the request's credentials mode is 'include'.
```

**Solution:**
- Add `credentials: true` to `corsOptions`
- Ensure frontend fetch requests include `credentials: 'include'`

### Error 4: "Method not allowed by Access-Control-Allow-Methods"

**Error Message:**
```
Access to fetch at 'http://localhost:3001/api/guardian/cases/123/approve' from origin 'http://localhost:3000'
has been blocked by CORS policy: Method POST is not allowed by Access-Control-Allow-Methods in preflight response.
```

**Solution:**
- Add the method to `methods` array in `corsOptions`
- Example: `methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']`

---

## Production Considerations

### Security Best Practices

1. **Never use `'*'` for `Access-Control-Allow-Origin` in production**
   ```javascript
   // ❌ BAD - Allows any origin
   origin: '*'

   // ✅ GOOD - Specific origins only
   origin: 'https://app.roastr-ai.com'
   ```

2. **Use environment variables for origins**
   ```javascript
   origin: process.env.FRONTEND_URL
   ```

3. **Restrict methods to only what's needed**
   ```javascript
   // If Guardian API only uses GET and POST:
   methods: ['GET', 'POST', 'OPTIONS']
   ```

4. **Set credentials to `true` only if needed**
   - If API uses cookies or Authorization headers → `credentials: true`
   - If API is stateless with public data → `credentials: false`

### Performance Optimization

1. **Increase `maxAge` in production**
   ```javascript
   maxAge: 86400 // 24 hours - reduces preflight requests
   ```

2. **Cache CORS responses at CDN level**
   - Configure CDN to cache OPTIONS responses
   - Reduces load on backend server

3. **Use API Gateway for CORS**
   - Let API Gateway (e.g., AWS API Gateway, Kong) handle CORS
   - Simplifies backend code

---

## Guardian API Endpoints

The following Guardian API endpoints require CORS configuration:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guardian/cases` | GET | Fetch Guardian cases with filtering |
| `/api/guardian/cases/:caseId/approve` | POST | Approve a Guardian case |
| `/api/guardian/cases/:caseId/deny` | POST | Deny a Guardian case |
| `/api/guardian/cases/:caseId/diff` | GET | Get structured diff for a case |
| `/api/guardian/health` | GET | Get Guardian system health status |

All endpoints require:
- `Content-Type: application/json` header
- CORS headers as specified above
- Authentication (if implemented): `Authorization: Bearer <token>`

---

## Integration with Guardian Dashboard

The Guardian Dashboard (React frontend) uses `fetch` API from `admin-dashboard/src/api/guardianApi.ts`:

```typescript
// Fetch Guardian cases
export async function fetchGuardianCases(
  params?: GuardianCaseListParams
): Promise<GuardianCaseListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.severity) queryParams.append('severity', params.severity);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `${API_BASE_URL}/api/guardian/cases${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ⚠️ Requires CORS credentials: true
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cases: ${response.statusText}`);
  }

  return response.json();
}
```

**Key Points:**
- Uses `credentials: 'include'` → Backend MUST have `credentials: true` in CORS config
- Uses `Content-Type: application/json` → Backend MUST allow this header
- API base URL configured via `API_BASE_URL` environment variable

---

## Troubleshooting Checklist

If CORS errors occur, verify:

- [ ] `cors` middleware installed: `npm install cors`
- [ ] CORS middleware applied: `app.use(cors(corsOptions))`
- [ ] `origin` matches frontend URL exactly (including protocol and port)
- [ ] `credentials: true` in backend config
- [ ] `credentials: 'include'` in frontend fetch requests
- [ ] `Content-Type` and `Authorization` headers allowed
- [ ] OPTIONS method allowed in CORS config
- [ ] Environment variables correctly set (`.env` file)
- [ ] No conflicting CORS headers from other middleware
- [ ] Backend server running on correct port (e.g., 3001)
- [ ] Frontend running on correct port (e.g., 3000)

---

## References

- **CORS MDN Documentation**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Express CORS Middleware**: https://github.com/expressjs/cors
- **Guardian Dashboard**: `admin-dashboard/src/api/guardianApi.ts`
- **Guardian Backend**: (To be implemented - location TBD)

---

## Next Steps

1. **Implement Guardian Backend API** with CORS configuration
2. **Test CORS** using browser DevTools and cURL
3. **Configure environment variables** for development and production
4. **Update Guardian Dashboard** with correct `API_BASE_URL`
5. **Deploy to staging** and verify CORS works across environments

---

**Related Documentation:**
- [Phase 17 README](./PHASE-17-README.md)
- [Guardian Agent Phase 16](../../spec.md#guardian-agent-phase-16)
- [API Integration Guide](../../spec.md#api-integration)

---

[← Back to Phase 17 README](./PHASE-17-README.md)
