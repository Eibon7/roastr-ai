# CodeRabbit Lessons Learned

**Purpose:** Document recurring patterns from CodeRabbit reviews to prevent repetition and improve code quality.

**Last Updated:** 2025-10-20

**Usage:** Read this file BEFORE implementing any feature (FASE 0 or FASE 2 of task workflow).

---

## 🚨 Errores Recurrentes

### 1. ESLint & Code Style

**Pattern:** Missing semicolons, inconsistent const/let usage, console.logs in production

**❌ Mistake:**
```javascript
let count = 0  // Missing semicolon
console.log('Debug:', data) // console.log in production
```

**✅ Fix:**
```javascript
const count = 0; // Prefer const, always semicolon
logger.debug('Debug:', data); // Use logger utility
```

**Rules to apply:**
- Always use semicolons (ESLint: `semi: ["error", "always"]`)
- Prefer `const` over `let` (ESLint: `prefer-const: "error"`)
- Use `utils/logger.js` instead of `console.log`
- Remove unused imports (ESLint: `no-unused-vars: "error"`)

---

### 2. Testing Patterns

**Pattern:** Implementing code without tests, tests only cover happy path, mock assertions missing

**❌ Mistake:**
```javascript
// Implement feature first
function processPayment(amount) {
  // implementation
}

// Write tests later (or never)
```

**✅ Fix:**
```javascript
// TDD: Write test FIRST
describe('processPayment', () => {
  it('should process valid payment', async () => {
    const result = await processPayment(100);
    expect(result.status).toBe('success');
  });

  it('should reject negative amounts', async () => {
    await expect(processPayment(-10)).rejects.toThrow('Invalid amount');
  });

  it('should handle API timeout', async () => {
    mockAPI.timeout();
    await expect(processPayment(100)).rejects.toThrow('Timeout');
  });
});

// Then implement
function processPayment(amount) {
  if (amount <= 0) throw new Error('Invalid amount');
  // implementation
}
```

**Rules to apply:**
- Write tests BEFORE implementation (TDD)
- Cover happy path + error cases + edge cases
- Verify mock calls: `expect(mock).toHaveBeenCalledWith(...)`
- Minimum 3 test cases: success, error, edge case

---

### 3. TypeScript / JSDoc

**Pattern:** Missing type definitions, implicit `any`, functions without @param/@returns

**❌ Mistake:**
```javascript
function calculateDiscount(price, percent) {
  return price * (percent / 100);
}
```

**✅ Fix:**
```javascript
/**
 * Calculate discount amount for a given price and percentage
 * @param {number} price - Original price
 * @param {number} percent - Discount percentage (0-100)
 * @returns {number} Discount amount
 */
function calculateDiscount(price, percent) {
  return price * (percent / 100);
}
```

**Rules to apply:**
- Add JSDoc to all exported functions
- Include `@param` for each parameter with type
- Include `@returns` with return type
- Avoid `any` type, define specific types

---

### 4. GDD Documentation

**Pattern:** Forgetting to update coverage, missing "Agentes Relevantes", manual coverage modification

**❌ Mistake:**
```markdown
**Coverage:** 75%  <!-- Manually entered -->
**Coverage Source:** manual

## Agentes Relevantes
- Backend Developer  <!-- Forgot to add Front-end Dev -->
```

**✅ Fix:**
```markdown
**Coverage:** 75%  <!-- Auto-generated from coverage-summary.json -->
**Coverage Source:** auto

## Agentes Relevantes
- Backend Developer
- Front-end Dev  <!-- Added after invoking agent -->
- Test Engineer  <!-- Added after invoking agent -->
```

**Rules to apply:**
- NEVER modify `**Coverage:**` manually
- Always use `**Coverage Source:** auto`
- Update "Agentes Relevantes" when invoking agent
- Run `node scripts/validate-gdd-runtime.js --full` before commit

---

### 5. Error Handling

**Pattern:** Generic error messages, no retry logic, missing error codes

