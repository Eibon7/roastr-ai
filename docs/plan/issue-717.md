# Implementation Plan - Issue #717

## Tone System Testing - Add validation for tone mapping and humor types

**Issue:** #717
**Priority:** 🟡 MEDIA
**Effort:** 1 week
**Created:** 2025-11-04
**Agent:** Test Engineer + Orchestrator

---

## 📋 Summary

Add comprehensive test coverage for the tone mapping system and humor type validation to ensure roast generation quality is protected from regressions.

**Source:** `docs/TRABAJO-PENDIENTE-ANALISIS.md` - Section 3.1.6

---

## 🎯 Acceptance Criteria

- [x] Unit tests for tone mapping logic ✅ (24 tests exist in `tests/unit/config/tones.test.js`)
- [ ] Validation tests for all humor types
- [ ] Edge case testing (invalid tones, boundary values)
- [ ] Integration tests with roast generation
- [ ] Tests ≥80% coverage for tone module
- [ ] Documentation updated

---

## 📊 Current State Analysis

### ✅ Existing Coverage

**File:** `tests/unit/config/tones.test.js` (24 tests passing)

- ✅ `normalizeTone()` - case-insensitive, whitespace handling, invalid inputs
- ✅ `isValidTone()` - strict/non-strict modes, type safety
- ✅ `getRandomTone()` - randomness, valid outputs
- ✅ `getToneExamples()` - examples for all tones
- ✅ Immutability tests (Object.freeze)
- ✅ Performance tests (O(1) lookups)

**Coverage:** `src/config/tones.js` → 100%

### ❌ Gaps Identified

1. **No tests for humor type validation**
   - 5 types defined: `['witty', 'clever', 'sarcastic', 'playful', 'observational']`
   - Location: `src/config/validationConstants.js` line 57
   - No validation function exists yet

2. **No tests for intensity level validation**
   - Range: 1-5 (MIN_INTENSITY, MAX_INTENSITY)
   - Mapping logic in `RoastPromptTemplate.mapUserTone()`:
     - ≤2: "suave y amigable"
     - ≥4: "directo y sin filtros"
   - No boundary/edge case tests

3. **No integration tests with roast generation**
   - `RoastPromptTemplate.mapUserTone()` combines tone + humor_type + intensity
   - No tests verifying end-to-end tone → prompt injection

4. **No tests for plan-based tone access**
   - Free plan: Balanceado only
   - Starter/Pro/Plus: All 3 tones
   - Plus only: custom_style_prompt

---

## 🛠️ Implementation Plan

### Phase 1: Humor Type Validation Tests

**New File:** `tests/unit/config/validationConstants-humor.test.js`

**Tests to implement:**

1. **VALID_HUMOR_TYPES definition**
   - Should be frozen (immutable)
   - Should contain exactly 5 types
   - Should include ['witty', 'clever', 'sarcastic', 'playful', 'observational']

2. **Humor type validation function** (to create if missing)
   - `isValidHumorType(type)` - case-insensitive
   - Accept valid types in any case
   - Reject invalid types
   - Type-safe for null/undefined/non-strings

3. **Edge cases**
   - Empty string → false
   - Null/undefined → false
   - Numbers, objects, arrays → false
   - Whitespace handling → normalize and validate

**Files to modify:**

- Create: `tests/unit/config/validationConstants-humor.test.js`
- Update: `src/config/validationConstants.js` (add `isValidHumorType()` if missing)

**Estimated time:** 1 day

---

### Phase 2: Intensity Level Validation Tests

**New File:** `tests/unit/config/validationConstants-intensity.test.js`

**Tests to implement:**

1. **MIN_INTENSITY/MAX_INTENSITY constants**
   - MIN_INTENSITY === 1
   - MAX_INTENSITY === 5

2. **Intensity validation function** (to create)
   - `isValidIntensity(level)` - accepts integers 1-5
   - Reject 0, 6, negative values
   - Reject decimals (3.5 → false)
   - Type-safe for null/undefined/non-numbers

3. **Boundary testing**
   - Exactly 1 → true
   - Exactly 5 → true
   - 0 → false
   - 6 → false
   - -1 → false

4. **Intensity mapping descriptions**
   - Test `getIntensityDescription(level)`:
     - 1-2 → "suave y amigable"
     - 3 → neutral/default
     - 4-5 → "directo y sin filtros"

**Files to modify:**

- Create: `tests/unit/config/validationConstants-intensity.test.js`
- Update: `src/config/validationConstants.js` (add validation functions)

**Estimated time:** 1 day

---

### Phase 3: Integration Tests with Roast Generation

**New File:** `tests/unit/services/roastPromptTemplate-tone.test.js`

**Tests to implement:**

1. **mapUserTone() basic functionality**
   - Default config → default tone
   - Valid tone + humor_type → combined description
   - Valid tone + intensity_level → includes intensity modifier

