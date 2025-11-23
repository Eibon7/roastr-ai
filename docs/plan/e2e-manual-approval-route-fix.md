# Plan: E2E Tests Manual Approval - Route Fix

**Issue**: PR #574 - E2E Tests failing after 14m
**Date**: 2025-10-15
**Priority**: P0 - Blocks merge
**Quality Standard**: Architectural solutions, no patches

---

## Estado Actual

### Job Failing: E2E Tests - Manual Approval UI

**Síntomas**:

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
waiting for locator('[data-testid="generate-variant-btn"]').first()
at line 636, 685, 738
```

**Root Cause Identified**:
✅ Server starts successfully (lazy initialization fix worked)
✅ `/health` endpoint fix worked
✅ Playwright testMatch fix worked (only runs .spec.js)
❌ **NEW PROBLEM**: Tests access `/manual-approval.html` but page not served at that route

**Evidence**:

- Page exists: `/Users/emiliopostigo/roastr-ai/public/manual-approval.html` ✅
- Contains all required data-testids ✅
- Server config: `/public` path serves static files under `/public/*` route
- Tests expect: `/manual-approval.html` (direct route)
- Actual route: `/public/manual-approval.html` (nested under /public)

**Result**: Page never loads → buttons never render → tests timeout

---

## Análisis por Severidad

### Critical (C1): Page Route Missing

- **Type**: Architecture - Missing route configuration
- **File**: `src/index.js`
- **Impact**: All E2E tests fail (15+ test cases, 0% passing)
- **Root Cause**: Static file server mounts `/public` directory at `/public/*` path
- **Legacy Pattern**: `index.html` has direct route (line 532: `/home`)

### Major (M1): Test Assumptions vs Server Reality

- **Type**: Architecture - Tests assume direct route access
- **Files**:
  - `tests/e2e/manual-approval-resilience.spec.js` (all tests)
  - `tests/e2e/validation-ui.spec.js` (likely affected)
- **Impact**: Tests cannot validate UI resilience features from Issue #419
- **Root Cause**: Tests written before server routing finalized

---

## GDD Nodes Affected

**Primary Nodes**:

1. `testing` - E2E test execution failing
2. `ui-components` - Manual Approval UI not accessible
3. `routing` - Missing route configuration

**Dependencies**:

- `observability` → Edge validation required if adding new route
- `spec.md` → NO changes (existing API contracts unchanged)

**Validation Required**:

```bash
node scripts/resolve-graph.js testing ui-components routing
node scripts/validate-gdd-runtime.js --node=testing
```

---

## Estrategia de Implementación

### FASE 1: Add Direct Route for Manual Approval Page

**Approach**: Add explicit route similar to existing `/home` route pattern

**Implementation**:

```javascript
// src/index.js - After line 533
app.get('/manual-approval.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/manual-approval.html'));
});
```

**Rationale**:

- ✅ Maintains test compatibility (no test changes needed)
- ✅ Follows existing pattern (`/home` route for `public/index.html`)
- ✅ Simple, explicit, no side effects
- ✅ Production-ready (proper error handling via sendFile)

**Alternative Rejected**: Changing tests to use `/public/manual-approval.html`

- ❌ Requires updating all test files
- ❌ Exposes implementation detail (/public path)
- ❌ Less user-friendly URL

**Files Modified**:

- `src/index.js` (1 new route, ~5 lines)

**Testing Plan**:

1. Local verification: `curl http://localhost:3000/manual-approval.html`
2. E2E tests: All 15+ test cases should now find page
3. Regression: Verify `/public/*` routes still work

---

### FASE 2: Validate E2E Tests Pass

**Success Criteria**:

- ✅ Server starts (already working)
- ✅ Page loads at `/manual-approval.html`
- ✅ All data-testids found:
  - `[data-testid="generate-variant-btn"]`
  - `[data-testid="approve-btn"]`
  - `[data-testid="reject-btn"]`
  - `[data-testid="retry-btn"]`
- ✅ API mocks work (route handlers already exist)
- ✅ 15+ E2E tests pass within 10-14m timeout

**Monitoring**:

```bash
gh run view --job=<job_id> --log | grep "passing\|failing"
```

---

### FASE 3: Documentation & Evidence

**Files to Update**:

- ✅ GDD nodes: Update `routing` node with new route
- ✅ spec.md: NO changes (internal route, not public API)
- ❌ No architecture changes (follows existing pattern)

**Evidence Collection**:

```bash
mkdir -p docs/test-evidence/pr-574-e2e-fix
# Screenshots from Playwright reports
# Test summary from CI
# Coverage delta
```

---

## Archivos Completos Afectados

### Core Implementation

1. **src/index.js** (L535-540) - Add manual approval route
   - Pattern: Explicit route like existing `/home`
   - Error handling: Built-in via `res.sendFile()`
   - Dependencies: None (uses existing public/manual-approval.html)

### Tests (No Changes Required)

2. **tests/e2e/manual-approval-resilience.spec.js** - Already correct
3. **tests/e2e/validation-ui.spec.js** - Likely uses same pattern
4. **public/manual-approval.html** - Already exists with all data-testids

### Dependencies

5. **src/routes/approval.js** - Already has API endpoints for:
   - `GET /api/approval/pending`
   - `POST /api/approval/:id/approve`
   - `POST /api/approval/:id/reject`
   - `POST /api/approval/:id/regenerate`

---

## Orden de Ejecución

1. ✅ **Add route** (5 min)
   - Simple, low-risk change
   - Single point of modification
   - No breaking changes

2. ✅ **Commit & Push** (2 min)
   - Git commit with detailed explanation
   - Push to trigger CI

3. ⏳ **Monitor CI** (10-15 min)
   - Wait for E2E tests to run
   - Verify page loads
   - Check all tests pass

4. ✅ **Update GDD** (5 min)
   - Update `routing` node
   - Validate edges
   - Run health check

---

## Testing Plan

### Pre-Commit Local Testing

```bash
# Start server
npm start

# Test route exists (new terminal)
curl http://localhost:3000/manual-approval.html
# Expected: HTML content returned

# Test original public route still works
curl http://localhost:3000/public/manual-approval.html
# Expected: HTML content returned (both routes work)
```

### CI Validation

```bash
# After push, monitor E2E tests
gh run view --job=<job_id> --log

# Expected results:
# - Server starts ✅
# - Page loads ✅
# - Buttons found ✅
# - Tests execute ✅
# - 15+ tests passing ✅
```

### Regression Testing

- ✅ `/public/*` routes still work
- ✅ `/home` route still works
- ✅ React app routing unaffected
- ✅ API routes unaffected

---

## Success Criteria

**100% Resolution**:

- ✅ C1: Route added for `/manual-approval.html`
- ✅ All E2E tests passing (15+ test cases)
- ✅ No test file changes required
- ✅ No breaking changes to existing routes

**Quality Gates**:

- ✅ Tests pass: 15+ E2E tests green
- ✅ Coverage: Maintained (no new code, only routing)
- ✅ 0 regressions: All other routes still work
- ✅ GDD health ≥87: Routing node updated

**Performance**:

- ✅ E2E tests complete within 10-14m (not timeout)
- ✅ Page load time <500ms
- ✅ No memory leaks

---

## Risk Assessment

### Low Risk ✅

- **Single line route addition** - Minimal code change
- **Follows existing pattern** - `/home` route precedent
- **No dependencies** - Uses existing HTML file
- **No test changes** - Tests already correct
- **Easily revertible** - Remove 5 lines if issues

### Zero Risk Areas

- ❌ API contracts unchanged
- ❌ Database schema unchanged
- ❌ Authentication unchanged
- ❌ Frontend build unchanged

---

## Rollback Plan

**IF** route causes issues:

1. Revert commit: `git revert <commit_hash>`
2. Alternative: Change tests to use `/public/manual-approval.html`
3. Document why direct route approach failed

**Likelihood**: <1% (follows proven pattern)

---

## Commit Message Template

````
fix(e2e): Add direct route for manual-approval.html to enable E2E tests

## Problem
E2E tests failing with "locator.click: Timeout 10000ms exceeded" because
manual-approval.html not accessible at expected route.

Tests expect: http://localhost:3000/manual-approval.html
Server serves: http://localhost:3000/public/manual-approval.html

## Root Cause
Static file server mounts /public directory at /public/* route:
```javascript
app.use('/public', express.static(path.join(__dirname, '../public')));
````

Tests written for direct route access (no /public prefix).

## Solution

Added explicit route for manual-approval.html following existing /home pattern:

```javascript
app.get('/manual-approval.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/manual-approval.html'));
});
```

## Impact

- ✅ E2E tests can now access page
- ✅ All 15+ test cases should pass
- ✅ No breaking changes to existing routes
- ✅ Follows established pattern (line 532: /home route)

## Files Modified

- src/index.js (1 new route)

## Testing

- E2E tests: All resilience tests now executable
- Regression: /public/\* routes still work
- Manual: curl http://localhost:3000/manual-approval.html ✅

Related: Issue #419, PR #574
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

```

---

## Referencias

- **Quality Standards**: `docs/QUALITY-STANDARDS.md`
- **Issue #419**: Manual Approval UI Resilience
- **PR #574**: E2E Tests Implementation
- **Pattern**: Existing `/home` route (src/index.js:532)

---

## Next Immediate Action

**NOW**: Implement FASE 1 - Add route to src/index.js
**THEN**: Commit, push, monitor CI for E2E test results

**Expected Completion**: <30 minutes total
- Implementation: 5 min
- CI run: 10-15 min
- Validation: 5 min
- GDD update: 5 min
```
