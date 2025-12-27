# Flow: Login & Registration

**Created:** 2025-10-19
**Updated:** 2025-10-19 (Issue #593)
**Status:** Production Ready
**Related Nodes:** `multi-tenant`, `billing`
**Implementation:** 100% Complete

---

## Overview

The Login & Registration flow handles user authentication, session management, and multi-tenant organization isolation. It uses Supabase Auth for JWT-based authentication with Row Level Security (RLS) enforcement at the database level.

---

## Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant SupabaseAuth
    participant Database
    participant RLS

    %% Registration Flow
    rect rgb(200, 220, 240)
        Note over User,RLS: Registration Flow
        User->>Frontend: Fill registration form
        Frontend->>API: POST /api/auth/register
        API->>SupabaseAuth: createUser(email, password)
        SupabaseAuth->>Database: INSERT INTO auth.users
        Database->>Database: Trigger: create default org
        Database-->>SupabaseAuth: User created + org_id
        SupabaseAuth-->>API: JWT token + refresh token
        API-->>Frontend: { token, user, organization }
        Frontend->>Frontend: Store tokens (localStorage)
        Frontend-->>User: Redirect to dashboard
    end

    %% Login Flow
    rect rgb(220, 240, 200)
        Note over User,RLS: Login Flow
        User->>Frontend: Enter credentials
        Frontend->>API: POST /api/auth/login
        API->>SupabaseAuth: signInWithPassword(email, password)
        SupabaseAuth->>Database: SELECT FROM auth.users
        SupabaseAuth-->>API: JWT token + refresh token
        API->>Database: SELECT FROM users (with RLS)
        RLS->>RLS: Validate auth.uid() = user.id
        Database-->>API: User profile + organizations
        API-->>Frontend: { token, user, organizations }
        Frontend->>Frontend: Store tokens (localStorage)
        Frontend-->>User: Redirect to dashboard
    end

    %% Session Validation
    rect rgb(240, 220, 200)
        Note over User,RLS: Session Validation (Page Reload)
        User->>Frontend: Reload page
        Frontend->>Frontend: Read token from localStorage
        Frontend->>API: GET /api/auth/session
        API->>SupabaseAuth: getUser(token)
        SupabaseAuth-->>API: User data or 401 Unauthorized
        alt Token Valid
            API->>Database: SELECT FROM users (with RLS)
            Database-->>API: User profile
            API-->>Frontend: { user, organizations }
            Frontend-->>User: Show dashboard
        else Token Expired
            API-->>Frontend: 401 Unauthorized
            Frontend->>API: POST /api/auth/refresh
            API->>SupabaseAuth: refreshSession(refreshToken)
            SupabaseAuth-->>API: New JWT token
            API-->>Frontend: { token, user }
            Frontend->>Frontend: Update localStorage
            Frontend-->>User: Show dashboard
        else Token Invalid
            API-->>Frontend: 401 Unauthorized
            Frontend->>Frontend: Clear localStorage
            Frontend-->>User: Redirect to login
        end
    end

    %% Token Refresh
    rect rgb(240, 200, 220)
        Note over User,RLS: Token Refresh (Before Expiry)
        Frontend->>Frontend: Check token expiry (every 5 min)
        alt Expires in < 15 minutes
            Frontend->>API: POST /api/auth/refresh
            API->>SupabaseAuth: refreshSession(refreshToken)
            SupabaseAuth-->>API: New JWT token
            API-->>Frontend: { token }
            Frontend->>Frontend: Update localStorage
        end
    end
```

---

## Components

### Frontend

**責任:**

- Form validation (email format, password strength)
- Token storage (localStorage)
- Automatic token refresh (background)
- Session validation on page load

**Files:**

- `public/js/auth.js` - Auth logic
- `public/login.html` - Login form
- `public/register.html` - Registration form

### API Endpoints

#### POST `/api/auth/register`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "organization_name": "Acme Inc" // Optional
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "plan": "free"
    },
    "organization": {
      "id": "uuid",
      "name": "Acme Inc",
      "slug": "acme-inc"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**

- `400 Bad Request` - Invalid email or password
- `409 Conflict` - Email already registered
- `500 Internal Server Error` - Database error

---

#### POST `/api/auth/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "plan": "pro",
      "roasting_enabled": true
    },
    "organizations": [
      {
        "id": "uuid",
        "name": "Acme Inc",
        "role": "owner"
      }
    ],
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**

- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account suspended
- `500 Internal Server Error` - Database error

---