**❌ Mistake:**
```javascript
try {
  const result = await apiCall();
} catch (error) {
  throw new Error('Failed'); // Generic message
}
```

**✅ Fix:**
```javascript
const MAX_RETRIES = 3;

async function apiCallWithRetry(attempt = 1) {
  try {
    return await apiCall();
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`API_TIMEOUT: Failed after ${MAX_RETRIES} attempts`);
    }

    logger.warn(`Retry ${attempt}/${MAX_RETRIES}`, { error: error.message });
    await delay(500 * attempt); // Exponential backoff
    return apiCallWithRetry(attempt + 1);
  }
}
```

**Rules to apply:**
- Use specific error codes (e.g., `E_TIMEOUT`, `E_VALIDATION`)
- Implement retry logic for transient errors
- Log errors with context (attempt number, user ID, etc.)
- Provide actionable error messages for users

---

### 6. Security

**Pattern:** Hardcoded credentials, env vars in docs, sensitive data in logs

**❌ Mistake:**
```javascript
const API_KEY = 'sk-abc123...'; // Hardcoded
logger.info('User data:', { email, password }); // Sensitive data logged
```

**✅ Fix:**
```javascript
const API_KEY = process.env.OPENAI_API_KEY; // From env
if (!API_KEY) throw new Error('OPENAI_API_KEY not configured');

logger.info('User data:', { email, passwordHash }); // Hash only
```

**Rules to apply:**
- NO hardcoded credentials in code
- NO env var examples in public docs (use "🔐 Requires environment variables")
- NO sensitive data (passwords, tokens) in logs
- Validate env vars at startup

---

### 7. PR Merge Policy

**Pattern:** Claude merges PRs without user approval, bypassing final review opportunity

**❌ Mistake:**
```bash
# After resolving conflicts and CI passing
gh pr merge 581 --squash --delete-branch  # ❌ NEVER DO THIS
```

**✅ Fix:**
```bash
# After resolving conflicts and CI passing
echo "✅ PR #581 ready to merge:"
echo "- All CI checks passed"
echo "- Conflicts resolved"
echo "- CodeRabbit: awaiting review"
echo ""
echo "⏸️  Waiting for your approval to merge."
# STOP HERE - User decides when to merge
```

**Why this matters:**
- **CodeRabbit needs time to review** after final changes
- **User is the project owner** - only they decide when to merge
- **Final review opportunity** - user may spot issues Claude missed
- **This is a monetizable product** - quality requires human oversight
- **Unauthorized merges break trust** - Claude is an assistant, not the decision maker

**Rules to apply:**
- NEVER run `gh pr merge` command
- NEVER click merge buttons
- NEVER assume CI passing = ready to merge
- ALWAYS report: "PR is ready, awaiting your approval"
- ALWAYS wait for explicit "merge this" instruction
- IF accidentally merged: revert immediately, apologize, recreate PR

**Exception:** NONE - this rule has zero exceptions

