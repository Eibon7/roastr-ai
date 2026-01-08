# ROA-523: Rate Limiting v2 Redis/Upstash Migration & Auth Wiring

## 📋 Summary

Completed migration of rate limiting v2 to Redis/Upstash persistent storage. The system now uses Redis in production with automatic fallback to in-memory storage for development and testing.

**Linear Issue:** https://linear.app/roastrai/issue/ROA-523/rate-limiting-v2-migration-auth-wiring

---

## 🎯 Changes

### Core Implementation

1. **Redis Client** (`apps/backend-v2/src/lib/redisClient.ts`)
   - Shared Redis/Upstash client for backend-v2
   - Automatic fallback to memory if Redis unavailable
   - Structured logging of connection state

2. **Rate Limit Service** (`apps/backend-v2/src/services/rateLimitService.ts`)
   - Async Redis operations with in-memory fallback
   - TTL-based automatic cleanup (no memory leaks)
   - Keys aligned with SSOT: `auth:ratelimit:ip:${authType}:${ip}`
   - Progressive blocking escalation (15min → 1h → 24h → permanent)

3. **Middleware** (`apps/backend-v2/src/middleware/rateLimit.ts`)
   - Updated to async for Redis operations
   - API unchanged (transparent upgrade)

4. **Bootstrap** (`apps/backend-v2/src/index.ts`)
   - Redis initialization on app start
   - Graceful fallback if Redis not available

5. **Dependencies** (`apps/backend-v2/package.json`)
   - Added `@upstash/redis@^1.34.3`

---

## 🔄 SSOT v2 Alignment

**Reference:** SSOT v2 - Section 12.4

| Auth Type | Window | Max Attempts | Block Duration | Status |
|-----------|--------|--------------|----------------|--------|
| login | 15 min | 5 | 15 min | ✅ |
| magic_link | 1 hour | 3 | 1 hour | ✅ |
| oauth | 15 min | 10 | 15 min | ✅ |
| password_reset | 1 hour | 3 | 1 hour | ✅ |
| signup | 1 hour | 5 | 1 hour | ✅ |

**Progressive Blocking:**
- 1st violation → 15 min ✅
- 2nd violation → 1 hour ✅
- 3rd violation → 24 hours ✅
- 4th+ violation → Permanent ✅

---

## 🧪 Tests

**File:** `apps/backend-v2/tests/unit/services/rateLimitService.test.ts`

**Results:** ✅ 13/13 tests passing

**Coverage:**
- Rate limiting per auth type (login, magic_link, oauth, password_reset, signup)
- Temporal and permanent blocking
- Block time calculation
- Manual reset (admin/tests)
- Observability hooks

```bash
cd apps/backend-v2
npm test -- tests/unit/services/rateLimitService.test.ts
```

---

## 🚀 Deployment

### Required Environment Variables

```bash
# Redis/Upstash (production)
UPSTASH_REDIS_REST_URL=https://your-upstash.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional: Redis legacy URL
REDIS_URL=redis://localhost:6379
```

### Automatic Fallback

If Redis is not available:
1. ℹ️  Info log: `rate_limit_backend_selected` (backend: memory)
2. ✅ System continues with in-memory storage
3. ⚠️  Rate limiting does NOT persist across restarts

**⚠️ IMPORTANT:** In production, ensure Redis/Upstash is properly configured.

### Redis (Upstash) Lifecycle

**Development / CI:**
- Fallback to memory is **EXPECTED**
- Upstash may mark DB as inactive without regular traffic
- This is **NOT a bug** - fallback ensures system works

**Staging / Production:**
- Redis validated with real traffic
- Rate limiting persists across restarts
- Multi-instance safe

---

## 📊 Observability

### Structured Logs

**Redis initialized:**
```json
{
  "level": "info",
  "event": "redis_initialized",
  "url": "https://<REDACTED>",
  "provider": "upstash"
}
```

**Fallback to memory:**
```json
{
  "level": "warn",
  "event": "rate_limit_fallback_memory",
  "reason": "Redis not available, using in-memory storage",
  "warning": "Rate limiting will not persist across server restarts"
}
```

**Rate limit exceeded:**
```json
{
  "level": "warn",
  "event": "auth_rate_limit_blocked",
  "ip": "192.168.1.1",
  "auth_type": "login",
  "blocked_until": 1672531200,
  "block_type": "temporary"
}
```

---

## ✅ Validation

All CI checks passing:

```bash
# V2 doc paths
✅ node scripts/validate-v2-doc-paths.js --ci

# SSOT health
✅ node scripts/validate-ssot-health.js --ci
Health Score: 100/100

# System map drift
✅ node scripts/check-system-map-drift.js --ci

# Strong concepts
✅ node scripts/validate-strong-concepts.js --ci

# Tests
✅ npm test -- tests/unit/services/rateLimitService.test.ts
13/13 tests passing
```

---

## 📚 Documentation

- **Implementation:** `docs/implementation/ROA-523-rate-limiting-migration.md`
- **SSOT v2:** `docs/SSOT-V2.md` - Section 12.4
- **Auth Node:** `docs/nodes-v2/auth/rate-limiting.md`

---

## 🔗 Files Changed

- `apps/backend-v2/src/lib/redisClient.ts` (new)
- `apps/backend-v2/src/services/rateLimitService.ts` (updated)
- `apps/backend-v2/src/middleware/rateLimit.ts` (updated)
- `apps/backend-v2/src/index.ts` (updated)
- `apps/backend-v2/package.json` (updated)
- `apps/backend-v2/tests/unit/services/rateLimitService.test.ts` (updated)
- `docs/implementation/ROA-523-rate-limiting-migration.md` (new)

---

## ✅ Checklist

- [x] Redis/Upstash client implemented
- [x] Rate limit service migrated
- [x] Middleware updated (async)
- [x] Bootstrap initialization added
- [x] Tests passing (13/13)
- [x] SSOT v2 alignment verified
- [x] All auth endpoints verified
- [x] Dependency added
- [x] Structured logging implemented
- [x] Automatic fallback working
- [x] Documentation updated
- [x] All validations passing

---

**Ready for Review** ✅

