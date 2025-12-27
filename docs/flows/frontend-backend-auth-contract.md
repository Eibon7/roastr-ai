# Frontend-Backend Auth Contract

**Created:** 2025-12-26  
**Issue:** ROA-335  
**Status:** Documentation Only (No Changes)

---

## 📋 Purpose

This document describes the API contract between frontend and backend v2 for authentication flows. It documents current state, expected contracts, and any mismatches found.

---

## 🔍 Current State Audit (FASE 4)

### Frontend Auth API Usage

**File:** `frontend/src/lib/api.ts` (authApi) and `frontend/src/lib/api/auth.js`

**Current Endpoints Used:**
- `POST /auth/login` (via `authApi.login()`)
- `GET /auth/me` (via `authApi.me()`)
- `POST /auth/logout` (via `authApi.logout()`)

**Expected Response Format (Frontend):**
```typescript
// Login response expected by frontend
{
  success: boolean;
  token: string;        // access_token
  user: User;
}

// Current auth-context.tsx handles both formats:
// - Legacy: { success, token, user }
// - v2: { session: { access_token, refresh_token, user }, message }
```

**Refresh Service:**
- **File:** `frontend/src/lib/auth/refreshService.ts`
- **Endpoint:** `POST /api/v2/auth/refresh` ✅ (correct v2 endpoint)
- **Request:** `{ refresh_token }`
- **Expected Response:** `{ session: { access_token, refresh_token, ... }, message }`

---

## 📝 Expected Backend v2 Contracts

### Endpoints

#### POST /api/v2/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (Success):**
```json
{
  "session": {
    "access_token": "jwt-token-here",
    "refresh_token": "refresh-token-here",
    "expires_in": 3600,
    "expires_at": 1703000000,
    "token_type": "bearer",
    "user": {
      "id": "uuid-v4",
      "email": "user@example.com",
      "role": "user",
      "email_verified": true
    }
  },
  "message": "Login successful"
}
```

**Response (Error):**
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### POST /api/v2/auth/refresh

**Request:**
```json
{
  "refresh_token": "refresh-token-here"
}
```

**Response (Success):**
```json
{
  "session": {
    "access_token": "new-jwt-token",
    "refresh_token": "new-refresh-token",
    "expires_in": 3600,
    "expires_at": 1703000000,
    "token_type": "bearer"
  },
  "message": "Token refreshed successfully"
}
```

**Response (Error):**
```json
{
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Invalid or expired refresh token"
  }
}
```

#### POST /api/v2/auth/logout

**Request:**
```
Authorization: Bearer {access_token}
```

**Response (Success):**
```json
{
  "message": "Logged out successfully"
}
```

#### GET /api/v2/auth/me

**Request:**
```
Authorization: Bearer {access_token}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4",
      "email": "user@example.com",
      "name": "John Doe",
      "is_admin": false,
      "plan": "starter"
    }
  }
}
```

---

## ⚠️ Mismatches Found

### 1. Login Endpoint Path Mismatch

**Frontend:** `POST /auth/login`  
**Backend v2:** `POST /api/v2/auth/login`

**Status:** ⚠️ **MISMATCH**

**Impact:** 
- Frontend may be calling legacy endpoint or wrong base URL
- Need to verify actual endpoint being called at runtime

**Action:** Document only (no fix in this phase)

---

### 2. Login Response Format Mismatch

**Frontend Expected:**
```typescript
{ success: boolean; token: string; user: User }
```

**Backend v2 Actual:**
```typescript
{ session: { access_token, refresh_token, user }, message }
```

**Status:** ⚠️ **MISMATCH** (but handled)

**Impact:**
- `auth-context.tsx` already handles both formats (temporary compatibility)
- Frontend can work with v2 format, but expects legacy format

**Action:** Document only (no fix in this phase)

---

### 3. Refresh Endpoint

