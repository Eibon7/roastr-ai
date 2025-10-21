# Test-Fixing Session #6 - TierValidationService Singleton/Class Export Fix

**Date:** 2025-10-21
**Branch:** claude/start-project-011CUKB5YZbkJyq11F2L1hVC
**Issue:** #618 - Jest Compatibility Fixes
**Commit:** TBD

---

## 🎯 Objetivo

Fix "TierValidationService is not a constructor" errors (32 occurrences) caused by exporting singleton instance instead of class.

---

## 🔧 Problem Analysis

**Error:** `TypeError: TierValidationService is not a constructor`
**Frequency:** 32 occurrences in tierValidationService-coderabbit-round6.test.js
**Root Cause:** Service exports singleton instance, but tests need to instantiate class

### Code Analysis

**TierValidationService module (src/services/tierValidationService.js):**
```javascript
// Line 1490 (BEFORE - WRONG):
// Export singleton instance
module.exports = new TierValidationService();
```

**Test pattern (tests/unit/services/tierValidationService-coderabbit-round6.test.js):**
```javascript
// Line 1 (BEFORE):
const TierValidationService = require('../../../src/services/tierValidationService');

// Line 18:
service = new TierValidationService();  // ❌ Trying to instantiate an instance
```

**Why it fails:**
1. `require('tierValidationService')` returns an **instance** (already instantiated)
2. Tests try to do `new instance()` which fails - instances are not constructors
3. Result: 32 "is not a constructor" errors across test file

---

## ✅ Fix Applied

**Solution:** Export both singleton instance (for production) and class (for testing)

**Service changes (src/services/tierValidationService.js):**
```javascript
// Lines 1490-1495 (AFTER - CORRECT):
// Export singleton instance for production use
const instance = new TierValidationService();

// Export both instance (default) and class (for testing) - Issue #618
module.exports = instance;
module.exports.TierValidationService = TierValidationService;
```

**Test changes (tests/unit/services/tierValidationService-coderabbit-round6.test.js):**
```javascript
// Line 1 (AFTER - CORRECT):
const { TierValidationService } = require('../../../src/services/tierValidationService'); // Issue #618 - Import class for testing

// Line 18:
service = new TierValidationService();  // ✅ Now instantiates the class
```

**Pattern Established:**
- Production code: `const service = require('./tierValidationService')` → gets singleton instance
- Test code: `const { TierValidationService } = require('./tierValidationService')` → gets class for instantiation

---

## 📊 Results

### Tests FIXED ✅

**Before Fix:**
- Cannot instantiate class (32 errors)
- All tests fail immediately

**After Fix:**
```
Test Suites: 1 failed, 1 total
Tests:       2 failed, 14 passed, 16 total
```

**Impact:**
- ✅ **32 "is not a constructor" errors eliminated** (100% of this error type)
- ✅ **14/16 tests passing** (87.5% pass rate)
- ✅ Class can now be instantiated for testing

### Remaining Test Failures (Different Issues)

**2 tests still failing** - NOT related to class instantiation:

1. **"should fail closed on database connection errors"**
   - Issue: Test expects promise rejection, service returns fail-closed response
   - Actual behavior: `{allowed: false, failedClosed: true}` (CORRECT fail-closed pattern)
   - Root cause: Test expectation mismatch (expects `.rejects.toThrow()`, gets successful fail-closed)

2. **"should handle mixed success/failure in concurrent operations"**
   - Issue: Mock not failing as expected
   - Test expects `results[1].status = 'rejected'`, got `'fulfilled'`
   - Root cause: Mock setup issue (all calls succeeding instead of second failing)

---

## 🔍 Verification

**Confirmed error elimination:**
```bash
# Before: 32 occurrences of "TierValidationService is not a constructor"
# After: 0 occurrences ✅

npm test tests/unit/services/tierValidationService-coderabbit-round6.test.js
# 14/16 tests passing
```

**Overall suite impact:**
```
Test Suites: 174 failed, 145 passed, 319 total
Tests:       1174 failed, 4027 passed, 5256 total
```

---

## ✅ Session #6 Summary

**Files Modified:** 2
- `src/services/tierValidationService.js` (export pattern changed)
- `tests/unit/services/tierValidationService-coderabbit-round6.test.js` (import changed to destructure class)

**Changes:**
- Added dual export pattern (instance + class)
- Updated test import to destructure class
- Total lines modified: +5, -2 (net: +3)

**Commit:** `fix(tier-validation): Export class for testing - Issue #618`

**Pattern Established:** When a service needs both singleton instance (production) and class (testing), export both:
- Default export: singleton instance
- Named export: class constructor

---

## 📌 Impact Summary

**Error Elimination:**
- Before: 32 occurrences of "TierValidationService is not a constructor"
- After: 0 occurrences ✅

**Test Success Rate:**
- Before: 0/16 tests could run (immediate constructor error)
- After: 14/16 tests passing (87.5%) ✅

**Root Cause:** Singleton pattern without test hook for class instantiation

**Prevention:** When creating singleton services, always export both instance and class for testing flexibility

---

**Status:** ✅ Session #6 Complete
**Errors Fixed:** 32 (TierValidationService is not a constructor)
**Tests Fixed:** 14 (tierValidationService-coderabbit-round6.test.js)
**Remaining Issues:** 2 test expectation mismatches (not class instantiation related)
