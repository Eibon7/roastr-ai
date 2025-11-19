# Plan: Integration Tests for Brand Safety (Issue #866)

**Issue:** #866  
**Tipo:** Integration Tests  
**Prioridad:** high-priority  
**Labels:** enhancement, backend  
**Parent Issue:** #859 (Brand Safety for Sponsors - Plan Plus)  
**Implementation PR:** #865 (merged 2025-11-18)  

---

## 📋 Estado Actual

### ✅ Implementación Completa (Issue #859 / PR #865)
- **SponsorService**: Completo con 34 unit tests passing (100%)
- **Routes**: `/api/sponsors` CRUD completos con plan gating
- **Integration**: Brand Safety integrado en Analysis Department + Roast Generation
- **Status**: ✅ 100% complete con unit tests

### ❌ Gap Identificado
- **Integration tests**: Removidos en commit 824dfddb debido a complejidad de mocking
- **Razón**: Complex middleware mocking (`authenticateToken`, `requirePlan`)
- **Necesidad**: Validar flujo completo con Supabase real + mocked OpenAI

---

## 🎯 Objetivos (5 Acceptance Criteria)

### AC #1: Coverage ≥80% integration coverage para SponsorService + routes
- Integration tests para SponsorService (CRUD operations + tag extraction)
- Integration tests para sponsors API routes
- Usar Supabase real con test database (RLS validation)

### AC #2: E2E: At least 2 full-flow tests (shield + roast)
- Full Shield Flow: Comment → Sponsor detection → Shield action
- Defensive Roast Flow: Comment → Sponsor detection → Roast generation con tone override

### AC #3: Plan Gating: All routes properly gated to Plus tier
- Verify `requirePlan('plus', {feature: 'brand_safety'})` enforcement
- Test Free/Basic/Pro users → 403
- Test Plus users → 200/201

### AC #4: RLS: Sponsors isolated by user_id
- Users can only CRUD their own sponsors
- Cross-tenant sponsor access blocked
- RLS policies validated via Supabase queries

### AC #5: CI: All tests pass in GitHub Actions
- All integration tests passing locally
- CI/CD validation passing
- No flaky tests

---

## 📊 Scope Detallado

### 1. Integration Tests for SponsorService (Priority: P0)

**File:** `tests/integration/sponsor-service-integration.test.js`

**Test Cases:**

#### CRUD Operations (with real Supabase)
- [ ] **Create sponsor** with RLS policy enforcement
  - Valid sponsor creation (Plus user)
  - Duplicate sponsor name error handling (409)
  - Invalid plan user (Free/Basic/Pro) → 403
  - organization_id automatically set from auth.uid()

- [ ] **Get sponsors** filtered by user
  - User can see their own sponsors
  - User cannot see other users' sponsors (RLS)
  - Empty result for new users

- [ ] **Update sponsor** with ownership validation
  - User can update their own sponsors
  - User cannot update other users' sponsors (RLS)
  - Duplicate name validation on update

- [ ] **Delete sponsor** with cascade checks
  - User can delete their own sponsors
  - User cannot delete other users' sponsors (RLS)
  - Orphaned roast decisions validated

#### Tag Extraction (with mocked OpenAI)
- [ ] **Extract tags from URL** with HTML scraping
  - Valid URL with meta tags → successful extraction
  - Invalid URL (malformed) → 400
  - Fetch timeouts (5s timeout)
  - Rate limits (5/min) enforcement
  - Cost tracking via CostControl

- [ ] **Handle fetch errors**
  - Network errors → retry logic
  - 404 responses → error message
  - SSL errors → error message

#### Sponsor Detection
- [ ] **Exact name matching**
  - "Nike" in comment → match
  - "NIKE" (case-insensitive) → match
  - "nike shoes" → match
  - "nik" (partial) → no match

- [ ] **Tag-based matching**
  - Tag "sportswear" in comment → match
  - Multiple tags → first match wins
  - Tag priority by sponsor priority

- [ ] **Priority-based multi-sponsor scenarios**
  - Multiple sponsors match → highest priority wins
  - Equal priority → first created wins

- [ ] **Edge cases**
  - null comment → no match
  - empty string → no match
  - special chars in sponsor name → match

### 2. API Route Tests (Priority: P1)

**File:** `tests/integration/routes/sponsors.test.js`

**Test Cases:**

#### Authentication & Authorization
- [ ] **Unauthenticated requests** → 401
  - No token provided
  - Invalid token format
  - Expired token

- [ ] **Free/Basic plan users** → 403 (require Plus)
  - GET /api/sponsors → 403
  - POST /api/sponsors → 403
  - PUT /api/sponsors/:id → 403
  - DELETE /api/sponsors/:id → 403

- [ ] **Plus users** → 200/201 (success)
  - GET /api/sponsors → 200 + sponsors list
  - POST /api/sponsors → 201 + created sponsor
  - PUT /api/sponsors/:id → 200 + updated sponsor
  - DELETE /api/sponsors/:id → 204

#### Plan Gating
- [ ] **requirePlan('plus', {feature: 'brand_safety'})** enforcement
  - Middleware applied to all routes
  - Feature flag validation
  - Plan tier validation

#### Input Validation
- [ ] **Missing required fields** (name, url)
  - POST without name → 400
  - POST without url → 400 (if tag extraction requested)

- [ ] **Invalid severity/tone/priority** values
  - Invalid severity → 400
  - Invalid tone → 400
  - Invalid priority (out of range) → 400

- [ ] **URL sanitization** (reject `javascript:`, `data:`, etc.)
  - javascript:alert(1) → 400
  - data:text/html,<script> → 400
  - Valid HTTPS URL → 200

### 3. E2E Flow Tests (Priority: P1)

