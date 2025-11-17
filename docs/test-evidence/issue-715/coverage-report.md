# Analytics Dashboard - Test Coverage Report

**Issue:** [#715](https://github.com/Eibon7/roastr-ai/issues/715)  
**Date:** 2025-11-17  
**Target Coverage:** ≥80%

---

## Current Coverage Status

### Backend Files

| File | Statements | Branches | Functions | Lines | Status |
|------|-----------|----------|-----------|-------|--------|
| `src/routes/analytics.js` | 94.38% | 65.35% | 97.67% | 94.61% | ✅ PASS |
| `src/services/analyticsDashboardService.js` | 8.56% | 4.86% | 3.7% | 8.66% | ❌ FAIL |

**Overall Analytics Coverage:** 57.74% (Below 80% target)

---

## Coverage Analysis

### ✅ Well Covered

**`src/routes/analytics.js` (94.38% statements)**
- All 3 endpoints tested (`/dashboard`, `/billing`, `/export`)
- Error handling covered
- Cache functionality tested
- Input validation tested

**Test Files:**
- `tests/unit/routes/analytics-dashboard-endpoints.test.js` (5 tests)

---

### ❌ Needs Improvement

**`src/services/analyticsDashboardService.js` (8.56% statements)**

**Covered Methods:**
- ✅ `_calculateTrend()` - 7 tests covering edge cases

**Uncovered Methods (Need Tests):**
- ❌ `getDashboardData()` - Main public method
- ❌ `getBillingAnalytics()` - Billing data aggregation
- ❌ `exportAnalytics()` - Export functionality
- ❌ `_resolveOrganizationContext()` - Context resolution
- ❌ `_clampRange()` - Range validation
- ❌ `_sanitizeGroupBy()` - Group by validation
- ❌ `_sanitizePlatform()` - Platform validation
- ❌ `_buildTimeframe()` - Date range building
- ❌ `_fetchSnapshots()` - Data fetching
- ❌ `_fetchUsageRecords()` - Usage data
- ❌ `_fetchShieldActions()` - Shield data
- ❌ `_fetchAnalyticsEvents()` - Events data
- ❌ `_buildTimelineChart()` - Chart building
- ❌ `_buildSummary()` - Summary aggregation
- ❌ `_buildPlatformChart()` - Platform chart
- ❌ `_buildCredits()` - Credits chart
- ❌ `_buildCostOverview()` - Cost calculation
- ❌ `_buildShieldStats()` - Shield statistics
- ❌ `_aggregateLocalBilling()` - Local billing
- ❌ `_fetchPolarBilling()` - Polar integration
- ❌ `_flattenRow()` - Data flattening
- ❌ `_formatLabel()` - Label formatting
- ❌ `_getWeekNumber()` - Week calculation
- ❌ `_toNumber()` - Number conversion
- ❌ `_averageField()` - Average calculation

**Total Methods:** 27  
**Tested Methods:** 1 (3.7%)  
**Untested Methods:** 26 (96.3%)

---

## Test Coverage Plan

### Priority 1: Core Public Methods (CRITICAL)

**Target:** ≥80% coverage for public API

1. **`getDashboardData()`**
   - Test with valid parameters
   - Test with different ranges (7, 30, 90, 365)
   - Test with different groupBy (day, week, month)
   - Test with platform filters
   - Test error handling
   - Test caching behavior

2. **`getBillingAnalytics()`**
   - Test with Polar available
   - Test with Polar unavailable (fallback)
   - Test with Polar error (graceful fallback)
   - Test different ranges
   - Test local costs aggregation

3. **`exportAnalytics()`**
   - Test CSV export
   - Test JSON export
   - Test different datasets (snapshots, usage, events)
   - Test permission errors (free plan)
   - Test invalid format/dataset
   - Test date range handling

### Priority 2: Helper Methods (HIGH)

4. **`_resolveOrganizationContext()`**
   - Test with org_id
   - Test without org_id (fetch from DB)
   - Test error handling

5. **`_clampRange()`, `_sanitizeGroupBy()`, `_sanitizePlatform()`**
   - Test valid inputs
   - Test invalid inputs (clamping/sanitization)
   - Test edge cases

6. **`_buildTimeframe()`**
   - Test different ranges
   - Test date calculations
   - Test timezone handling

### Priority 3: Data Fetching (MEDIUM)

7. **`_fetchSnapshots()`, `_fetchUsageRecords()`, `_fetchShieldActions()`, `_fetchAnalyticsEvents()`**
   - Test successful fetches
   - Test empty results
   - Test database errors
   - Test date filtering

### Priority 4: Chart Building (MEDIUM)

8. **`_buildTimelineChart()`, `_buildPlatformChart()`, `_buildCredits()`**
   - Test with data
   - Test with empty data
   - Test different groupBy values
   - Test chart structure

9. **`_buildSummary()`, `_buildCostOverview()`, `_buildShieldStats()`**
   - Test aggregation logic
   - Test empty data handling
   - Test calculation accuracy

### Priority 5: Utility Methods (LOW)

10. **`_flattenRow()`, `_formatLabel()`, `_getWeekNumber()`, `_toNumber()`, `_averageField()`**
    - Test various inputs
    - Test edge cases
    - Test formatting accuracy

---

## Recommended Test Structure

```javascript
describe('AnalyticsDashboardService', () => {
  describe('_calculateTrend', () => { /* ... existing tests ... */ });
  
  describe('getDashboardData', () => {
    it('should return dashboard data with valid parameters', async () => { /* ... */ });
    it('should handle different time ranges', async () => { /* ... */ });
    it('should handle different groupBy values', async () => { /* ... */ });
    it('should filter by platform', async () => { /* ... */ });
    it('should handle errors gracefully', async () => { /* ... */ });
  });
  
  describe('getBillingAnalytics', () => {
    it('should return billing data with Polar available', async () => { /* ... */ });
    it('should fallback to local data when Polar unavailable', async () => { /* ... */ });
    it('should handle Polar errors gracefully', async () => { /* ... */ });
  });
  
  describe('exportAnalytics', () => {
    it('should export CSV format', async () => { /* ... */ });
    it('should export JSON format', async () => { /* ... */ });
    it('should throw error for free plan', async () => { /* ... */ });
    it('should throw error for invalid format', async () => { /* ... */ });
  });
  
  // ... more test suites ...
});
```

---

## Estimated Effort

**To reach ≥80% coverage:**

- **Tests needed:** ~50-60 additional tests
- **Estimated time:** 4-6 hours
- **Priority:** High (blocks PR merge if coverage requirement is enforced)

---

## Current Test Count

**Backend:**
- `analytics-dashboard-endpoints.test.js`: 5 tests ✅
- `analyticsDashboardService.test.js`: 7 tests (only `_calculateTrend`) ⚠️

**Frontend:**
- `Analytics.test.jsx`: 2 tests ✅

**Total:** 14 tests

**Target:** ~60-70 tests for ≥80% coverage

---

## Action Items

### Immediate (Before PR Merge)

- [ ] Add tests for `getDashboardData()` (Priority 1)
- [ ] Add tests for `getBillingAnalytics()` (Priority 1)
- [ ] Add tests for `exportAnalytics()` (Priority 1)
- [ ] Verify coverage reaches ≥80% for analytics files

### Short Term (Post-Merge)

- [ ] Add tests for helper methods (Priority 2)
- [ ] Add tests for data fetching (Priority 3)
- [ ] Add tests for chart building (Priority 4)
- [ ] Add tests for utility methods (Priority 5)

---

## Verification Command

```bash
# Run coverage for analytics files only
npm test -- --coverage \
  --collectCoverageFrom='src/services/analyticsDashboardService.js' \
  --collectCoverageFrom='src/routes/analytics.js' \
  --testPathPatterns='analytics' \
  --watchAll=false

# Target: ≥80% statements, branches, functions, lines
```

---

## References

- **Issue #715:** https://github.com/Eibon7/roastr-ai/issues/715
- **PR #847:** https://github.com/Eibon7/roastr-ai/pull/847
- **Test Files:** `tests/unit/routes/analytics-dashboard-endpoints.test.js`, `tests/unit/services/analyticsDashboardService.test.js`