2. **Tone + Humor combinations** (matrix testing)
   - All 3 tones × 5 humor types = 15 combinations
   - Verify each produces valid description
   - Verify format: "Canalla, directo y agresivo, estilo witty"

3. **Intensity level modifiers**
   - intensity_level: 1 → includes "suave y amigable"
   - intensity_level: 2 → includes "suave y amigable"
   - intensity_level: 3 → no intensity modifier
   - intensity_level: 4 → includes "directo y sin filtros"
   - intensity_level: 5 → includes "directo y sin filtros"

4. **Custom style prompt (Plus plan)**
   - With custom_style_prompt → appends ". Estilo personalizado: {prompt}"
   - Without custom_style_prompt → no custom section
   - Feature flag check: ENABLE_CUSTOM_PROMPT

5. **Edge cases**
   - Missing tone → defaults to 'Balanceado'
   - Missing humor_type → defaults to 'witty'
   - Missing intensity_level → defaults to 3
   - Invalid values → gracefully falls back to defaults

**Files to modify:**

- Create: `tests/unit/services/roastPromptTemplate-tone.test.js`
- Potentially update: `src/services/roastPromptTemplate.js` (add defensive defaults)

**Estimated time:** 2 days

---

### Phase 4: Plan-Based Tone Access Tests

**File to extend:** `tests/unit/config/tones.test.js` or create `tests/integration/tone-plan-access.test.js`

**Tests to implement:**

1. **Free plan restrictions**
   - Tone access: Balanceado only
   - Humor type: witty only
   - Intensity: fixed at 3
   - Custom prompt: blocked

2. **Starter/Pro plan access**
   - All 3 tones available
   - All 5 humor types available
   - Intensity: 1-5 range
   - Custom prompt: blocked

3. **Plus plan access**
   - All 3 tones available
   - All 5 humor types available
   - Intensity: 1-5 range
   - Custom prompt: ✅ enabled

**Note:** This requires integration with `planLimitsService.js` - may be out of scope if too complex. Decision point with Product Owner.

**Estimated time:** 1-2 days (or deferred if out of scope)

---

### Phase 5: Edge Case & Regression Tests

**Files to extend:** Multiple test files

**Tests to implement:**

1. **Type safety across all functions**
   - Pass non-string to tone functions → null/false
   - Pass non-number to intensity functions → false
   - Pass objects/arrays → handled gracefully

2. **Boundary conditions**
   - Tone: exactly 3 defined, no more, no less
   - Humor: exactly 5 defined
   - Intensity: exactly 1-5, inclusive

3. **Normalization consistency**
   - "FLANDERS" === "flanders" === "Flanders" → all normalize to "Flanders"
   - " Canalla " → "Canalla" (whitespace trimmed)

4. **Security: Injection protection**
   - custom_style_prompt with SQL injection attempt → sanitized
   - custom_style_prompt with prompt injection → sanitized
   - Max length enforcement (2000 chars from constants)

**Estimated time:** 1 day

---

### Phase 6: Documentation & Evidence

**Files to update:**

1. `docs/nodes/tone.md`
   - Add "## Test Coverage" section
   - Document new validation functions
   - Update "Agentes Relevantes" → add Test Engineer

2. `docs/test-evidence/issue-717/`
   - Create directory
   - Add `SUMMARY.md` with test results
   - Add coverage report screenshots/text
   - List all new test files created

3. `tests/README.md` (if exists)
   - Document tone testing approach
   - Link to new test files

**Estimated time:** 0.5 days

---

## 📁 Files to Create

1. `tests/unit/config/validationConstants-humor.test.js` (~150 lines)
2. `tests/unit/config/validationConstants-intensity.test.js` (~180 lines)
3. `tests/unit/services/roastPromptTemplate-tone.test.js` (~300 lines)
4. `docs/test-evidence/issue-717/SUMMARY.md`
5. `docs/test-evidence/issue-717/coverage-report.txt`

**Total new test files:** 3
**Total new test cases:** ~60-80 tests

---

## 📝 Files to Modify

1. `src/config/validationConstants.js`
   - Add `isValidHumorType(type)` function
   - Add `isValidIntensity(level)` function
   - Add `getIntensityDescription(level)` function
   - Export new functions

2. `src/services/roastPromptTemplate.js`
   - Add defensive defaults in `mapUserTone()`
   - Ensure graceful fallback for invalid configs

3. `docs/nodes/tone.md`
   - Add "## Test Coverage" section
   - Update "Agentes Relevantes" → add Test Engineer
   - Update coverage percentage

4. `tests/unit/config/tones.test.js` (optional extension)
   - Add tests for intensity descriptions if needed

---

## 🧪 Testing Strategy

### Test Pyramid Distribution