**Lesson learned:** 2025-10-15 (Issue: PR #581 merged without approval, had to revert)

---

### 8. Cherry-Pick Intermediate State Reviews

**Pattern:** CodeRabbit generates reviews on temporary intermediate commit states during multi-step git operations (cherry-picks, rebases, merges) before completion.

**❌ Mistake:**
```bash
# During cherry-pick with conflicts
git cherry-pick abc123
# Conflicts occur, file has markers:
# <<<<<<< HEAD
# Status: Complete
# =======
# Status: Pending
# >>>>>>> abc123

git add .
git commit  # Commit with conflict markers temporarily

# CodeRabbit review generated NOW (intermediate state)

git add resolved-file
git cherry-pick --continue  # Complete resolution

# Review arrives LATER flagging conflicts that no longer exist
```

**✅ Fix:**
```bash
# Verify current state BEFORE applying fixes
grep -rn "<<<<<<< HEAD\|=======\|>>>>>>>" <files-mentioned-in-review>

# If no markers found:
# 1. Document as PRE-RESOLVED in docs/plan/review-{id}.md
# 2. Create verification evidence showing clean state
# 3. Reference the resolving commit in documentation
# 4. Add pattern to coderabbit-lessons.md

# Prevention: Add pre-push hook
cat > .git/hooks/pre-push <<'EOF'
#!/bin/bash
if git grep -q "<<<<<<< HEAD\|=======\|>>>>>>>"; then
  echo "❌ Merge conflict markers detected"
  git grep -n "<<<<<<< HEAD\|=======\|>>>>>>>"
  exit 1
fi
EOF
chmod +x .git/hooks/pre-push
```

**Rules to apply:**
- Always verify current file state before assuming issues exist
- Complete cherry-pick/rebase operations promptly to avoid intermediate states
- Run `git grep "<<<<<<< HEAD"` before pushing to catch stray markers
- Document pre-resolved issues properly (create plan + evidence + reference resolving commit)
- Consider squashing cherry-picked commits to avoid conflict artifacts
- Add pre-push hook to detect conflict markers automatically

**Why this happens:**
- Cherry-picks/rebases can take multiple steps to complete
- CodeRabbit review queue may process intermediate commits before resolution
- Temporary conflict markers trigger reviews even if resolved moments later
- Review arrives after conflicts already cleaned up

**Response Protocol:**
1. Verify current state first (don't assume issues exist)
2. If pre-resolved, document why and when resolution occurred
3. Create evidence showing verification of clean state
4. Reference the resolving commit in documentation
5. No code changes needed if already resolved

**Lesson learned:** 2025-10-16 (Review #3345472977 flagged conflicts already resolved in commit 77aa466f)

---

## 📊 Estadísticas

| Patrón | Ocurrencias | Tasa Reducción | Última Ocurrencia |
|--------|-------------|----------------|-------------------|
| Missing semicolons | 12 | -60% | 2025-10-10 |
| const vs let | 8 | -75% | 2025-10-09 |
| Missing tests | 5 | -40% | 2025-10-12 |
| Console.log usage | 15 | -80% | 2025-10-08 |
| Coverage manual | 4 | -100% | 2025-10-07 |
| Generic errors | 6 | -50% | 2025-10-11 |
| Unauthorized merge | 1 | N/A | 2025-10-15 |
| Cherry-pick reviews | 1 | N/A | 2025-10-16 |
| Jest integration tests | 7 | -100% (fixed) | 2025-10-20 |
| fs-extra deprecated | 4 | -100% (fixed) | 2025-10-20 |
| logger import pattern | 2 | -100% (fixed) | 2025-10-20 |

**Objetivo:** Reducir tasa de repetición <10% en todos los patrones

---

## 🎯 Checklist Pre-Implementación

Antes de escribir código, verificar:

- [ ] Leí `docs/patterns/coderabbit-lessons.md` (este archivo)
- [ ] Tengo tests escritos ANTES de implementar (TDD)
- [ ] Usaré `const` por defecto, `let` solo si mutable
- [ ] Usaré `logger.js` en lugar de `console.log`
- [ ] Añadiré JSDoc a funciones exportadas
- [ ] NO hardcodearé credenciales
- [ ] Implementaré retry logic para llamadas API
- [ ] Actualizaré GDD nodes si toco arquitectura
- [ ] Añadiré agentes a "Agentes Relevantes" si los invoco

---

## 🔄 Proceso de Actualización

**Cuándo actualizar este archivo:**
- Después de recibir review de CodeRabbit con ≥3 comentarios
- Si detectas patrón nuevo que se repite ≥2 veces
- Cuando implementes fix para error recurrente

**Cómo actualizar:**
1. Identificar patrón en review de CodeRabbit
2. Añadir sección con ❌ Mistake / ✅ Fix
3. Actualizar estadísticas (ocurrencias, última fecha)
4. Commit con mensaje: `docs(patterns): Add CodeRabbit lesson - <patrón>`

**Responsable:** Orchestrator Agent

---

### 9. Jest Integration Tests & Module Loading

**Pattern:** Tests failing with "is not a function" errors, duplicate endpoints intercepting routes, rate limiters breaking tests

**Issue:** Test Fixing Session (2025-10-20) - From 0% to 87.5% passing

**❌ Mistake 1: Router Mounting Order**
```javascript
// Wrong: Generic routes registered before specific ones
app.use('/api', dashboardRoutes);       // Has /roast/preview
app.use('/api/roast', roastRoutes);     // Has /preview (intercepted!)
```

**✅ Fix:**
```javascript
// Correct: Most specific routes first, or remove duplicates
// Option 1: Remove duplicate from dashboard
// Option 2: Register specific routes first
app.use('/api/roast', roastRoutes);     // Register first
app.use('/api', dashboardRoutes);       // Generic last
```

**❌ Mistake 2: Module-level calls without defensive checks**
```javascript
// src/routes/roast.js
const { flags } = require('../config/flags');

// Called at module load time - breaks in Jest
if (flags.isEnabled('ENABLE_REAL_OPENAI')) {
    roastGenerator = new RoastGeneratorEnhanced();
}
```

**✅ Fix:**
```javascript
// Add defensive helper function
const isFlagEnabled = (flagName) => {
    try {
        return flags && typeof flags.isEnabled === 'function' && flags.isEnabled(flagName);
    } catch (error) {
        logger.warn(`⚠️ Error checking flag ${flagName}:`, error.message);
        return false;
    }
};

if (isFlagEnabled('ENABLE_REAL_OPENAI')) {
    roastGenerator = new RoastGeneratorEnhanced();
}
```

**❌ Mistake 3: Rate limiters in test environment**
```javascript
// express-rate-limit throws errors with trust proxy in Jest
const roastRateLimit = createRoastRateLimiter();
router.post('/preview', roastRateLimit, handler);
// Error: ERR_ERL_PERMISSIVE_TRUST_PROXY
```

**✅ Fix:**
```javascript
function createRoastRateLimiter(options = {}) {
    // Issue #618: Disable rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
        return (req, res, next) => next();
    }

    // Normal rate limiter setup for production
    return (req, res, next) => { /* ... */ };
}
```

**❌ Mistake 4: Global mocks interfering with integration tests**
```javascript
// tests/setupEnvOnly.js
jest.mock('../src/config/flags', () => ({
    flags: { isEnabled: jest.fn() }
}));
// This breaks ALL tests, including integration tests that need real behavior
```

**✅ Fix:**
```javascript
// Remove global mocks from setupEnvOnly.js
// Let each unit test define its own mocks:
// tests/unit/service.test.js
jest.mock('../../src/config/flags', () => ({
    flags: { isEnabled: jest.fn() }
}));
```

**❌ Mistake 5: External dependencies not available in test**
```javascript
// src/services/perspectiveService.js
this.client = google.commentanalyzer({  // Breaks in Jest
    version: 'v1alpha1',
    auth: this.apiKey
});
```

**✅ Fix:**
```javascript
try {
    // Check if available before using
    if (!google || typeof google.commentanalyzer !== 'function') {
        logger.warn('Google Perspective API client not available (likely test environment)');
        this.enabled = false;
        return;
    }

    this.client = google.commentanalyzer({
        version: 'v1alpha1',
        auth: this.apiKey
    });
} catch (error) {
    logger.warn('⚠️ Failed to initialize Perspective API:', error.message);
    this.enabled = false;
}
```

**Impact:**
- **Before:** 0/24 tests passing (100% failure)
- **After:** 21/24 tests passing (87.5% success)
- **Discovered:** Critical production bug (duplicate endpoint serving wrong responses)

**Files affected:**
- src/routes/dashboard.js (duplicate endpoint removed)
- src/routes/roast.js (defensive flag checks)
- src/services/perspectiveService.js (defensive initialization)
- src/middleware/roastRateLimiter.js (test environment no-op)
- tests/setupEnvOnly.js (global mock removed)
- tests/integration/roast.test.js (rewritten for production quality)

**Prevention checklist:**
- [ ] Check router mounting order (specific before generic)
- [ ] Add defensive checks for module-level calls
- [ ] Disable rate limiters in test environment
- [ ] Avoid global mocks in setup files
- [ ] Check external dependencies availability before use
- [ ] Test integration tests actually test production code paths
- [ ] Verify no duplicate endpoints across route files

**Occurrences:**
- Router order: 1 (dashboard intercepting roast)
- Module loading: 3 (flags, perspectiveService, roastEngine)
- Rate limiter: Multiple (all routes with rate limiting)
- Global mocks: 1 (flags mock in setupEnvOnly)

**Last occurrence:** 2025-10-20 (Issue #618)

**Related patterns:**
- Testing Patterns (#2) - Write production-quality tests
- Integration Workflow - Check for duplicates before adding endpoints

---

### 10. fs-extra Deprecated Methods & Logger Import Patterns

**Pattern:** Tests failing with "fs.remove is not a function" and "logger.info is not a function" due to incorrect library usage and import patterns.

**Issue:** Test Fixing Session #2 (2025-10-20) - Fixed 6 more errors after roast.test.js success

**❌ Mistake 1: Using deprecated fs-extra methods**
```javascript
// Wrong: fs.remove() deprecated/unavailable in fs-extra 11.x
const fs = require('fs-extra');

afterAll(async () => {
  await fs.remove(tempLogDir); // Error: fs.remove is not a function
});
```

**✅ Fix:**
```javascript
// Correct: Use Node's built-in fs/promises.rm()
const fs = require('fs-extra');
const { rm } = require('fs/promises'); // Node built-in (Issue #618)

afterAll(async () => {
  await rm(tempLogDir, { recursive: true, force: true });
});
```

**❌ Mistake 2: Logger import not matching Jest mock structure**
```javascript
// Wrong: Import entire module when tests export { logger: {...} }
const logger = require('../utils/logger');

constructor() {
  logger.info('Initializing...'); // Error: logger.info is not a function
}
```

**✅ Fix:**
```javascript
// Correct: Destructure logger to match Jest mock structure
const { logger } = require('../utils/logger'); // Issue #618 - destructure

constructor() {
  logger.info('Initializing...'); // ✅ Works!
}
```

**Impact:**
- **Before:** 6 errors blocking multiple test suites
- **After:** fs.remove errors resolved (4), logger.info errors resolved (2)
- **Tests unblocked:** logCommands.test.js, autoApprovalSecurityV2.test.js

**Files affected:**
- tests/integration/cli/logCommands.test.js (fs.remove → rm)
- src/services/PersonaService.js (logger import destructured)

**Prevention checklist:**
- [ ] Check library version supports the method you're using
- [ ] Prefer Node built-ins over library methods when available
- [ ] Ensure imports match Jest mock structure (destructure if mock exports object)
- [ ] Test import pattern: `const { export } = require(...)` vs `const export = require(...)`
- [ ] Check if method exists in library changelog/docs before using
- [ ] When errors say "is not a function", verify import/export pattern match

**Occurrences:**
- fs.remove: 4 (all in logCommands.test.js)
- logger incorrect import: 2 (PersonaService.js affected multiple tests)

**Last occurrence:** 2025-10-20 (Issue #618, commit 9d4cede1)

**Related patterns:**
- Jest Integration Tests (#9) - Module-level calls need defensive checks
- Testing Patterns (#2) - Use production code paths in tests

---

### 11. Supabase Mock Pattern (HIGH PRIORITY)

**Pattern:** Tests attempt to reassign mock properties in `beforeEach()` after module resolution, causing "supabaseServiceClient.from is not a function" errors.

**Error signature:**
```
TypeError: supabaseServiceClient.from is not a function
```

**Root Cause:** Jest mocks are frozen at module resolution time. When tests do:

```javascript
jest.mock('../../src/config/supabase');  // Creates empty mock {}

beforeEach(() => {
  supabaseServiceClient.from = jest.fn().mockReturnValue({...});
  // ← This reassignment fails silently - import reference already frozen
});
```

**❌ BROKEN Pattern:**
```javascript
// tests/unit/workers/ShieldActionWorker.test.js (BEFORE FIX)

// Step 1: Create empty mock shell
jest.mock('../../../src/config/database');

// Step 2: Try to configure in beforeEach (TOO LATE)
beforeEach(() => {
  supabaseServiceClient.from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  });
});
```

**✅ CORRECT Pattern:**
```javascript
// Create mock BEFORE jest.mock() call
const mockSupabase = {
  from: jest.fn((tableName) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { id: '123', plan: 'pro' },
          error: null
        }))
      }))
    })),
    insert: jest.fn(() => ({...})),
    update: jest.fn(() => ({...}))
  })),
  rpc: jest.fn((functionName) => {
    if (functionName === 'get_subscription_tier') {
      return Promise.resolve({ data: 'PRO', error: null });
    }
    return Promise.resolve({ data: null, error: null });
  })
};

// Reference pre-created mock in jest.mock()
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
```

**Even Better: Use Factory Helper:**
```javascript
const { createSupabaseMock } = require('../helpers/supabaseMockFactory');

// Step 1: Create mock with defaults
const mockSupabase = createSupabaseMock({
  user_subscriptions: { plan: 'pro', status: 'active' },
  roast_usage: { count: 15 }
}, {
  get_subscription_tier: { data: 'PRO', error: null }
});

// Step 2: Reference in jest.mock()
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Step 3: Customize per-test in beforeEach (safe, uses helper methods)
beforeEach(() => {
  mockSupabase._reset();
  mockSupabase._setTableData('user_subscriptions', {
    plan: 'creator',
    status: 'active'
  });
});
```

**Rules to apply:**
- **ALWAYS** create mocks BEFORE `jest.mock()` calls
- **NEVER** reassign mock properties in `beforeEach()` - reference is frozen
- **USE** `tests/helpers/supabaseMockFactory.js` for consistent mocking
- **COPY** template from `tests/templates/service.test.template.js`
- Mock logger to prevent winston issues: `jest.mock('../../src/utils/logger', () => ({...}))`
- Verify mock calls in assertions: `expect(mockSupabase.from).toHaveBeenCalledWith('table_name')`

**Affected Files (8 files, 75 errors):**
- `tests/unit/workers/ShieldActionWorker.test.js` (19 errors)
- `tests/unit/workers/FetchCommentsWorker.test.js` (15 errors)
- `tests/unit/workers/AnalyzeToxicityWorker.test.js` (6 errors)
- `tests/unit/services/referralService.test.js` (13 errors)
- `tests/unit/services/usageService.test.js` (10 errors)
- `tests/unit/services/shieldService.test.js` (8 errors)
- `tests/unit/services/commentService.test.js` (2 errors)
- `tests/unit/services/tokenRefreshService.test.js` (2 errors)

**Reference Implementation:**
- Working example: `tests/integration/roast.test.js` (lines 59-108)
- Factory helper: `tests/helpers/supabaseMockFactory.js`
- Test template: `tests/templates/service.test.template.js`

**Related patterns:**
- Jest Integration Tests (#9) - Module-level mock timing
- Testing Patterns (#2) - Comprehensive test coverage + mock verification

**Impact:** Fixing this pattern resolves 8 test suites with -8 failing suites improvement.

**Related:** Issue #480 Week 3 Day 2 - Supabase Mock Pattern Investigation

---

## 📚 Related Documentation

- [Quality Standards](../QUALITY-STANDARDS.md) - Non-negotiable requirements for merge
- [Testing Guide](../TESTING-GUIDE.md) - Complete testing workflow
- [Integration Workflow](../../CLAUDE.md#integration-workflow--error-prevention) - Platform integration checklist
- [GDD Activation Guide](../GDD-ACTIVATION-GUIDE.md) - GDD validation and health scoring

---

**Maintained by:** Orchestrator
**Review Frequency:** Weekly or after significant reviews
**Last Reviewed:** 2025-11-02
**Version:** 1.5.0 (Added pattern #11: Supabase Mock Pattern - HIGH PRIORITY)