**Files:** 
- `tests/e2e/brand-safety-shield-flow.e2e.test.js` (Shield Flow)
- `tests/e2e/brand-safety-defensive-roast.e2e.test.js` (Defensive Roast)

**Test Cases:**

#### Full Shield Flow (AC #2)
- [ ] **Comment with sponsor mention ingested**
  1. User creates sponsor via `POST /api/sponsors` (Nike, high severity)
  2. Comment with sponsor mention ingested ("Nike is a scam")
  3. AnalyzeToxicityWorker detects sponsor in `userContext`
  4. AnalysisDecisionEngine applies Rule 0.5 (Brand Safety)
  5. ShieldService executes action (hide_comment + block_user + sponsor_protection)
  6. Verify `brand_safety` metadata in decision:
     ```json
     {
       "sponsor": "Nike",
       "severity": "high",
       "matchType": "exact",
       "threshold_adjustment": -0.2
     }
     ```

#### Zero Tolerance Flow
- [ ] **Sponsor with zero_tolerance severity**
  1. Create sponsor with severity: "zero_tolerance"
  2. Toxic comment mentioning sponsor (toxicity: 0.65)
  3. Immediate SHIELD action triggered
  4. Comment hidden + user blocked
  5. Verify action_tags: ["hide_comment", "block_user", "sponsor_protection"]

#### Defensive Roast Flow (AC #2)
- [ ] **Sponsor with def_roast action**
  1. Create sponsor with actions: ["def_roast"], tone: "professional"
  2. Toxic comment mentioning sponsor (toxicity: 0.75)
  3. GenerateReplyWorker generates defensive roast
  4. Roast includes sponsor tone override (professional)
  5. Verify roast published with `brand_safety` tag
  6. Verify prompt included sponsor context in Block C

---

## 🛠️ Estrategia de Testing

### Mocking Strategy

**From removed tests (commit 824dfddb):**
- Complex middleware mocking (`authenticateToken`, `requirePlan`)
- Supabase auth.uid() RLS policy simulation

**Recommended approach:**
1. Use `supertest` for API route testing
2. Mock `authenticateToken` to inject test user
3. Mock `requirePlan` to simulate Plus tier
4. Use **test database** for RLS validation (similar to `tests/integration/rls-test-utils.js`)

### Dependencies

```javascript
const request = require('supertest');
const { createTestUser, cleanupTestUser } = require('../helpers/rls-test-utils');
const app = require('../../src/index'); // Express app
const { SponsorService } = require('../../src/services/sponsorService');
```

### Test Database Setup

- Use dedicated test database (not production)
- RLS policies enabled (match production schema)
- Cleanup after each test suite

---

## 📂 Archivos Afectados

### Nuevos Archivos (4 archivos)
- `tests/integration/sponsor-service-integration.test.js` - SponsorService CRUD + tag extraction
- `tests/integration/routes/sponsors.test.js` - API routes + auth + plan gating (existed, fixed)
- `tests/e2e/brand-safety-shield-flow.e2e.test.js` - Shield Flow E2E tests
- `tests/e2e/brand-safety-defensive-roast.e2e.test.js` - Defensive Roast E2E tests

### Archivos a Modificar (Referencias)
- `src/services/sponsorService.js` - Review for integration test coverage
- `src/routes/sponsors.js` - Validate middleware application
- `docs/nodes/shield.md` - Update with integration test references
- `docs/nodes/roast.md` - Update with Brand Safety test references

---

## 🎯 Validación

### Criterios de Éxito

1. **Coverage:** ≥80% integration coverage para SponsorService + routes
   - Validar con: `npm run test:coverage`
   - Verificar cobertura de `src/services/sponsorService.js` y `src/routes/sponsors.js`

2. **E2E:** At least 2 full-flow tests (shield + roast)
   - Full Shield Flow: ✅ passing
   - Defensive Roast Flow: ✅ passing

3. **Plan Gating:** All routes properly gated to Plus tier
   - Free/Basic/Pro users → 403
   - Plus users → 200/201

4. **RLS:** Sponsors are properly isolated by user_id
   - Cross-tenant access blocked (403)
   - RLS policies validated with Supabase queries

5. **CI:** All tests pass in GitHub Actions
   - Local: `npm test -- sponsor`
   - CI: GitHub Actions passing

### Metrics

- [ ] All integration tests passing (≥20 tests)
- [ ] E2E flows validated end-to-end (≥2 tests)
- [ ] Zero false positives/negatives in sponsor detection
- [ ] Cost tracking verified for tag extraction

---

## 🔗 Referencias

- **Parent Issue:** #859 (Brand Safety for Sponsors)
- **Implementation PR:** #865 (merged 2025-11-18)
- **Documentation:**
  - `docs/nodes/shield.md` - Brand Safety integration
  - `docs/nodes/roast.md` - Defensive Roast integration
- **Unit Tests:** `tests/unit/services/sponsorService.test.js` (34 tests)
- **Original integration tests (removed):** <https://github.com/Eibon7/roastr-ai/commit/824dfddb>
- **Pattern reference:** PR #822 (analytics tests), PR #813 (billing tests)

---

## 📝 Notas

- **Estimate:** 8-12 hours
- **Test Pattern:** Follow existing integration test patterns from `tests/integration/`
- **RLS Validation:** Use `tests/helpers/rls-test-utils.js` for tenant isolation
- **OpenAI Mocking:** Mock OpenAI API for tag extraction (avoid costs)
- **Supabase:** Use test database with RLS policies enabled

---

**Agentes Relevantes:**
- **TestEngineer** - Implementar integration tests y E2E tests
- **Guardian** - Validar billing + security (Plus plan gating)

**Creado:** 2025-11-19  
**Estado:** Planning Complete → Ready for Implementation