- **Unit tests:** 70% (~50 tests)
  - Validation functions (humor, intensity)
  - Normalization functions
  - Edge cases, type safety

- **Integration tests:** 25% (~18 tests)
  - RoastPromptTemplate.mapUserTone()
  - Tone + humor + intensity combinations
  - Custom prompt injection

- **E2E tests:** 5% (~4 tests - optional)
  - Full roast generation with different tone configs
  - May be deferred if too complex

### Coverage Target

**Per AC:** Tests ≥80% coverage for tone module

**Current estimate:**

- `src/config/tones.js`: Already 100%
- `src/config/validationConstants.js` (tone-related functions): Will reach 90%+
- `src/services/roastPromptTemplate.js` (mapUserTone): Will reach 85%+

**Overall tone module coverage:** Should easily exceed 80%

---

## 🎯 Success Criteria

- [ ] All 6 ACs marked complete
- [ ] ≥60 new tests passing
- [ ] Coverage ≥80% for tone module (verified with coverage report)
- [ ] No regression in existing tests (24 tests in tones.test.js still passing)
- [ ] Documentation updated with test evidence
- [ ] GDD node `tone.md` updated with new coverage data
- [ ] No CodeRabbit comments on PR

---

## 🚦 Risk Assessment

### Medium Risks

1. **Scope creep: Plan-based access testing**
   - Mitigation: Mark as optional, defer if too complex
   - Decision point with Product Owner

2. **Integration with existing validation**
   - Risk: Breaking existing validation logic
   - Mitigation: Run full test suite after each phase

### Low Risks

3. **Test flakiness**
   - Mitigation: Use deterministic test data, avoid randomness

4. **Coverage threshold not met**
   - Mitigation: Iterative testing, measure after each phase

---

## 🔗 Dependencies

### GDD Nodes

- `docs/nodes/tone.md` (8,794 lines) - Must read for context
- `docs/nodes/persona.md` - For custom_style_prompt integration
- `docs/nodes/plan-features.md` - For plan-based access (optional)

### Code Files

- `src/config/tones.js` - Core tone definitions
- `src/config/validationConstants.js` - Humor types, intensity range
- `src/config/constants.js` - Tone/humor mappings for prompts
- `src/services/roastPromptTemplate.js` - Integration with roast generation

### Existing Tests

- `tests/unit/config/tones.test.js` - 24 tests, must not regress

---

## 📅 Timeline Estimate

| Phase          | Tasks                                   | Estimated Time    |
| -------------- | --------------------------------------- | ----------------- |
| **Phase 1**    | Humor type validation tests             | 1 day             |
| **Phase 2**    | Intensity level validation tests        | 1 day             |
| **Phase 3**    | Integration tests (RoastPromptTemplate) | 2 days            |
| **Phase 4**    | Plan-based access tests (optional)      | 1-2 days or defer |
| **Phase 5**    | Edge cases & regression tests           | 1 day             |
| **Phase 6**    | Documentation & evidence                | 0.5 days          |
| **Validation** | Run full suite, fix issues              | 0.5 days          |

**Total estimated:** 6-8 days (with optional Phase 4)
**Aligns with issue estimate:** 1 week ✅

---

## 🔄 Continuous Validation

After each phase:

1. Run `npm test -- tests/unit/config/ tests/unit/services/roastPromptTemplate`
2. Check coverage: `npm test -- --coverage --collectCoverageFrom='src/config/tones.js' --collectCoverageFrom='src/config/validationConstants.js' --collectCoverageFrom='src/services/roastPromptTemplate.js'`
3. Verify no regressions in existing tests
4. Update todo list with completed tasks

---

## 📋 Checklist Before Implementation

- [x] Read `docs/patterns/coderabbit-lessons.md`
- [x] Analyze existing test coverage
- [x] Identify all files requiring tests
- [x] Create comprehensive plan in `docs/plan/issue-717.md`
- [ ] Get approval from Product Owner (for optional Phase 4)
- [ ] Create feature branch: `feat/issue-717-tone-testing`
- [ ] Begin implementation (Phase 1)

---

## 🤝 Agents Involved

| Agent                   | Role                                | Phase    |
| ----------------------- | ----------------------------------- | -------- |
| **Orchestrator**        | Planning, coordination              | FASE 0-1 |
| **Test Engineer**       | Test implementation, validation     | FASE 2-4 |
| **Guardian** (optional) | Security review for injection tests | FASE 5   |

---

## 📊 Post-Implementation Metrics

**Will measure:**

- Total tests added: Target ~60-80
- Coverage increase: Target ≥80% for tone module
- Test execution time: Should remain <5s for unit tests
- CodeRabbit comments: Target 0
- Bugs caught: Track regressions prevented

---

**Plan Status:** ✅ COMPLETE - Ready for implementation
**Next Step:** Continue to FASE 2 (Implementation)