#### GET `/api/auth/session`

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "plan": "pro"
    },
    "organizations": [...]
  }
}
```

**Errors:**

- `401 Unauthorized` - Token expired or invalid
- `500 Internal Server Error` - Database error

---

#### POST `/api/auth/refresh`

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**

- `401 Unauthorized` - Refresh token invalid or expired
- `500 Internal Server Error` - Auth service error

---

## Database

### Tables

#### `auth.users` (Supabase Auth)

Managed by Supabase Auth:

- `id` (UUID, PK)
- `email` (VARCHAR, UNIQUE)
- `encrypted_password` (VARCHAR)
- `email_confirmed_at` (TIMESTAMPTZ)
- `created_at`, `updated_at`

#### `users` (Public Schema)

Application-specific user data:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  roasting_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policy:**

```sql
CREATE POLICY user_isolation ON users
  FOR ALL USING (auth.uid() = id);
```

#### `organizations` (Multi-Tenant)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policy:**

```sql
CREATE POLICY org_isolation ON organizations
  FOR ALL USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Session Management

### Token Lifecycle

```
Registration/Login
    ↓
Generate JWT (expires in 1 hour)
Generate Refresh Token (expires in 30 days)
    ↓
Store in localStorage:
- token: "eyJhbGciOiJIUzI1NiIs..."
- refreshToken: "eyJhbGciOiJIUzI1NiIs..."
- expiresAt: "2025-10-19T15:30:00Z"
    ↓
Frontend: Check expiry every 5 minutes
    ↓
If expires in < 15 minutes:
  - Call POST /api/auth/refresh
  - Update token in localStorage
    ↓
If token invalid:
  - Clear localStorage
  - Redirect to login
```

### Token Refresh Strategy

**Background Refresh:**

- Check token expiry every 5 minutes (setInterval)
- Refresh if expires in < 15 minutes
- Silent (no UI disruption)

**On-Demand Refresh:**

- Intercept 401 responses from API calls
- Attempt refresh once
- Retry original request with new token
- If refresh fails, redirect to login

**Implementation Example:**

```javascript
// public/js/auth.js
setInterval(
  async () => {
    const token = localStorage.getItem('token');
    const expiresAt = new Date(localStorage.getItem('expiresAt'));
    const now = new Date();
    const minutesUntilExpiry = (expiresAt - now) / 1000 / 60;

    if (minutesUntilExpiry < 15) {
      await refreshToken();
    }
  },
  5 * 60 * 1000
); // Every 5 minutes
```

---

## Multi-Tenant Isolation

### Row Level Security (RLS)

All queries automatically filtered by organization membership:

```javascript
// User can only see their own data
const { data: comments } = await supabase
  .from('comments')
  .select('*')
  .eq('organization_id', userOrganizationId);
// RLS ensures user is member of organization
```

### Organization Context

