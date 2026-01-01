# Implementation Plan: ROA-410 - Auth Observability Base v2

**Issue:** [ROA-410](https://linear.app/roastrai/issue/ROA-410)  
**PR:** [#1232](https://github.com/Eibon7/roastr-ai/pull/1232)  
**Status:** ✅ Completed  
**Created:** 2026-01-01

---

## Acceptance Criteria

### ✅ AC1: Structured JSON Logs
- [x] Implement structured logging with timestamp, level, service, event fields
- [x] Use consistent JSON format across all auth events
- [x] Include request_id in every log entry

### ✅ AC2: request_id & correlation_id Propagation
- [x] Propagate request_id through all auth flows
- [x] Support optional correlation_id for distributed tracing
- [x] Include IDs in logs, events, and metrics

### ✅ AC3: PII Sanitization
- [x] Implement `truncateEmailForLog()` (first 3 chars + `***@domain`)
- [x] Implement `sanitizeIpForLog()` (IPv4: first 3 octets, IPv6: first 4 groups)
- [x] Automatic sanitization in context before logging
- [x] Never log passwords, tokens, or secrets

### ✅ AC4: Spec-Compliant Event Names
- [x] `auth_flow_started` - Flow iniciado
- [x] `auth_flow_completed` - Flow completado exitosamente
- [x] `auth_flow_failed` - Flow falló (validación, credenciales)
- [x] `auth_flow_blocked` - Flow bloqueado (rate limit, feature flag)

### ✅ AC5: ENABLE_ANALYTICS Flag
- [x] Gate analytics events with `process.env.ENABLE_ANALYTICS`
- [x] Graceful degradation when flag is false/undefined
- [x] Logging and metrics independent of flag
- [x] Try/catch to prevent analytics failures from crashing auth

### ✅ AC6: Metric Counters with Dimensions
- [x] `auth_requests_total` (labels: flow, auth_type)
- [x] `auth_success_total` (labels: flow, auth_type)
- [x] `auth_failures_total` (labels: flow, auth_type, reason)
- [x] `auth_blocks_total` (labels: flow, reason)

### ✅ AC7: Documentation
- [x] Create `docs/observability/auth-v2.md`
- [x] Document architecture, event taxonomy, metrics, PII policies
- [x] Integration examples and best practices
- [x] Add CHANGELOG entry

### ✅ AC8: Minimal Tests
- [x] 37 test cases (490 lines)
- [x] Test structured logging, PII sanitization, flag gating
- [x] Test metric counters and event emission
- [x] Test error handling and graceful degradation

---

## Implementation Approach

### Phase 1: Core Service

**File:** `apps/backend-v2/src/services/authObservabilityService.ts`

**Functions:**
- `logAuthEvent()` - Structured JSON logging
- `trackAuthEvent()` - Analytics event tracking (gated by ENABLE_ANALYTICS)
- `trackMetricCounter()` - Metric counter increments with labels
- `logAuthError()` - Error logging with sanitized context
- `sanitizeContext()` - PII sanitization (emails, IPs)

**Key Features:**
- Automatic context sanitization
- Graceful degradation (try/catch on analytics)
- request_id/correlation_id propagation
- Timestamp, level, service, event structure

### Phase 2: Public Helpers

**File:** `apps/backend-v2/src/utils/authObservability.ts`

**Helpers:**
- `logAuthFlowStarted()` - Flow iniciado
- `logLoginAttempt()` - Login attempt (success/failure)
- `logRegisterAttempt()` - Register attempt (success/failure)
- `logMagicLinkRequest()` - Magic link request
- `logPasswordRecoveryRequest()` - Password recovery request
- `logRateLimit()` - Rate limit block
- `logFeatureDisabled()` - Feature flag disabled
- `logLogout()` - User logout
- `logSessionRefresh()` - Session refresh
- `logAuthError()` - Generic auth error
- `trackAuthDuration()` - Duration tracking
- `createAuthContext()` - Context creation from Request

**Each helper:**
- Calls `logAuthEvent()` with appropriate level/event
- Calls `trackAuthEvent()` with spec-compliant event name
- Updates relevant metric counters with labels

### Phase 3: Service Integration

**File:** `apps/backend-v2/src/services/authService.ts`

**Integration Points:**
- `register()` - logAuthFlowStarted, logRegisterAttempt
- `login()` - logAuthFlowStarted, logLoginAttempt
- `requestMagicLink()` - logAuthFlowStarted, logMagicLinkRequest
- `requestPasswordRecovery()` - logAuthFlowStarted, logPasswordRecoveryRequest

**Pattern:**
```typescript
const context = createAuthContext(req, 'login', email);
const startTime = Date.now();
logAuthFlowStarted(context);

try {
  // ... auth logic ...
  const duration = Date.now() - startTime;
  logLoginAttempt({ ...context, duration_ms: duration }, true);
} catch (error) {
  const duration = Date.now() - startTime;
  logLoginAttempt({ ...context, duration_ms: duration, error }, false, error);
  throw error;
}
```

### Phase 4: Route-Level Observability

**File:** `apps/backend-v2/src/routes/auth.ts`

**Gates Instrumented:**
- `/register` - feature flag check with logFeatureDisabled
- `/login` - feature flag check with logFeatureDisabled
- `/magic-link` - feature flag check with logFeatureDisabled
- `/password-recovery` - feature flag check with logFeatureDisabled

**Pattern:**
```typescript
try {
  await isAuthEndpointEnabled('register');
} catch (error) {
  const context = createAuthContext(req, 'register');
  logFeatureDisabled(context, 'register', error);
  throw error;
}
```

### Phase 5: Rate Limit Hooks

**File:** `apps/backend-v2/src/services/rateLimitService.ts`

**Changes:**
- Add `setObservability()` method to accept hooks
- Call `logRateLimit()` when rate limit blocked/exceeded

**File:** `apps/backend-v2/src/index.ts`

**Wiring:**
```typescript
import { logRateLimit } from './utils/authObservability.js';
rateLimitService.setObservability({ logRateLimit });
```

### Phase 6: Tests

**Files:**
- `tests/unit/services/authObservabilityService.test.ts` (244 lines, 20 test cases)
- `tests/unit/utils/authObservability.test.ts` (246 lines, 17 test cases)

**Coverage:**
- Structured logging validation
- PII sanitization (emails, IPs)
- request_id presence
- ENABLE_ANALYTICS flag gating
- Metric counter tracking
- Event emission
- Error handling (graceful degradation)

### Phase 7: Documentation

**Files:**
- `docs/observability/auth-v2.md` - Full documentation
- `CHANGELOG.md` - Entry for ROA-410
- `docs/plan/issue-ROA-410.md` - This file

---

## Files Modified/Created

### Created
- `apps/backend-v2/src/services/authObservabilityService.ts`
- `apps/backend-v2/src/utils/authObservability.ts`
- `apps/backend-v2/tests/unit/services/authObservabilityService.test.ts`
- `apps/backend-v2/tests/unit/utils/authObservability.test.ts`
- `docs/observability/auth-v2.md`
- `docs/plan/issue-ROA-410.md`

### Modified
- `apps/backend-v2/src/services/authService.ts` - Added observability calls
- `apps/backend-v2/src/routes/auth.ts` - Added feature-flag observability
- `apps/backend-v2/src/services/rateLimitService.ts` - Added setObservability()
- `apps/backend-v2/src/index.ts` - Wired observability hooks
- `CHANGELOG.md` - Added ROA-410 entry

---

## Test Strategy

### Unit Tests

**authObservabilityService.test.ts:**
- ✅ logAuthEvent() structure (timestamp, level, service, event)
- ✅ PII sanitization (emails: `joh***@example.com`, IPs: `192.168.1.xxx`)
- ✅ request_id presence in all logs
- ✅ ENABLE_ANALYTICS=true → analytics events emitted
- ✅ ENABLE_ANALYTICS=false → analytics events skipped
- ✅ trackMetricCounter() increments with labels
- ✅ Graceful degradation on analytics errors

**authObservability.test.ts:**
- ✅ logAuthFlowStarted() emits auth_flow_started
- ✅ logLoginAttempt() success → auth_flow_completed + auth_success_total
- ✅ logLoginAttempt() failure → auth_flow_failed + auth_failures_total
- ✅ logRegisterAttempt() events and metrics
- ✅ logRateLimit() → auth_flow_blocked + auth_blocks_total
- ✅ logFeatureDisabled() → auth_flow_blocked + auth_blocks_total
- ✅ createAuthContext() extracts request_id, email, ip from Request

### Integration Tests

**Not in scope for ROA-410** (manual verification):
- authService flows end-to-end
- Route-level feature flag gates
- rateLimitService hooks

---

## Validation Checklist

- [x] All 8 acceptance criteria met
- [x] Structured JSON logs with timestamp, level, service, event
- [x] request_id & correlation_id propagation
- [x] PII sanitization (emails, IPs)
- [x] Spec-compliant event names (auth_flow_*)
- [x] ENABLE_ANALYTICS flag with graceful degradation
- [x] Metric counters with dimensions (auth_*_total)
- [x] Documentation (`docs/observability/auth-v2.md`)
- [x] 37 test cases (490 lines)
- [x] All tests passing
- [x] No console.logs or hardcoded values
- [x] Linter passing
- [x] Build passing
- [x] Security audit passing
- [x] CodeRabbit review addressed
- [x] CHANGELOG entry added

---

## Risks and Mitigations

### Risk 1: Analytics Failures Crashing Auth Flows

**Mitigation:** Wrap all `trackAuthEvent()` calls in try/catch with graceful degradation.

**Code:**
```typescript
try {
  if (process.env.ENABLE_ANALYTICS !== 'true') return;
  analytics.trackEvent(eventName, properties);
} catch (error) {
  logger.warn('Analytics event failed', { eventName, error });
  // Don't throw - graceful degradation
}
```

### Risk 2: PII Leakage in Logs

**Mitigation:** Automatic sanitization in `sanitizeContext()` before any logging.

**Sanitized Fields:**
- `email`: `truncateEmailForLog()` → `joh***@example.com`
- `ip`: `sanitizeIpForLog()` → `192.168.1.xxx`
- `user_id`: Prefixed with `user_` if missing

**Never Logged:**
- `password`, `token`, `secret`, `api_key`

### Risk 3: Performance Impact

**Mitigation:**
- Logging is async (non-blocking)
- Metrics are in-memory counters (fast)
- Analytics gated by flag (can disable in prod if needed)
- No network calls in critical path

---

## Dependencies

**Depends On:**
- ROA-408: A4 Auth Rate Limit Infrastructure v2 (for rateLimitService hooks)
- ROA-407: A3 Auth Policy Wiring v2 (for feature flag integration)
- ROA-406: A2 Auth Feature Flags Integration v2 (for isAuthEndpointEnabled)

**Required By:**
- Future: Distributed tracing integration
- Future: Prometheus metrics export
- Future: Alerting rules

---

## Related Issues

- **ROA-408:** A4 Auth Rate Limit Infrastructure v2
- **ROA-407:** A3 Auth Policy Wiring v2
- **ROA-406:** A2 Auth Feature Flags Integration v2
- **ROA-405:** A1 Auth Strategy and Multi-Factor Foundation v2
- **ROA-409:** A5 Auth Email Infrastructure v2

---

## Completion Criteria

✅ **All acceptance criteria met**  
✅ **All tests passing (37/37)**  
✅ **Documentation complete**  
✅ **CodeRabbit review addressed**  
✅ **CI/CD passing**  
✅ **No PII leakage**  
✅ **Graceful degradation verified**

**Status:** ✅ Ready to Merge

