# Plan: Issue #972 - Fix Tone Validation Unreachable Code

**Issue:** Fix: Tone validation unreachable code prevents backward compatibility (Related to #872)
**Priority:** High Priority
**Labels:** bug, high-priority, backend
**Created:** 2025-11-25
**AC Count:** 6

---

## 🎯 Problem Analysis

### Current State (Broken)

In `src/routes/config.js` lines 149-168, there are **two consecutive checks** for tone validation:

```javascript
// Line 150-155: First check (ALWAYS returns 400 for invalid tones)
if (tone && !VALID_TONES.includes(tone)) {
  return res.status(400).json({
    success: false,
    error: 'Invalid tone. Must be one of: ' + VALID_TONES.join(', ')
  });
}

// Line 159-168: Second check (DEAD CODE - never reached)
if (tone && !VALID_TONES.includes(tone)) {
  const normalizedTone = toneCompatibilityService.normalizeTone(tone);
  // ... normalization logic never executes
}
```

### Additional Issue Found

The `toneCompatibilityService.normalizeTone(tone)` method called on line 161 and line 239 **does not exist** in the service. The service only has:
- `mapLegacyToNewTone(config)` - accepts config object, not string
- `isValidNewTone(tone)` - validates if tone is valid

### Impact

1. ❌ Legacy tones cannot be normalized (Issue #872 feature broken)
2. ❌ Dead code in production (lines 159-168 never execute)
3. ❌ Line 239 calls non-existent method `normalizeTone(tone)`
4. ⚠️ Users with legacy tones get errors instead of normalization

---

## 📋 Acceptance Criteria

- [ ] AC1: Remove duplicate tone validation check
- [ ] AC2: Preserve tone normalization logic from Issue #872
- [ ] AC3: Add unit tests for tone normalization edge cases
- [ ] AC4: Add integration tests verifying legacy tones are normalized
- [ ] AC5: Verify backward compatibility with existing configs
- [ ] AC6: No breaking changes to API

---

## 🛠️ Implementation Plan

### Step 1: Add `normalizeTone(tone)` method to toneCompatibilityService.js

Create a simple method that accepts a tone string and returns the normalized version:

```javascript
/**
 * Normalize a tone string to valid tone
 * @param {string} tone - Input tone (may be legacy or alias)
 * @returns {string|null} Normalized tone or null if invalid
 */
normalizeTone(tone) {
  if (!tone) return null;
  
  // Direct valid tones
  const validTones = ['flanders', 'light', 'balanceado', 'balanced', 'canalla', 'savage'];
  if (validTones.includes(tone.toLowerCase())) {
    // Normalize aliases to canonical form
    const canonicalMap = {
      'light': 'flanders',
      'balanced': 'balanceado',
      'savage': 'canalla'
    };
    return canonicalMap[tone.toLowerCase()] || tone.toLowerCase();
  }
  
  return null; // Invalid tone
}
```

### Step 2: Fix config.js - Merge duplicate validation

Replace lines 149-168 with single, correct logic:

```javascript
// Validate and normalize tone (backward compatibility - Issue #872)
if (tone && !VALID_TONES.includes(tone)) {
  const normalizedTone = toneCompatibilityService.normalizeTone(tone);
  if (!normalizedTone) {
    return res.status(400).json({
      success: false,
      error: 'Invalid tone. Must be one of: ' + VALID_TONES.join(', ')
    });
  }
  // Use normalized tone for the rest of the flow
  tone = normalizedTone;
}
```

### Step 3: Add unit tests

File: `tests/unit/services/toneCompatibilityService.test.js`

Test cases:
- Valid tones pass through unchanged
- Alias tones (light→flanders, balanced→balanceado, savage→canalla)
- Invalid tones return null
- Case insensitivity
- Empty/null handling

### Step 4: Add integration tests

File: `tests/integration/config.test.js`

Test cases:
- Valid tones accepted
- Legacy/alias tones normalized and accepted
- Invalid tones rejected with clear error
- Normalized tones persisted to DB

---

## 📁 Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/services/toneCompatibilityService.js` | Modify | Add `normalizeTone(tone)` method |
| `src/routes/config.js` | Modify | Fix duplicate validation (lines 149-168) |
| `tests/unit/services/toneCompatibilityService.test.js` | Create/Modify | Add normalizeTone tests |
| `tests/integration/config.test.js` | Create/Modify | Add integration tests |

---

## 🤖 Agents Required

- **TestEngineer** - Changes to `src/` and `tests/`
- **Back-end Dev** - Backend fix

---

## ✅ Validation Checklist

- [ ] `npm test` passes (100%)
- [ ] `npm run test:coverage` >= 90%
- [ ] `node scripts/validate-gdd-runtime.js --full` passes
- [ ] `node scripts/score-gdd-health.js --ci` >= 87
- [ ] 0 CodeRabbit comments
- [ ] Receipts generated

---

## 📝 Testing Checklist (from Issue)

- [ ] Valid tones accepted (`balanceado`, `savage`, etc.)
- [ ] Invalid tones rejected with clear error
- [ ] Legacy tones normalized correctly (from Issue #872)
- [ ] `toneCompatibilityService.normalizeTone()` called for invalid tones
- [ ] Normalized tones persisted to DB
- [ ] Integration tests pass

---

**Status:** Planning Complete → Proceeding to Implementation

