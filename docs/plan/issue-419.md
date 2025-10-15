# Implementation Plan: Issue #419 - E2E UI Resilience Tests

**Issue**: #419
**Title**: [E2E] Resiliencia UI – timeouts/errores/"sin más variantes disponibles" (manual)
**Priority**: P1
**Labels**: test:e2e, area:ui
**Assessment**: CREATE (MEDIUM-LARGE scope, 12-16 hours)
**Created**: 2025-10-13
**Status**: In Progress

---

## 1. Estado Actual (basado en Assessment)

### Implementación Existente

**Backend Services:**
- ✅ `src/services/manualApprovalQueue.js` - Core service for managing approval queue (400+ lines)
- ✅ `src/services/roastGeneratorEnhanced.js` - Variant generation logic (500+ lines)
- ✅ `src/routes/manualApprovalRoutes.js` - API endpoints for approval workflow (150 lines)
  - GET `/api/manual-approval/pending` - Fetch pending roasts
  - POST `/api/manual-approval/approve/:id` - Approve roast
  - POST `/api/manual-approval/reject/:id` - Reject roast
  - POST `/api/manual-approval/variants/:id` - Generate new variant

**Frontend UI:**
- ✅ `public/manual-approval.html` - Interactive UI for manual approval (600+ lines)
  - Functions: `loadPendingRoasts()`, `generateVariant()`, `approveRoast()`
  - Error display: Basic `alert()` messages (poor UX)

### What's Missing (CRITICAL GAPS)

1. **No E2E Test Infrastructure**
   - ❌ Playwright not installed or configured
   - ❌ No `tests/e2e/` directory
   - ❌ No test fixtures or helpers
   - ❌ No CI/CD integration for E2E tests

2. **Insufficient Error Handling**
   - ❌ Frontend uses primitive `alert()` for all errors
   - ❌ No timeout configuration on fetch calls (waits indefinitely)
   - ❌ No retry mechanism for recoverable errors
   - ❌ No specific handling for "no more variants" scenario
   - ❌ Generic backend error messages ("Error generating variants")

3. **Test Coverage for Error Scenarios**
   - ❌ No tests for timeout handling
   - ❌ No tests for network errors
   - ❌ No tests for variant exhaustion
   - ❌ No validation of error message clarity

### What Works

- ✅ Basic approval workflow (happy path)
- ✅ Backend services functional
- ✅ API routes return appropriate HTTP status codes
- ✅ Multi-tenant isolation working

### Recomendación del Assessment

**CREATE** - Net-new E2E test implementation with frontend/backend enhancements to make tests passable.

---

## 2. Análisis de la Issue

### Qué se pide exactamente

Verify manual approval UI resilience when handling:
1. Timeouts during variant generation
2. Network errors during approval/publishing
3. "No more variants available" scenario
4. Clear and actionable error messages
5. Retry functionality for recoverable errors

### Scope

- **Testing**: E2E test suite with Playwright (5 test scenarios)
- **Frontend**: Enhance error handling, add retry logic, improve UX
- **Backend**: Better error messages, timeout configuration, variant limits
- **Infrastructure**: Set up Playwright, CI/CD integration

### Criterios de Aceptación (5 items)

1. ✅ **AC #1**: Manejo de timeout de generación con mensaje claro
2. ✅ **AC #2**: Error de red al aprobar/publicar mostrado apropiadamente
3. ✅ **AC #3**: Caso "no hay más variantes" manejado graciosamente
4. ✅ **AC #4**: Mensajes de error claros y accionables
5. ✅ **AC #5**: Reintentos disponibles donde apropiado

---

## 3. Diseño GDD

### Nodos Afectados

**Cargados:**
- `docs/nodes/roast.md` - Roast generation system (variant logic)
- `docs/nodes/queue-system.md` - Queue management (background jobs)

**No existentes pero relevantes:**
- No hay nodo específico de UI (área frontend no tiene nodo dedicado)
- Manual approval es parte del flujo de roast generation

### Validar Edges

**Dependencias:**
- `roast` → `persona`, `tone`, `platform-constraints`, `shield`, `cost-control`
- `queue-system` → `multi-tenant`
- E2E tests validan integración completa (no hay nuevas edges)

### Actualizar Grafo

No se requieren cambios en el grafo GDD. Este es un issue de testing + mejoras de UX sobre funcionalidad existente.