**Stored in JWT:**

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "organization_id": "org-uuid",
    "role": "owner"
  },
  "exp": 1729347000
}
```

**Frontend Usage:**

```javascript
const token = parseJWT(localStorage.getItem('token'));
const currentOrgId = token.app_metadata.organization_id;
```

---

## Error Handling

### Invalid Credentials (Login)

**Error Response:**

```json
{
  "success": false,
  "error": "Invalid email or password",
  "code": "E_INVALID_CREDENTIALS"
}
```

**Frontend Handling:**

- Show error message: "Invalid email or password"
- Clear password field
- Focus email field
- No retry limit (no account lockout on free tier)

---

### Expired Token (Session)

**Error Response:**

```json
{
  "success": false,
  "error": "Token expired",
  "code": "E_TOKEN_EXPIRED"
}
```

**Frontend Handling:**

1. Attempt refresh (POST /api/auth/refresh)
2. If refresh succeeds:
   - Update token in localStorage
   - Retry original request
3. If refresh fails:
   - Clear localStorage
   - Redirect to login with return URL

---

### Network Error

**Frontend Handling:**

- Show toast: "Connection error. Retrying..."
- Retry with exponential backoff (3 attempts)
- If all fail: Show offline UI

---

## Loading States

### Registration

**States:**

1. `idle` - Form ready
2. `validating` - Checking email format, password strength
3. `registering` - Sending request to API
4. `success` - Registration complete, redirecting
5. `error` - Show error message

**Visual Indicators:**

- Button disabled during `validating` + `registering`
- Spinner on button during `registering`
- Success checkmark on `success`
- Red error message on `error`

---

### Login

**States:**

1. `idle` - Form ready
2. `logging_in` - Sending credentials
3. `success` - Login complete, redirecting
4. `error` - Invalid credentials

**Visual Indicators:**

- Button shows "Logging in..." during `logging_in`
- Spinner on button
- Redirect with fade-out on `success`

---

### Session Verification (Page Load)

**States:**

1. `verifying` - Checking token validity
2. `authenticated` - Token valid, show dashboard
3. `unauthenticated` - Token invalid, redirect to login

**Visual Indicators:**

- Show loading spinner during `verifying` (max 2 seconds)
- If > 2 seconds, show "Verifying session..."
- Fade in dashboard on `authenticated`

---

## Security Best Practices

### Password Requirements

- **Minimum length:** 8 characters
- **Complexity:** Must contain uppercase, lowercase, number
- **No common passwords:** Check against list of 10,000 most common passwords

### Token Security

- **HTTPS only:** Tokens only transmitted over HTTPS in production
- **HttpOnly cookies (alternative):** Consider using httpOnly cookies for refresh token
- **Token rotation:** New refresh token issued on each refresh
- **Short-lived access tokens:** JWT expires in 1 hour

### Rate Limiting

- **Login:** 5 attempts per 15 minutes per IP
- **Registration:** 3 attempts per hour per IP
- **Token refresh:** 10 attempts per hour per user

---

## Testing

### Unit Tests

```javascript
// tests/unit/auth/registration.test.js
describe('Registration', () => {
  test('creates user with valid credentials', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('test@example.com');
    expect(response.body.data.token).toBeDefined();
  });

  test('rejects weak password', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'weak',
      name: 'Test User'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/password/i);
  });
});
```

### Integration Tests

```javascript
// tests/integration/auth-flow.test.js
describe('Auth Flow', () => {
  test('complete registration → login → session validation flow', async () => {
    // 1. Register
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'flow@example.com',
      password: 'SecurePass123!',
      name: 'Flow Test'
    });

    expect(registerRes.status).toBe(200);
    const { token, user } = registerRes.body.data;

    // 2. Validate session
    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token}`);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.user.id).toBe(user.id);

    // 3. Logout (client-side: clear localStorage)

    // 4. Login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'flow@example.com',
      password: 'SecurePass123!'
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.email).toBe('flow@example.com');
  });
});
```

### E2E Tests (Playwright)

```javascript
// tests/e2e/auth/login-registration.spec.js
test('registration flow', async ({ page }) => {
  await page.goto('/register');

  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'SecurePass123!');
  await page.fill('input[name="name"]', 'E2E Test');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');

  // Verify user name displayed
  await expect(page.locator('.user-name')).toHaveText('E2E Test');
});

test('session persistence after page reload', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[name="email"]', 'existing@example.com');
  await page.fill('input[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  // Reload page
  await page.reload();

  // Should still be logged in (no redirect to login)
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('.user-name')).toBeVisible();
});
```

---

## Email Notifications (Issue #593)

### Welcome Email

Sent automatically upon successful registration using SendGrid.

**Template:** `src/templates/emails/welcome.hbs`

**Variables:**

- `userName` - User's display name
- `dashboardUrl` - Link to dashboard (APP_URL from env)
- `supportEmail` - Support contact email
- `language` - User's preferred language (default: 'es')

**Example:**

```javascript
await emailService.sendWelcomeEmail('user@example.com', {
  userName: 'John Doe',
  language: 'es'
});
```

### Password Reset Email

Sent when user requests password reset via "Forgot Password" link.

**Template:** `src/templates/emails/password_reset.hbs`

**Variables:**

- `userName` - User's display name
- `resetLink` - One-time password reset link (expires in 24h)
- `expiryTime` - Time until link expires
- `supportEmail` - Support contact email

**Flow:**

1. User clicks "Forgot Password"
2. Enter email address
3. System sends reset link via SendGrid
4. User clicks link → Redirected to reset password page
5. Enter new password → Password updated

### Email Configuration

**Environment Variables:**

```bash
SENDGRID_API_KEY=<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=noreply@roastr.ai
SENDGRID_FROM_NAME=Roastr.ai Team
SUPPORT_EMAIL=support@roastr.ai
APP_URL=http://localhost:5173  # or production URL
ENABLE_EMAIL_NOTIFICATIONS=true
```

**Service Status:**

```javascript
const status = emailService.getStatus();
// {
//   configured: true,
//   provider: 'SendGrid',
//   templatesLoaded: 9,
//   featureFlag: true
// }
```

---

## Frontend Auto-Refresh Strategy (ROA-335)

**Status:** ✅ Implemented  
**Last Updated:** 2025-12-26

### Overview

The frontend implements automatic token refresh with 401 retry logic to provide seamless user experience without manual re-authentication.

### Interceptor Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant ApiClient
    participant RefreshService
    participant Backend
    participant Queue

    Frontend->>ApiClient: Request (expired token)
    ApiClient->>Backend: GET /api/protected (401)
    Backend-->>ApiClient: 401 TOKEN_EXPIRED
    
    alt Auth Endpoint
        ApiClient-->>Frontend: Error (no retry)
    else Protected Endpoint
        alt Already Refreshing
            ApiClient->>Queue: Queue request (FIFO)
        else Not Refreshing
            ApiClient->>RefreshService: refreshAccessToken()
            RefreshService->>Backend: POST /api/v2/auth/refresh
            Backend-->>RefreshService: { session: { access_token, refresh_token } }
            RefreshService->>RefreshService: Update localStorage
            RefreshService-->>ApiClient: New tokens
            
            ApiClient->>Backend: Retry original request (max 1x)
            Backend-->>ApiClient: 200 Success
            ApiClient->>Queue: Resolve all queued requests (FIFO)
            ApiClient-->>Frontend: Response
        end
    end
```

### Token Storage

**Location:** `frontend/src/lib/auth/tokenStorage.ts`

**Storage Strategy:**
- `access_token`: `localStorage.getItem('auth_token')` (persistent)
- `refresh_token`: `localStorage.getItem('refresh_token')` (persistent)
- **localStorage is single source of truth** (no in-memory storage)
- **No custom persistence** beyond Supabase (localStorage sufficient)

**Token Lifetime Assumptions:**
- Access token TTL: 1 hour (backend validation)
- Refresh token TTL: 7 days (backend validation)
- **No frontend expiration checks** - backend returns 401 if expired

### Retry Logic

**Constraints:**
- **Max 1 retry attempt** per request (hard limit)
- **Block retry if refresh fails** - immediately reject, clear tokens, redirect to login
- **Block retry for auth endpoints** - `/auth/login`, `/auth/signup`, `/auth/refresh`, etc.
- **Concurrent 401s queue behind single refresh** (FIFO order)

**FIFO Queue:**
- All concurrent requests receiving 401 are queued
- Queue processed in First-In-First-Out order after refresh completes
- If refresh fails, all queued requests rejected immediately

### Anonymous Endpoints (No Retry)

These endpoints don't require authentication, so 401 means authentication failed (not expired token):

- `/auth/login` (or `/api/v2/auth/login`)
- `/auth/signup` (or `/api/v2/auth/signup`)
- `/auth/refresh` (or `/api/v2/auth/refresh`)
- `/auth/magic-link` (or `/api/v2/auth/magic-link`)
- `/auth/reset-password` (or `/api/v2/auth/reset-password`)

**Behavior:** On 401 for these endpoints → skip retry, throw error immediately.

### Error Handling

**401 (Session Expired):**
- After refresh failure → clear tokens, redirect to `/login`
- Toast shown only once (prevent spam with `_auth_redirecting` flag)
- Store intended destination in `sessionStorage` for post-login redirect

**403 (Access Denied):**
- Show user-friendly message
- Do NOT redirect (user is authenticated, just lacks permission)

**429 (Rate Limit):**
- Per-action backoff (not global lock)
- Each action has independent backoff timer
- Disable only the specific action/button that triggered 429
- Re-enable after `Retry-After` seconds

### Implementation Files

- **API Client:** `frontend/src/lib/api.ts` (interceptor logic)
- **Refresh Service:** `frontend/src/lib/auth/refreshService.ts`
- **Token Storage:** `frontend/src/lib/auth/tokenStorage.ts`
- **Error Handler:** `frontend/src/lib/auth/errorHandler.ts`
- **Auth Context:** `frontend/src/lib/auth-context.tsx` (uses tokenStorage)

---

## Current Gaps

### To Be Implemented

1. **Token Rotation** - Refresh token should rotate on each refresh (security best practice)
2. **Account Lockout** - No account lockout after failed login attempts (rate limiting only)
3. **Email Verification** - Users can access dashboard without verifying email (optional)
4. **2FA Support** - No two-factor authentication option (future enhancement)

### Needs Documentation

1. **OAuth Providers** - Support for Google, GitHub, etc. (Supabase Auth supports this)
2. **Session Revocation** - Admin ability to revoke user sessions
3. **Device Management** - List active sessions per device

---

## Next Steps

1. **Implement Email Verification** (Optional - Issue to be created)
2. **Document OAuth Integration** (Google, GitHub, etc.)
3. **Implement Token Rotation** (Security enhancement)
4. **Add 2FA Support** (Future enhancement)

---

**Last Updated:** 2025-10-19 (Issue #593)
**Maintained By:** Backend Developer, Documentation Agent
**Related Issues:** #593 (Completed)
**Related PRs:** PR #<to-be-created>