**Frontend:** `POST /api/v2/auth/refresh` ✅  
**Backend v2:** `POST /api/v2/auth/refresh` ✅

**Status:** ✅ **COMPATIBLE**

**Action:** No changes needed

---

### 4. Logout Endpoint

**Frontend:** `POST /auth/logout`  
**Backend v2:** `POST /api/v2/auth/logout`

**Status:** ⚠️ **MISMATCH**

**Impact:**
- Frontend may be calling legacy endpoint
- Need to verify actual endpoint being called at runtime

**Action:** Document only (no fix in this phase)

---

## 📊 Request Headers

### Protected Endpoints

**Required:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Optional:**
```
X-CSRF-Token: {csrf_token}  // For mutations (POST, PUT, PATCH, DELETE)
```

### Anonymous Endpoints

**Required:**
```
Content-Type: application/json
```

**No Authorization header needed:**
- `/auth/login`
- `/auth/signup`
- `/auth/magic-link`
- `/auth/reset-password`

---

## 📊 Response Headers

### Optional Headers (if backend implements auto-refresh middleware)

```
X-New-Access-Token: {new_access_token}
X-New-Refresh-Token: {new_refresh_token}
X-Token-Refreshed: true
```

**Note:** Frontend refresh service handles refresh explicitly, so these headers are optional.

### Rate Limit Headers

```
Retry-After: 60  // Seconds until retry allowed (for 429 responses)
```

---

## 🔴 Error Format

### Standard Error Response

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "statusCode": 401
  }
}
```

### Error Code Categories

**AUTH_* (401):**
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_EMAIL_NOT_VERIFIED`
- `AUTH_ACCOUNT_LOCKED`
- `AUTH_RATE_LIMIT_EXCEEDED`
- `AUTH_DISABLED`

**AUTHZ_* (403):**
- `AUTHZ_INSUFFICIENT_PERMISSIONS`
- `AUTHZ_ROLE_NOT_ALLOWED`
- `AUTHZ_MAGIC_LINK_NOT_ALLOWED`

**SESSION_* (401):**
- `SESSION_EXPIRED`
- `SESSION_INVALID`
- `SESSION_REVOKED`
- `SESSION_INACTIVITY_TIMEOUT`

**TOKEN_* (401):**
- `TOKEN_EXPIRED`
- `TOKEN_INVALID`
- `TOKEN_MISSING`
- `TOKEN_REVOKED`

**ACCOUNT_* (404/409):**
- `ACCOUNT_NOT_FOUND`
- `ACCOUNT_SUSPENDED`
- `ACCOUNT_DELETED`
- `ACCOUNT_EMAIL_ALREADY_EXISTS`

**Reference:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

---

## ✅ Compatibility Summary

| Endpoint | Frontend | Backend v2 | Status |
|----------|----------|------------|--------|
| Login | `/auth/login` | `/api/v2/auth/login` | ⚠️ Mismatch |
| Refresh | `/api/v2/auth/refresh` | `/api/v2/auth/refresh` | ✅ Compatible |
| Logout | `/auth/logout` | `/api/v2/auth/logout` | ⚠️ Mismatch |
| Me | `/auth/me` | `/api/v2/auth/me` | ⚠️ Mismatch (assumed) |

**Note:** Mismatches may be resolved by base URL configuration (`VITE_API_URL`). Need to verify at runtime.

---

## 📚 References

- **Backend v2 Auth Routes:** `apps/backend-v2/src/routes/auth.ts`
- **Backend v2 Auth Service:** `apps/backend-v2/src/services/authService.ts`
- **Error Taxonomy:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- **Frontend API Client:** `frontend/src/lib/api.ts`
- **Frontend Refresh Service:** `frontend/src/lib/auth/refreshService.ts`
- **Frontend Auth Context:** `frontend/src/lib/auth-context.tsx`

---

**Last Updated:** 2025-12-26  
**Status:** Documentation Complete (No Changes Made)