---

## 4. Subagentes Requeridos

### Test Engineer (CRÍTICO)
- **Fase**: Setup E2E infrastructure + Create test suite
- **Tareas**:
  - Install Playwright
  - Create test fixtures and helpers
  - Write 5 E2E test suites (AC #1-5)
  - Generate visual evidence (screenshots on failure)
  - Integrate with CI/CD

### Front-end Dev (ALTO)
- **Fase**: Frontend enhancements
- **Tareas**:
  - Replace `alert()` with proper error UI component
  - Add timeout configuration to fetch calls
  - Implement retry logic
  - Handle "no more variants" scenario
  - Improve loading states

### Back-end Dev (MEDIO)
- **Fase**: Backend improvements
- **Tareas**:
  - Add specific error codes (TIMEOUT, NETWORK_ERROR, VARIANTS_EXHAUSTED)
  - Implement timeout configuration for variant generation
  - Add variant limit logic (MAX_VARIANTS_PER_ROAST = 5)
  - Improve error response format

### Documentation Agent (BAJO)
- **Fase**: Documentation updates
- **Tareas**:
  - Update GDD nodes (roast.md, queue-system.md)
  - Update CLAUDE.md with E2E testing workflow
  - Create E2E testing documentation

---

## 5. Archivos Afectados

### Files to CREATE (9 new files)

**E2E Test Infrastructure:**
1. `/playwright.config.js` - Playwright configuration (~50 lines)
2. `/tests/e2e/manual-approval-resilience.spec.js` - Main test suite (~400 lines)
3. `/tests/e2e/helpers/network-helpers.js` - Network simulation (~100 lines)
4. `/tests/e2e/helpers/timeout-helpers.js` - Timeout simulation (~80 lines)
5. `/tests/e2e/fixtures/mock-server.js` - Mock API server (~200 lines)
6. `/tests/e2e/setup.js` - Test environment setup (~100 lines)
7. `/tests/e2e/README.md` - E2E testing documentation (~150 lines)

**CI/CD:**
8. `/.github/workflows/e2e-tests.yml` - E2E CI workflow (~60 lines)

**Supporting:**
9. `/docs/test-evidence/issue-419/SUMMARY.md` - Evidence summary (post-implementation)

### Files to MODIFY (5 files)

**Frontend:**
1. `/public/manual-approval.html` (~100 lines modified)
   - Lines ~250-280: Add timeout to fetch calls
   - Lines ~300-350: Replace alert() with error UI component
   - Lines ~400-450: Implement retry logic
   - Lines ~500-550: Handle "no more variants" scenario

**Backend:**
2. `/src/routes/manualApprovalRoutes.js` (~20-30 lines modified)
   - Lines ~30-45: Improve error responses with codes
   - Lines ~60-75: Add VARIANTS_EXHAUSTED handling
   - Lines ~90-105: Add timeout error handling

3. `/src/services/roastGeneratorEnhanced.js` (~15-20 lines modified)
   - Lines ~50-70: Add timeout configuration (VARIANT_GENERATION_TIMEOUT = 30000)
   - Lines ~150-170: Add variant limit logic (MAX_VARIANTS_PER_ROAST = 5)

**Configuration:**
4. `/package.json` (~10 lines)
   - Add Playwright dependencies: `@playwright/test`, `playwright`
   - Add test script: `"test:e2e": "playwright test"`

**Documentation:**
5. `/docs/nodes/roast.md` (~20 lines)
   - Update "Testing" section with E2E tests reference
   - Update "Error Handling" section with new error codes
   - Update "Agentes Relevantes" (add Test Engineer)

---

## 6. Estrategia de Implementación

### Fase 1: Setup E2E Infrastructure (2-3 hours)

**Objetivos:**
- Install Playwright and configure
- Create E2E directory structure
- Set up test helpers and fixtures
- Configure test database

**Tasks:**
1. Install Playwright: `npm install --save-dev @playwright/test playwright`
2. Initialize Playwright: `npx playwright install`
3. Create `/playwright.config.js` with:
   - Test timeout: 30s per test
   - Retry: 1 (flaky test resilience)
   - Headless mode for CI
   - Screenshots on failure
   - Base URL: `http://localhost:3000`
4. Create directory structure:
   ```
   tests/e2e/
   ├── manual-approval-resilience.spec.js
   ├── helpers/
   │   ├── network-helpers.js
   │   └── timeout-helpers.js
   ├── fixtures/
   │   └── mock-server.js
   ├── setup.js
   └── README.md
   ```
5. Set up test database seeding (reuse existing test fixtures)
6. Create mock API server for error simulation

**Validation:**
- Run `npx playwright test --list` → shows test files
- Run sample test → passes with mock data

### Fase 2: Create E2E Tests (6-8 hours)

**Objetivos:**
- Write 5 test suites for AC #1-5
- Each suite tests multiple scenarios
- Visual regression with screenshots
- Comprehensive assertions

**Test Structure:**

```javascript
// tests/e2e/manual-approval-resilience.spec.js

describe('Manual Approval UI - Resilience', () => {

  describe('AC #1: Timeout Handling', () => {
    test('shows clear timeout message after 30s', async ({ page }) => {
      // Mock slow variant generation
      await mockServer.setDelay('/api/manual-approval/variants/:id', 31000);

      // Load UI
      await page.goto('/manual-approval.html');

      // Trigger variant generation
      await page.click('[data-testid="generate-variant-btn"]');

      // Wait for timeout
      await page.waitForSelector('.error-message', { timeout: 35000 });

      // Assert clear error message
      const errorText = await page.textContent('.error-message');
      expect(errorText).toContain('La operación tardó demasiado');
      expect(errorText).toContain('intenta de nuevo');

      // Assert retry button visible
      await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();

      // Screenshot for evidence
      await page.screenshot({ path: 'docs/test-evidence/issue-419/timeout-error.png' });
    });

    test('retry works after timeout', async ({ page }) => {
      // Mock timeout then success
      await mockServer.setDelayOnce('/api/manual-approval/variants/:id', 31000);

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');
      await page.waitForSelector('[data-testid="retry-btn"]');

      // Click retry
      await page.click('[data-testid="retry-btn"]');

      // Assert success after retry
      await page.waitForSelector('.variant-text');
      const variant = await page.textContent('.variant-text');
      expect(variant).toBeTruthy();
    });
  });

  describe('AC #2: Network Error Handling', () => {
    test('handles network error during approval', async ({ page }) => {
      // Mock network error
      await mockServer.setNetworkError('/api/manual-approval/approve/:id');

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="approve-btn"]');

      // Assert error message
      const errorText = await page.textContent('.error-message');
      expect(errorText).toContain('Error de red');
      expect(errorText).toContain('Verifica tu conexión');

      // Assert UI state intact
      await expect(page.locator('[data-testid="approve-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="approve-btn"]')).toBeEnabled();

      await page.screenshot({ path: 'docs/test-evidence/issue-419/network-error-approval.png' });
    });

    test('handles network error during variant generation', async ({ page }) => {
      await mockServer.setNetworkError('/api/manual-approval/variants/:id');

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');

      const errorText = await page.textContent('.error-message');
      expect(errorText).toContain('Error de red');

      // Assert retry available
      await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
    });
  });

  describe('AC #3: No More Variants Scenario', () => {
    test('handles variant exhaustion gracefully', async ({ page }) => {
      // Mock variant limit reached
      await mockServer.setResponse('/api/manual-approval/variants/:id', {
        status: 429,
        body: {
          error: 'VARIANTS_EXHAUSTED',
          message: 'No more variants available for this roast',
          code: 'E_VARIANT_LIMIT'
        }
      });

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');

      // Assert specific message
      const errorText = await page.textContent('.error-message');
      expect(errorText).toContain('No hay más variantes disponibles');
      expect(errorText).toContain('puedes aprobar o rechazar');

      // Assert variant button disabled
      await expect(page.locator('[data-testid="generate-variant-btn"]')).toBeDisabled();

      // Assert approve/reject still enabled
      await expect(page.locator('[data-testid="approve-btn"]')).toBeEnabled();
      await expect(page.locator('[data-testid="reject-btn"]')).toBeEnabled();

      await page.screenshot({ path: 'docs/test-evidence/issue-419/variants-exhausted.png' });
    });
  });

  describe('AC #4: Clear Error Messages', () => {
    test('displays actionable error messages', async ({ page }) => {
      const errorScenarios = [
        { endpoint: '/api/manual-approval/variants/:id', expectedText: 'generar variante' },
        { endpoint: '/api/manual-approval/approve/:id', expectedText: 'aprobar' },
        { endpoint: '/api/manual-approval/reject/:id', expectedText: 'rechazar' }
      ];

      for (const scenario of errorScenarios) {
        await mockServer.setNetworkError(scenario.endpoint);
        // ... trigger action and validate error message includes context
      }
    });

    test('error messages do not leak sensitive info', async ({ page }) => {
      await mockServer.setResponse('/api/manual-approval/variants/:id', {
        status: 500,
        body: { error: 'Database connection failed: host=db.internal.com' }
      });

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');

      const errorText = await page.textContent('.error-message');
      expect(errorText).not.toContain('Database');
      expect(errorText).not.toContain('db.internal.com');
      expect(errorText).toContain('Error del servidor'); // Generic message
    });
  });

  describe('AC #5: Retry Functionality', () => {
    test('retry button appears on recoverable errors', async ({ page }) => {
      const recoverableErrors = [
        { type: 'timeout', setup: () => mockServer.setDelay('/api/...', 31000) },
        { type: 'network', setup: () => mockServer.setNetworkError('/api/...') },
        { type: '503', setup: () => mockServer.setResponse('/api/...', { status: 503 }) }
      ];

      for (const error of recoverableErrors) {
        // Test retry button appears for each recoverable error
      }
    });

    test('retry button does NOT appear on non-recoverable errors', async ({ page }) => {
      // Mock variant exhaustion (429)
      await mockServer.setResponse('/api/manual-approval/variants/:id', {
        status: 429,
        body: { error: 'VARIANTS_EXHAUSTED' }
      });

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');

      // Assert no retry button
      await expect(page.locator('[data-testid="retry-btn"]')).not.toBeVisible();
    });

    test('retry successfully re-attempts operation', async ({ page }) => {
      let attemptCount = 0;
      await mockServer.onRequest('/api/manual-approval/variants/:id', () => {
        attemptCount++;
        return attemptCount === 1
          ? { status: 500, body: { error: 'Server error' } }
          : { status: 200, body: { variant: 'New roast variant' } };
      });

      await page.goto('/manual-approval.html');
      await page.click('[data-testid="generate-variant-btn"]');
      await page.click('[data-testid="retry-btn"]');

      // Assert success after retry
      await page.waitForSelector('.variant-text');
      expect(attemptCount).toBe(2);
    });
  });
});
```

**Validation:**
- All 15+ tests passing
- Screenshots generated for error scenarios
- Test execution time < 5 minutes

### Fase 3: Frontend Enhancements (3-4 hours)

**Objetivos:**
- Replace `alert()` with proper error UI
- Add timeout configuration
- Implement retry logic
- Handle "no more variants" scenario

**Changes to `/public/manual-approval.html`:**

1. **Add Error UI Component** (~line 50):
   ```html
   <div id="error-container" class="error-message hidden">
     <div class="error-icon">⚠️</div>
     <p id="error-text"></p>
     <button id="retry-button" class="btn-retry hidden" data-testid="retry-btn">
       Reintentar
     </button>
     <button id="dismiss-button" class="btn-dismiss">Cerrar</button>
   </div>

   <style>
     .error-message {
       position: fixed;
       top: 20px;
       right: 20px;
       background: #fee;
       border: 2px solid #f44;
       border-radius: 8px;
       padding: 20px;
       max-width: 400px;
       z-index: 1000;
       box-shadow: 0 4px 8px rgba(0,0,0,0.2);
     }
     .error-message.hidden { display: none; }
     .error-icon { font-size: 24px; margin-bottom: 10px; }
     .btn-retry { background: #4CAF50; color: white; }
     .btn-dismiss { background: #999; color: white; }
   </style>
   ```

2. **Add Timeout-Enabled Fetch Helper** (~line 200):
   ```javascript
   async function fetchWithTimeout(url, options = {}, timeout = 30000) {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), timeout);

     try {
       const response = await fetch(url, {
         ...options,
         signal: controller.signal
       });
       clearTimeout(timeoutId);
       return response;
     } catch (error) {
       clearTimeout(timeoutId);
       if (error.name === 'AbortError') {
         throw new Error('TIMEOUT');
       }
       throw error;
     }
   }
   ```

3. **Replace Alert with Error UI** (~line 250):
   ```javascript
   function showError(message, retryCallback = null) {
     const errorContainer = document.getElementById('error-container');
     const errorText = document.getElementById('error-text');
     const retryButton = document.getElementById('retry-button');
     const dismissButton = document.getElementById('dismiss-button');

     errorText.textContent = message;
     errorContainer.classList.remove('hidden');

     if (retryCallback) {
       retryButton.classList.remove('hidden');
       retryButton.onclick = () => {
         hideError();
         retryCallback();
       };
     } else {
       retryButton.classList.add('hidden');
     }

     dismissButton.onclick = () => hideError();
   }

   function hideError() {
     document.getElementById('error-container').classList.add('hidden');
   }
   ```

4. **Update Variant Generation with Timeout** (~line 300):
   ```javascript
   async function generateVariant(roastId) {
     try {
       const response = await fetchWithTimeout(
         `/api/manual-approval/variants/${roastId}`,
         { method: 'POST' },
         30000 // 30s timeout
       );

       if (response.status === 429) {
         const data = await response.json();
         if (data.error === 'VARIANTS_EXHAUSTED') {
           showError('No hay más variantes disponibles. Puedes aprobar o rechazar esta respuesta.');
           document.getElementById('generate-variant-btn').disabled = true;
           return;
         }
       }

       if (!response.ok) {
         throw new Error(`HTTP ${response.status}`);
       }

       const data = await response.json();
       displayVariant(data.variant);

     } catch (error) {
       if (error.message === 'TIMEOUT') {
         showError(
           'La operación tardó demasiado. Por favor, intenta de nuevo.',
           () => generateVariant(roastId) // Retry callback
         );
       } else if (error.message.includes('Failed to fetch')) {
         showError(
           'Error de red. Verifica tu conexión e intenta de nuevo.',
           () => generateVariant(roastId)
         );
       } else {
         showError('Error al generar variante. Por favor, intenta de nuevo.');
       }
     }
   }
   ```

5. **Update Approval with Error Handling** (~line 400):
   ```javascript
   async function approveRoast(roastId) {
     try {
       const response = await fetchWithTimeout(
         `/api/manual-approval/approve/${roastId}`,
         { method: 'POST' },
         30000
       );

       if (!response.ok) {
         throw new Error(`HTTP ${response.status}`);
       }

       // Success
       showSuccessMessage('Roast aprobado y publicado ✓');
       loadPendingRoasts();

     } catch (error) {
       if (error.message === 'TIMEOUT') {
         showError(
           'La aprobación tardó demasiado. Verifica el estado en la lista.',
           () => approveRoast(roastId)
         );
       } else if (error.message.includes('Failed to fetch')) {
         showError(
           'Error de red al aprobar. Intenta de nuevo.',
           () => approveRoast(roastId)
         );
       } else {
         showError('Error al aprobar el roast. Por favor, intenta de nuevo.');
       }
     }
   }
   ```

**Validation:**
- Error UI displays correctly
- Timeout triggers after 30s
- Retry button works
- "No more variants" disables button
- No more `alert()` usage

### Fase 4: Backend Improvements (1-2 hours)

**Objetivos:**
- Add specific error codes
- Implement timeout configuration
- Add variant limit logic
- Improve error response format

**Changes to `/src/routes/manualApprovalRoutes.js`:**

1. **Add Error Codes** (~line 10):
   ```javascript
   const ERROR_CODES = {
     TIMEOUT: 'E_TIMEOUT',
     NETWORK_ERROR: 'E_NETWORK',
     VARIANTS_EXHAUSTED: 'E_VARIANT_LIMIT',
     VALIDATION_ERROR: 'E_VALIDATION',
     SERVER_ERROR: 'E_SERVER'
   };
   ```

2. **Improve Variant Generation Endpoint** (~line 60):
   ```javascript
   router.post('/variants/:id', async (req, res) => {
     try {
       const { id } = req.params;
       const roast = await manualApprovalQueue.getRoast(id);

       if (!roast) {
         return res.status(404).json({
           error: 'NOT_FOUND',
           message: 'Roast not found',
           code: ERROR_CODES.VALIDATION_ERROR
         });
       }

       // Check variant limit
       const variantCount = await manualApprovalQueue.getVariantCount(id);
       if (variantCount >= 5) {
         return res.status(429).json({
           error: 'VARIANTS_EXHAUSTED',
           message: 'No more variants available for this roast',
           code: ERROR_CODES.VARIANTS_EXHAUSTED
         });
       }

       // Generate variant with timeout
       const variant = await roastGenerator.generateVariant(roast.comment);

       res.json({ variant });

     } catch (error) {
       if (error.message === 'TIMEOUT') {
         return res.status(408).json({
           error: 'TIMEOUT',
           message: 'Variant generation timed out',
           code: ERROR_CODES.TIMEOUT
         });
       }

       res.status(500).json({
         error: 'SERVER_ERROR',
         message: 'Error generating variant',
         code: ERROR_CODES.SERVER_ERROR
       });
     }
   });
   ```

**Changes to `/src/services/roastGeneratorEnhanced.js`:**

1. **Add Timeout Configuration** (~line 15):
   ```javascript
   const VARIANT_GENERATION_TIMEOUT = 30000; // 30 seconds
   const MAX_VARIANTS_PER_ROAST = 5;
   ```

2. **Add Timeout to Generation** (~line 150):
   ```javascript
   async generateVariant(comment) {
     return Promise.race([
       this._generateVariantInternal(comment),
       new Promise((_, reject) =>
         setTimeout(() => reject(new Error('TIMEOUT')), VARIANT_GENERATION_TIMEOUT)
       )
     ]);
   }
   ```

**Validation:**
- Error codes returned correctly
- Timeout triggers after 30s
- Variant limit enforced at 5
- Error responses well-formatted

### Fase 5: CI/CD Integration (1 hour)

**Objetivos:**
- Add E2E tests to GitHub Actions
- Run on every PR
- Upload test results on failure

**Create `.github/workflows/e2e-tests.yml`:**

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: roastr_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Setup test database
        run: |
          npm run db:migrate:test
          npm run db:seed:test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/roastr_test

      - name: Start application
        run: |
          npm run start &
          npx wait-on http://localhost:3000 -t 30000
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/roastr_test

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NODE_ENV: test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-screenshots
          path: docs/test-evidence/issue-419/
          retention-days: 7
```

**Validation:**
- Workflow runs on PR
- Tests execute successfully
- Artifacts uploaded on failure

### Fase 6: Documentation (30 minutes)

**Objetivos:**
- Update GDD nodes
- Create E2E testing documentation

**Update `/docs/nodes/roast.md`:**

Add to "Testing" section (~line 520):

```markdown
### E2E Tests

| Test File | Focus | Status |
|-----------|-------|--------|
| `manual-approval-resilience.spec.js` | **Issue #419** - UI resilience (timeouts, network errors, variants exhaustion) | ✅ 15/15 passing |

**Playwright Configuration:**
- Timeout: 30s per test
- Retry: 1 (flaky test resilience)
- Headless mode for CI
- Screenshots on failure
```

Add to "Error Handling" section (~line 560):

```markdown
### Error Codes (Issue #419)

| Code | HTTP Status | Meaning | Recovery |
|------|-------------|---------|----------|
| `E_TIMEOUT` | 408 | Operation timed out | Retry available |
| `E_NETWORK` | 500 | Network error | Retry available |
| `E_VARIANT_LIMIT` | 429 | Max variants reached (5) | No retry, approve/reject instead |
| `E_VALIDATION` | 400 | Invalid input | No retry, fix input |
| `E_SERVER` | 500 | Generic server error | Retry available |
```

Add to "Agentes Relevantes" section (~line 615):

```markdown
- **Test Engineer** (added Issue #419)
```

**Create `/tests/e2e/README.md`:**

```markdown
# E2E Testing with Playwright

## Overview

End-to-end tests for Roastr.ai using Playwright. Tests validate complete user workflows including error handling, resilience, and recovery scenarios.

## Installation

\`\`\`bash
npm install --save-dev @playwright/test playwright
npx playwright install
\`\`\`

## Running Tests

\`\`\`bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test manual-approval-resilience.spec.js

# Run with UI mode (debugging)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed
\`\`\`

## Test Structure

- `/tests/e2e/*.spec.js` - Test suites
- `/tests/e2e/helpers/` - Utility functions
- `/tests/e2e/fixtures/` - Test data and mock servers

## Writing Tests

Example test structure:

\`\`\`javascript
test('should handle error gracefully', async ({ page }) => {
  // 1. Set up mock server
  await mockServer.setNetworkError('/api/endpoint');

  // 2. Navigate and interact
  await page.goto('/manual-approval.html');
  await page.click('[data-testid="action-btn"]');

  // 3. Assert error handling
  const errorText = await page.textContent('.error-message');
  expect(errorText).toContain('expected message');

  // 4. Screenshot for evidence
  await page.screenshot({ path: 'docs/test-evidence/test-name.png' });
});
\`\`\`

## CI/CD Integration

E2E tests run automatically on every PR via GitHub Actions (`.github/workflows/e2e-tests.yml`).

## Test Evidence

Screenshots and reports saved to `/docs/test-evidence/issue-{id}/`.
```

**Validation:**
- Documentation complete
- GDD nodes updated
- README clear and helpful

---

## 7. Criterios de Éxito

### Issue 100% Resuelta

- ✅ **AC #1**: Timeout handling with clear message
- ✅ **AC #2**: Network error handling for approval/publishing
- ✅ **AC #3**: "No more variants" case handled gracefully
- ✅ **AC #4**: Clear and actionable error messages
- ✅ **AC #5**: Retry functionality available

### Tests 100% Passing

- ✅ All 15+ E2E tests passing
- ✅ No flaky tests (all stable)
- ✅ Test execution time < 5 minutes
- ✅ Screenshots generated for error scenarios

### Coverage Mantiene o Sube

- ✅ Coverage auto-updated (Source: auto)
- ✅ New code has tests
- ✅ Overall coverage maintained or improved

### GDD Validado (Health ≥ 95)

- ✅ `node scripts/validate-gdd-runtime.js --full` → 🟢 HEALTHY
- ✅ `node scripts/predict-gdd-drift.js --full` → Drift risk < 60
- ✅ `node scripts/compute-gdd-health.js --threshold=95` → Score ≥ 95

### spec.md Actualizado

- N/A (táctica only, no public contract changes)

### 0 Comentarios de CodeRabbit

- ✅ Self-review completado
- ✅ Code quality verificado
- ✅ Sin console.logs, TODOs, código muerto
- ✅ Sin comentarios pendientes

### CI/CD Passing

- ✅ Linting passing
- ✅ Unit tests passing
- ✅ E2E tests passing
- ✅ Build successful
- ✅ GDD validation passing

---

## 8. Plan de Testing

### Unitarios

**Existing tests to update:**
- `roastGeneratorEnhanced.test.js` - Add tests for timeout logic
- `manualApprovalRoutes.test.js` - Add tests for error codes

**New tests:**
- N/A (E2E tests cover functionality)

### Integración

**Existing tests:**
- `multiTenantWorkflow.test.js` - Should still pass (no breaking changes)

### E2E (NEW)

**Test suites (15+ tests):**
- AC #1: Timeout handling (2 tests)
- AC #2: Network error handling (2 tests)
- AC #3: Variants exhaustion (1 test)
- AC #4: Clear error messages (2 tests)
- AC #5: Retry functionality (3 tests)
- Cross-cutting scenarios (5+ tests)

### Evidencias Necesarias

**Screenshots (Playwright auto-captures):**
- `timeout-error.png` - Timeout error message displayed
- `network-error-approval.png` - Network error during approval
- `variants-exhausted.png` - Variants exhausted message
- `retry-success.png` - Successful retry after error
- `error-ui-component.png` - Error UI component rendering

**Reports:**
- `playwright-report/index.html` - Full test report
- `docs/test-evidence/issue-419/SUMMARY.md` - Executive summary

---

## 9. Riesgos y Mitigaciones

### Riesgo 1: E2E Tests Flaky

**Probabilidad:** Medium
**Impacto:** High (CI failures, developer frustration)

**Mitigación:**
- Use Playwright's built-in retry logic (retry: 1)
- Use explicit waits (`waitForSelector`) instead of arbitrary delays
- Use stable selectors (`data-testid`)
- Mock external dependencies (OpenAI, Perspective API)

### Riesgo 2: Timeout Tests Take Too Long

**Probabilidad:** High
**Impacto:** Medium (slow test execution)

**Mitigación:**
- Mock slow responses, don't actually wait 30s
- Use fake timers where possible
- Configure shorter timeouts for tests (10s mock = 30s real)

### Riesgo 3: Frontend Changes Break Existing Functionality

**Probabilidad:** Medium
**Impacto:** High (production breakage)

**Mitigación:**
- Run full test suite before merging
- Manual smoke testing on staging
- Incremental rollout (feature flag if needed)
- Comprehensive E2E tests cover happy path too

### Riesgo 4: Backend Changes Affect Other Services

**Probabilidad:** Low
**Impacto:** High (cascading failures)

**Mitigación:**
- Unit tests for modified services
- Integration tests for workflows
- Error codes are additive (no breaking changes)
- Timeout is service-specific (doesn't affect others)

---

## 10. Orden de Ejecución

1. **Fase 1: Setup E2E Infrastructure** (2-3 hours)
   - Install Playwright
   - Create directory structure
   - Set up helpers and fixtures

2. **Fase 2: Create E2E Tests** (6-8 hours)
   - Write test suites for AC #1-5
   - Visual regression with screenshots
   - Comprehensive assertions

3. **Fase 3: Frontend Enhancements** (3-4 hours)
   - Replace `alert()` with error UI
   - Add timeout configuration
   - Implement retry logic

4. **Fase 4: Backend Improvements** (1-2 hours)
   - Add error codes
   - Implement timeout
   - Add variant limit

5. **Fase 5: CI/CD Integration** (1 hour)
   - Create GitHub Actions workflow
   - Test CI execution

6. **Fase 6: Documentation** (30 minutes)
   - Update GDD nodes
   - Create E2E README

**Total Estimated Time:** 12-16 hours (matches assessment)

---

## 11. Checklist Pre-Commit

- [ ] All 15+ E2E tests passing locally
- [ ] Unit tests updated and passing
- [ ] No console.logs or debug code
- [ ] Error UI component renders correctly
- [ ] Timeout triggers at 30s
- [ ] Retry functionality works
- [ ] "No more variants" disables button correctly
- [ ] Error messages are user-friendly
- [ ] Screenshots generated for error scenarios
- [ ] GDD validation passing
- [ ] Self-review completed

---

## 12. Checklist Pre-PR

- [ ] All tests passing (unit + E2E)
- [ ] Coverage auto-updated (Source: auto)
- [ ] GDD health ≥ 95
- [ ] Drift risk < 60
- [ ] docs/nodes/roast.md updated
- [ ] Agentes Relevantes updated
- [ ] Evidence collected in docs/test-evidence/issue-419/
- [ ] SUMMARY.md created
- [ ] CI/CD workflow tested
- [ ] No conflicts with main
- [ ] Pre-Flight checklist passed

---

## 13. Notas Adicionales

### Decisiones Técnicas

**Decision 1: Playwright over Cypress**
- **Rationale**: Better multi-browser support, faster execution, better TypeScript support
- **Trade-off**: Steeper learning curve, but better long-term investment

**Decision 2: Mock Server for Error Simulation**
- **Rationale**: More reliable than network manipulation, easier to set up
- **Trade-off**: Doesn't test actual network failures, but tests UI behavior

**Decision 3: Timeout at 30s**
- **Rationale**: Balance between UX (user won't wait forever) and reliability (OpenAI can be slow)
- **Trade-off**: Some legitimate requests may timeout, but retry is available

**Decision 4: Variant Limit at 5**
- **Rationale**: Cost control (5 variants = ~$0.05), prevents abuse, reasonable UX
- **Trade-off**: Users may want more options, but can approve/reject existing

### Consideraciones de Rendimiento

- E2E tests run in parallel (up to 5 workers) for faster execution
- Screenshots only on failure to reduce artifact size
- Mock server responses cached to reduce test flakiness
- Headless mode in CI for faster execution

### Seguridad

- Error messages do not leak sensitive information (database details, API keys)
- Error codes are generic (E_TIMEOUT, E_NETWORK) without implementation details
- Frontend validates all inputs before sending to backend
- Backend enforces variant limits to prevent abuse

---

**Plan Completed:** 2025-10-13
**Ready for Implementation:** YES
**Next Step:** Execute Fase 1 (Setup E2E Infrastructure) AUTOMATICALLY without user confirmation
