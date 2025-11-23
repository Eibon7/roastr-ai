# Issue #482 - Remaining Tests Implementation Plan

**Document Status:** ACTIVE ROADMAP
**Generated:** 2025-10-26
**Current Progress:** 9/15 tests passing (60%)
**Target:** 15/15 tests passing (100%)
**Production Ready:** Yes - All features must be complete and production-grade

---

## Executive Summary

After fixing the off-by-one bug in offense level calculation and resolving the Test 1 vs Test 3 conflict, we have **9/15 tests passing (60%)**. The remaining **6 tests require implementing complex features** in Shield service that were previously not implemented.

**Key Achievement So Far:**

- ✅ Off-by-one bug fixed (offense level now calculates using total violations including current)
- ✅ Action matrix reverted to proper gradual escalation
- ✅ Test 1 vs Test 3 conflict resolved
- ✅ Violation tracking fixed
- ✅ Mock factory pattern working correctly

**What Remains:**

- 6 tests requiring complex feature implementations in `src/services/shieldService.js`
- All features must be production-ready (not just test-passing hacks)

---

## Current Test Status

### ✅ Passing (9/15 = 60%)

1. **Test 1** - Escalation path validation (warn → mute_temp → mute_permanent → block → report)
2. **Test 2** - Severity-based immediate escalation for critical content
3. **Test 3** - Violation frequency within time windows
4. **Test 4** - Time decay for old violations
5. **Test 9** - Organization-specific escalation configurations
6. **Test 11** - Emergency escalation for imminent threats
7. **Test 12** - Legal compliance bypass
8. **Test 14** - Missing/corrupted behavior data handling
9. **Test 15** - Performance thresholds

### ❌ Failing (6/15 = 40%)

1. **Test 5** - Cooling-off period escalation (is_muted + mute_expires_at logic)
2. **Test 6** - Time window escalation (violations within last N hours)
3. **Test 7** - Cross-platform aggregation (twitter + instagram violations combined)
4. **Test 8** - Platform-specific policies (twitter=aggressive, instagram=lenient)
5. **Test 10** - Special user type handling (verified_creator lenient escalation)
6. **Test 13** - Concurrent violations (race-safe counting)

---

## Remaining Tests - Detailed Implementation Guide

---

## Test 5: Cooling-Off Period Escalation

**Location:** `shield-escalation-logic.test.js:345-380`
**Status:** ❌ FAILING
**Complexity:** MEDIUM
**Estimated Effort:** 2-3 hours

### Current Failure

```javascript
// Test expects aggressive escalation for violations during active mute
expect(['block', 'report']).toContain(result.actions.primary);
// ❌ Received: 'mute_permanent'
```

### Business Logic Required

**Cooling-off period:** When a user is currently muted and commits another violation, escalate MORE aggressively than normal.

**Rationale:** User is violating rules while already under punishment → demonstrates pattern of disregarding moderation

### Test Setup

```javascript
const existingBehavior = createUserBehaviorData({
  userId: 'muted-user',
  isMuted: true, // User currently muted
  violationCount: 1,
  actionsTaken: [{ action: 'mute_temp', severity: 'medium', date: recentDate, duration: '24h' }]
});

// Add mute expiration timestamp
userBehavior.mute_expires_at = new Date(Date.now() + 23 * 3600000).toISOString();
```

### Implementation Approach

**File:** `src/services/shieldService.js`

**Step 1: Add cooling-off period detection (lines ~250-260)**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  const { severity_level } = analysisResult;
  const violationCount = userBehavior.total_violations || 0;

  // NEW: Detect if user is currently muted (cooling-off period)
  const isCoolingOffPeriod = this.isUserInCoolingOffPeriod(userBehavior);

  // Calculate total violations including current
  const totalViolations = violationCount + 1;

  // Determine offense level
  let offenseLevel = 'first';
  if (totalViolations >= this.options.reincidenceThreshold) {
    offenseLevel = 'persistent';
  } else if (totalViolations > 1) {
    offenseLevel = 'repeat';
  }

  // NEW: Override offense level if in cooling-off period
  if (isCoolingOffPeriod && offenseLevel !== 'persistent') {
    offenseLevel = 'persistent'; // Escalate faster
  }

  // Rest of method continues...
}
```

**Step 2: Add helper method (lines ~365-380)**

```javascript
/**
 * Check if user is currently in cooling-off period (active mute)
 * Issue #482: Users violating during active punishment should face harsher consequences
 *
 * @param {Object} userBehavior - User behavior data from database
 * @returns {boolean} True if user is currently muted with unexpired mute
 */
isUserInCoolingOffPeriod(userBehavior) {
  if (!userBehavior.is_muted) return false;
  if (!userBehavior.mute_expires_at) return false;

  const now = new Date();
  const expiresAt = new Date(userBehavior.mute_expires_at);

  return expiresAt > now; // Mute still active
}
```

**Step 3: Ensure mock factory provides fields (ALREADY DONE)**

```javascript
// mockSupabaseFactory.js already provides:
// - is_muted: false (default)
// - user_type: 'standard' (default)
// Tests can override: isMuted: true, mute_expires_at: <timestamp>
```

### Validation Criteria

- [ ] User with `is_muted: true` and valid `mute_expires_at` gets escalated offense level
- [ ] Normal escalation for users NOT in cooling-off period
- [ ] Expired mutes (mute_expires_at < now) don't trigger aggressive escalation
- [ ] Test 5 passes: `expect(['block', 'report']).toContain(result.actions.primary);`

---

## Test 6: Time Window Escalation

**Location:** `shield-escalation-logic.test.js:388-437`
**Status:** ❌ FAILING
**Complexity:** MEDIUM
**Estimated Effort:** 3-4 hours

### Current Failure

```javascript
// Test expects aggressive escalation for violations within 1 hour
if (window.expectedEscalation === 'aggressive') {
  expect(['block', 'report']).toContain(result.actions.primary);
  // ❌ Received: 'mute_temp'
}
```

### Business Logic Required

**Time windows:** Violations within SHORT time periods (e.g., 1 hour) should trigger aggressive escalation, while violations spread over LONG periods (e.g., 24 hours) should be lenient.

**Rationale:** Rapid-fire violations indicate spamming/trolling behavior vs. occasional lapses over time

### Test Setup

```javascript
const timeWindows = [
  { name: '1 hour', hours: 1, expectedEscalation: 'aggressive' }, // Block/report
  { name: '6 hours', hours: 6, expectedEscalation: 'moderate' }, // Mute permanent
  { name: '24 hours', hours: 24, expectedEscalation: 'minimal' } // Warn/mute temp
];

const recentViolation = new Date(Date.now() - window.hours * 60 * 60 * 1000);
const userBehavior = createUserBehaviorData({
  violationCount: 2,
  lastViolation: recentViolation.toISOString(),
  actionsTaken: [{ action: 'warn', date: recentViolation.toISOString() }]
});
```

### Implementation Approach

**File:** `src/services/shieldService.js`

**Step 1: Add time window configuration (lines ~70-80)**

```javascript
constructor(supabase, options = {}) {
  // Existing config...

  // NEW: Time window thresholds for escalation acceleration
  this.timeWindows = {
    aggressive: 1 * 60 * 60 * 1000,    // 1 hour in ms
    moderate: 6 * 60 * 60 * 1000,      // 6 hours
    minimal: 24 * 60 * 60 * 1000       // 24 hours
  };
}
```

**Step 2: Calculate violations within time window (lines ~250-280)**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  const { severity_level } = analysisResult;
  const violationCount = userBehavior.total_violations || 0;

  // Calculate total violations including current
  const totalViolations = violationCount + 1;

  // NEW: Check time window escalation
  const timeWindowEscalation = this.calculateTimeWindowEscalation(userBehavior);

  // Determine base offense level
  let offenseLevel = 'first';
  if (totalViolations >= this.options.reincidenceThreshold) {
    offenseLevel = 'persistent';
  } else if (totalViolations > 1) {
    offenseLevel = 'repeat';
  }

  // NEW: Apply time window escalation multiplier
  if (timeWindowEscalation === 'aggressive') {
    // Force to persistent if multiple violations in 1 hour
    if (totalViolations > 1) {
      offenseLevel = 'persistent';
    }
  } else if (timeWindowEscalation === 'minimal') {
    // Be more lenient for violations spread over 24+ hours
    if (offenseLevel === 'persistent' && totalViolations < 5) {
      offenseLevel = 'repeat';
    }
  }

  // Get action from matrix
  const primaryAction = this.actionMatrix[severity_level][offenseLevel];

  // NEW: Additional aggressive override for rapid-fire violations
  if (timeWindowEscalation === 'aggressive' && severity_level === 'medium') {
    // For 1-hour window violations, skip straight to block/report
    return this.getAggressiveAction(severity_level, offenseLevel, userBehavior);
  }

  // Rest of method...
}
```

**Step 3: Add time window calculator (lines ~380-420)**

```javascript
/**
 * Calculate escalation level based on time between violations
 * Issue #482: Rapid-fire violations should be treated more harshly
 *
 * @param {Object} userBehavior - User behavior data
 * @returns {string} 'aggressive' | 'moderate' | 'minimal'
 */
calculateTimeWindowEscalation(userBehavior) {
  if (!userBehavior.last_violation_at) return 'minimal';

  const lastViolation = new Date(userBehavior.last_violation_at);
  const now = new Date();
  const timeSinceLastViolation = now - lastViolation;

  if (timeSinceLastViolation <= this.timeWindows.aggressive) {
    return 'aggressive'; // Less than 1 hour
  } else if (timeSinceLastViolation <= this.timeWindows.moderate) {
    return 'moderate';   // 1-6 hours
  } else {
    return 'minimal';    // 6+ hours
  }
}

/**
 * Get aggressive action for rapid-fire violations
 *
 * @param {string} severity - Violation severity
 * @param {string} offenseLevel - Current offense level
 * @param {Object} userBehavior - User behavior data
 * @returns {Object} Shield action decision with aggressive escalation
 */
getAggressiveAction(severity, offenseLevel, userBehavior) {
  // For rapid-fire violations (< 1 hour), use next-tier action
  const aggressiveMatrix = {
    low: {
      first: 'mute_temp',
      repeat: 'mute_permanent',
      persistent: 'block'
    },
    medium: {
      first: 'mute_permanent',
      repeat: 'block',
      persistent: 'report'
    },
    high: {
      first: 'block',
      repeat: 'report',
      persistent: 'report'
    }
  };

  return aggressiveMatrix[severity][offenseLevel];
}
```

### Validation Criteria

- [ ] Violations within 1 hour → aggressive escalation (block/report)
- [ ] Violations within 6 hours → moderate escalation (mute_permanent)
- [ ] Violations within 24+ hours → minimal escalation (warn/mute_temp)
- [ ] Test 6 passes: All 3 time window scenarios validated

---

## Test 7: Cross-Platform Aggregation

**Location:** `shield-escalation-logic.test.js:445-494`
**Status:** ❌ FAILING
**Complexity:** HIGH
**Estimated Effort:** 4-5 hours

### Current Failure

```javascript
// Test expects violations aggregated across twitter + instagram
expect(result.userBehavior.total_violations).toBe(3);
// ❌ Received: 1
```

### Business Logic Required

**Cross-platform aggregation:** Users with violations on multiple platforms (twitter, instagram, youtube) should have their total violations AGGREGATED for escalation decisions.

**Rationale:** Prevents users from bypassing Shield by distributing violations across platforms

### Test Setup

```javascript
// Mock existing violations on twitter (2) and instagram (1)
mockSupabase._mockData.userBehavior = [
  createUserBehaviorData({
    userId: 'cross-platform-user',
    organizationId: 'org_123',
    platform: 'twitter',
    violationCount: 2
  }),
  createUserBehaviorData({
    userId: 'cross-platform-user',
    organizationId: 'org_123',
    platform: 'instagram',
    violationCount: 1
  })
];

// New violation on twitter
const comment = createTestComment({
  user_id: 'cross-platform-user',
  platform: 'twitter'
});
```

### Implementation Approach

**File:** `src/services/shieldService.js`

**Step 1: Query all platforms for user (lines ~150-170)**

```javascript
async analyzeForShield(comment, metadata) {
  const userId = comment.user_id;
  const platform = comment.platform;
  const organizationId = metadata.organizationId;

  // Query user behavior - CURRENT: queries single platform
  const { data: userBehavior, error } = await this.supabase
    .from('user_behavior')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('platform', platform)  // ❌ PROBLEM: Only queries current platform
    .eq('platform_user_id', userId)
    .single();

  // NEW: Query ALL platforms for cross-platform aggregation
  const aggregatedBehavior = await this.getAggregatedUserBehavior(
    organizationId,
    userId,
    platform
  );

  // Continue with aggregated behavior instead of single-platform behavior
  const actions = await this.determineShieldActions(
    comment.analysis,
    aggregatedBehavior,
    comment
  );

  // ...
}
```

**Step 2: Add cross-platform aggregator (lines ~420-480)**

```javascript
/**
 * Get aggregated user behavior across ALL platforms
 * Issue #482: Users can't bypass Shield by distributing violations across platforms
 *
 * @param {string} organizationId - Organization ID
 * @param {string} userId - Platform user ID
 * @param {string} currentPlatform - Current platform for this violation
 * @returns {Object} Aggregated user behavior with cross-platform violation counts
 */
async getAggregatedUserBehavior(organizationId, userId, currentPlatform) {
  // Query user behavior across ALL platforms
  const { data: allBehaviors, error } = await this.supabase
    .from('user_behavior')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('platform_user_id', userId);

  if (error) {
    this.logger.error('[ShieldService] Error querying cross-platform behavior', { error });
    // Fallback: query current platform only
    return await this.getSinglePlatformBehavior(organizationId, userId, currentPlatform);
  }

  if (!allBehaviors || allBehaviors.length === 0) {
    // No existing violations across any platform
    return this.createNewUserBehavior(organizationId, userId, currentPlatform);
  }

  // Aggregate violations across all platforms
  const aggregated = {
    organization_id: organizationId,
    platform_user_id: userId,
    platform: currentPlatform, // Use current platform for new action
    total_violations: 0,
    violation_severity_counts: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    actions_taken: [],
    strikes: 0,
    risk_score: 0,
    is_muted: false,
    user_type: 'standard',
    last_violation_at: null,
    last_seen_at: new Date().toISOString()
  };

  // Aggregate counts from all platforms
  allBehaviors.forEach(behavior => {
    aggregated.total_violations += behavior.total_violations || 0;

    // Aggregate severity counts
    const counts = behavior.violation_severity_counts || {};
    aggregated.violation_severity_counts.low += counts.low || 0;
    aggregated.violation_severity_counts.medium += counts.medium || 0;
    aggregated.violation_severity_counts.high += counts.high || 0;
    aggregated.violation_severity_counts.critical += counts.critical || 0;

    // Aggregate actions taken
    if (behavior.actions_taken) {
      aggregated.actions_taken.push(...behavior.actions_taken);
    }

    // Take maximum strikes across platforms
    aggregated.strikes = Math.max(aggregated.strikes, behavior.strikes || 0);

    // Take maximum risk score
    aggregated.risk_score = Math.max(aggregated.risk_score, behavior.risk_score || 0);

    // User is muted if muted on ANY platform
    if (behavior.is_muted) {
      aggregated.is_muted = true;
      aggregated.mute_expires_at = behavior.mute_expires_at;
    }

    // Take most recent violation timestamp
    if (behavior.last_violation_at) {
      const violationDate = new Date(behavior.last_violation_at);
      if (!aggregated.last_violation_at || violationDate > new Date(aggregated.last_violation_at)) {
        aggregated.last_violation_at = behavior.last_violation_at;
      }
    }

    // Use special user type if set on any platform
    if (behavior.user_type && behavior.user_type !== 'standard') {
      aggregated.user_type = behavior.user_type;
    }
  });

  return aggregated;
}

/**
 * Fallback: Get single-platform behavior
 */
async getSinglePlatformBehavior(organizationId, userId, platform) {
  const { data, error } = await this.supabase
    .from('user_behavior')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('platform', platform)
    .eq('platform_user_id', userId)
    .single();

  if (error || !data) {
    return this.createNewUserBehavior(organizationId, userId, platform);
  }

  return data;
}

/**
 * Create new user behavior record for first-time offender
 */
createNewUserBehavior(organizationId, userId, platform) {
  return {
    organization_id: organizationId,
    platform_user_id: userId,
    platform: platform,
    total_violations: 0,
    violation_severity_counts: { low: 0, medium: 0, high: 0, critical: 0 },
    actions_taken: [],
    strikes: 0,
    risk_score: 0,
    is_muted: false,
    user_type: 'standard',
    last_violation_at: null,
    last_seen_at: new Date().toISOString()
  };
}
```

**Step 3: Update user behavior on CURRENT platform (lines ~130-150)**

```javascript
// After determining shield action, update behavior for CURRENT platform only
async updateUserBehaviorForPlatform(organizationId, userId, platform, actions, severity) {
  const updates = {
    total_violations: /* increment by 1 */,
    violation_severity_counts: /* increment severity count */,
    actions_taken: /* append new action */,
    last_violation_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Update or insert for current platform
  await this.supabase
    .from('user_behavior')
    .upsert({
      organization_id: organizationId,
      platform_user_id: userId,
      platform: platform,  // Update ONLY current platform
      ...updates
    }, {
      onConflict: 'organization_id,platform_user_id,platform'
    });
}
```

### Validation Criteria

- [ ] Query all platforms for same user_id
- [ ] Aggregate `total_violations` across platforms
- [ ] Aggregate `violation_severity_counts` across platforms
- [ ] Take maximum `strikes` and `risk_score`
- [ ] User muted on ANY platform = `is_muted: true`
- [ ] Test 7 passes: `expect(result.userBehavior.total_violations).toBe(3);`

---

## Test 8: Platform-Specific Policies

**Location:** `shield-escalation-logic.test.js:502-554`
**Status:** ❌ FAILING
**Complexity:** HIGH
**Estimated Effort:** 4-5 hours

### Current Failure

```javascript
// Test expects different actions for twitter (aggressive) vs instagram (lenient)
if (platform.escalationPolicy === 'aggressive') {
  expect(['mute_permanent', 'block']).toContain(result.actions.primary);
  // ❌ Received: 'mute_temp' (same for all platforms)
}
```

### Business Logic Required

**Platform-specific policies:** Different platforms have different moderation standards. Shield should apply platform-specific escalation policies:

- **Twitter:** Aggressive (fast escalation to block/report)
- **Instagram:** Lenient (more warnings before harsh actions)
- **YouTube:** Moderate (balanced approach)

**Rationale:** Twitter is public and fast-paced (stricter moderation needed), Instagram is more personal (lenient), YouTube videos have longer lifespan (moderate)

### Test Setup

```javascript
const platforms = [
  { name: 'twitter', escalationPolicy: 'aggressive', expectedActions: ['mute_permanent', 'block'] },
  { name: 'instagram', escalationPolicy: 'lenient', expectedActions: ['warn', 'mute_temp'] },
  {
    name: 'youtube',
    escalationPolicy: 'moderate',
    expectedActions: ['mute_temp', 'mute_permanent']
  }
];

const comment = createTestComment({
  platform: platform.name,
  user_id: 'policy-test-user'
});
```

### Implementation Approach

**File:** `src/services/shieldService.js`

**Step 1: Add platform policy configuration (lines ~80-110)**

```javascript
constructor(supabase, options = {}) {
  // Existing config...

  // NEW: Platform-specific escalation policies
  this.platformPolicies = {
    twitter: {
      policy: 'aggressive',
      multiplier: 1.5,  // Escalate 50% faster
      actionOverrides: {
        'mute_temp': 'mute_permanent',  // Skip temp mutes
        'mute_permanent': 'block'       // Skip permanent mutes
      }
    },
    instagram: {
      policy: 'lenient',
      multiplier: 0.7,  // Escalate 30% slower
      actionOverrides: {
        'mute_permanent': 'mute_temp',  // More warnings
        'block': 'mute_permanent'       // Avoid blocks
      }
    },
    youtube: {
      policy: 'moderate',
      multiplier: 1.0,  // Standard escalation
      actionOverrides: {}
    },
    facebook: {
      policy: 'moderate',
      multiplier: 1.0,
      actionOverrides: {}
    },
    discord: {
      policy: 'aggressive',  // Discord moderation is strict
      multiplier: 1.3,
      actionOverrides: {
        'warn': 'mute_temp'
      }
    },
    twitch: {
      policy: 'moderate',
      multiplier: 1.0,
      actionOverrides: {}
    },
    reddit: {
      policy: 'lenient',  // Reddit culture is more tolerant
      multiplier: 0.8,
      actionOverrides: {}
    },
    tiktok: {
      policy: 'aggressive',  // TikTok is strict on content
      multiplier: 1.4,
      actionOverrides: {}
    },
    bluesky: {
      policy: 'lenient',  // New platform, community-driven
      multiplier: 0.9,
      actionOverrides: {}
    }
  };
}
```

**Step 2: Apply platform policy in action determination (lines ~280-310)**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  const { severity_level } = analysisResult;
  const violationCount = userBehavior.total_violations || 0;
  const platform = comment.platform || 'twitter';

  // Calculate total violations
  const totalViolations = violationCount + 1;

  // Determine base offense level
  let offenseLevel = 'first';
  if (totalViolations >= this.options.reincidenceThreshold) {
    offenseLevel = 'persistent';
  } else if (totalViolations > 1) {
    offenseLevel = 'repeat';
  }

  // Get base action from matrix
  let primaryAction = this.actionMatrix[severity_level][offenseLevel];

  // NEW: Apply platform-specific policy override
  primaryAction = this.applyPlatformPolicy(primaryAction, platform, offenseLevel);

  // Rest of method...

  return {
    primary: primaryAction,
    platform_policy: this.platformPolicies[platform]?.policy || 'moderate',
    // ...
  };
}
```

**Step 3: Add platform policy applicator (lines ~480-520)**

```javascript
/**
 * Apply platform-specific escalation policy
 * Issue #482: Different platforms have different moderation standards
 *
 * @param {string} baseAction - Action from standard matrix
 * @param {string} platform - Platform name
 * @param {string} offenseLevel - Current offense level
 * @returns {string} Modified action based on platform policy
 */
applyPlatformPolicy(baseAction, platform, offenseLevel) {
  const policy = this.platformPolicies[platform];

  if (!policy) {
    // Unknown platform, use default action
    return baseAction;
  }

  // Check for explicit action override
  if (policy.actionOverrides[baseAction]) {
    return policy.actionOverrides[baseAction];
  }

  // Apply policy multiplier to offense level
  if (policy.policy === 'aggressive' && offenseLevel === 'repeat') {
    // Aggressive platforms: treat 'repeat' as 'persistent'
    const aggressiveMatrix = {
      low: 'mute_permanent',
      medium: 'block',
      high: 'report'
    };
    return aggressiveMatrix[this.getCurrentSeverity()];
  } else if (policy.policy === 'lenient' && offenseLevel === 'persistent') {
    // Lenient platforms: treat 'persistent' as 'repeat'
    const lenientMatrix = {
      low: 'mute_temp',
      medium: 'mute_permanent',
      high: 'block'
    };
    return lenientMatrix[this.getCurrentSeverity()];
  }

  // Default: return base action
  return baseAction;
}
```

### Validation Criteria

- [ ] Twitter (aggressive): Faster escalation (mute_permanent, block)
- [ ] Instagram (lenient): Slower escalation (warn, mute_temp)
- [ ] YouTube (moderate): Standard escalation (mute_temp, mute_permanent)
- [ ] Platform policy included in result: `result.platform_policy`
- [ ] Test 8 passes: All 3 platform scenarios validated

---

## Test 10: Special User Type Handling

**Location:** `shield-escalation-logic.test.js:622-667`
**Status:** ❌ FAILING (mock factory conversion done, logic not implemented)
**Complexity:** MEDIUM
**Estimated Effort:** 2-3 hours

### Current Failure

```javascript
// Test expects lenient escalation for verified_creator
expect(['warn', 'mute_temp']).toContain(result.actions.primary);
// ❌ Received: 'mute_permanent'

expect(result.actions.manual_review_required).toBe(true);
// ❌ Received: undefined
```

### Business Logic Required

**Special user types:** Verified creators, partners, and other special users should receive LENIENT escalation and require MANUAL REVIEW before harsh actions (block/report).

**Rationale:** False positives for high-value users are costly. Better to review manually than auto-block verified creators.

**User Types:**

- `verified_creator` - Lenient escalation, manual review required
- `partner` - Lenient escalation, manual review required
- `standard` - Normal escalation (default)
- `trusted` - Very lenient escalation
- `flagged` - Aggressive escalation (previously problematic users)

### Test Setup (Already Converted)

```javascript
const userBehavior = createUserBehaviorData({
  userId: 'verified-creator-123',
  organizationId: 'org_123',
  platform: 'youtube',
  username: 'verifiedcreator',
  violationCount: 1,
  userType: 'verified_creator', // ✅ Field preserved correctly
  actionsTaken: [{ action: 'warn', date: '2024-09-01' }]
});
mockSupabase._mockData.userBehavior.push(userBehavior);
```

### Implementation Approach

**File:** `src/services/shieldService.js`

**Step 1: Add user type escalation modifiers (lines ~110-130)**

```javascript
constructor(supabase, options = {}) {
  // Existing config...

  // NEW: User type escalation modifiers
  this.userTypeModifiers = {
    standard: {
      escalationMultiplier: 1.0,
      requiresManualReview: false,
      maxAutoAction: 'report'  // No limit
    },
    verified_creator: {
      escalationMultiplier: 0.5,  // 50% slower escalation
      requiresManualReview: true,
      maxAutoAction: 'mute_temp'  // Never auto-block/report
    },
    partner: {
      escalationMultiplier: 0.6,
      requiresManualReview: true,
      maxAutoAction: 'mute_permanent'
    },
    trusted: {
      escalationMultiplier: 0.3,  // Very lenient
      requiresManualReview: false,
      maxAutoAction: 'warn'
    },
    flagged: {
      escalationMultiplier: 1.5,  // Aggressive
      requiresManualReview: false,
      maxAutoAction: 'report'
    }
  };
}
```

**Step 2: Apply user type modifier in action determination (lines ~310-340)**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  const { severity_level } = analysisResult;
  const violationCount = userBehavior.total_violations || 0;
  const userType = userBehavior.user_type || 'standard';

  // Calculate total violations
  const totalViolations = violationCount + 1;

  // Get user type modifier
  const typeModifier = this.userTypeModifiers[userType] || this.userTypeModifiers.standard;

  // Determine base offense level
  let offenseLevel = 'first';
  const adjustedThreshold = Math.ceil(this.options.reincidenceThreshold * typeModifier.escalationMultiplier);

  if (totalViolations >= adjustedThreshold) {
    offenseLevel = 'persistent';
  } else if (totalViolations > 1) {
    offenseLevel = 'repeat';
  }

  // NEW: Apply user type modifier to offense level
  if (typeModifier.escalationMultiplier < 1.0 && offenseLevel === 'persistent') {
    // Lenient users: downgrade persistent to repeat
    offenseLevel = 'repeat';
  }

  // Get base action from matrix
  let primaryAction = this.actionMatrix[severity_level][offenseLevel];

  // NEW: Cap action at maxAutoAction for special users
  primaryAction = this.capActionForUserType(primaryAction, typeModifier);

  // Build action result
  return {
    primary: primaryAction,
    user_type: userType,
    manual_review_required: typeModifier.requiresManualReview,
    // ...
  };
}
```

**Step 3: Add action capping method (lines ~520-560)**

```javascript
/**
 * Cap action severity for special user types
 * Issue #482: Verified creators/partners should never be auto-blocked
 *
 * @param {string} action - Proposed action
 * @param {Object} typeModifier - User type modifier config
 * @returns {string} Capped action (never exceeds maxAutoAction)
 */
capActionForUserType(action, typeModifier) {
  const actionSeverity = {
    'warn': 1,
    'mute_temp': 2,
    'mute_permanent': 3,
    'block': 4,
    'report': 5
  };

  const proposedSeverity = actionSeverity[action] || 1;
  const maxSeverity = actionSeverity[typeModifier.maxAutoAction] || 5;

  if (proposedSeverity > maxSeverity) {
    // Downgrade action to max allowed
    return typeModifier.maxAutoAction;
  }

  return action;
}
```

### Validation Criteria

- [ ] `verified_creator` gets lenient escalation (warn, mute_temp only)
- [ ] `verified_creator` sets `manual_review_required: true`
- [ ] `verified_creator` never gets auto-blocked or reported
- [ ] `standard` users get normal escalation (no changes)
- [ ] Test 10 passes: `expect(['warn', 'mute_temp']).toContain(result.actions.primary);`

---

## Test 13: Concurrent Violations

**Location:** `shield-escalation-logic.test.js:761-794`
**Status:** ❌ FAILING
**Complexity:** HIGH
**Estimated Effort:** 5-6 hours

### Current Failure

```javascript
// Test expects both concurrent violations to see same violation count
expect(result1.userBehavior.total_violations).toBe(2);
expect(result2.userBehavior.total_violations).toBe(2);
// ❌ Both return: 1 (race condition)
```

### Business Logic Required

**Concurrent violations:** When a user commits TWO violations simultaneously (e.g., posts two toxic comments at the same time), both Shield analyses should see the SAME updated violation count, not stale data.

**Rationale:** Race conditions can cause incorrect escalation decisions. If both violations see count=0, both escalate to 'first' offense when one should be 'repeat'.

### Test Setup

```javascript
const comment1 = createTestComment({
  id: 'concurrent_1',
  user_id: 'concurrent-user',
  platform: 'twitter',
  text: 'First toxic comment'
});

const comment2 = createTestComment({
  id: 'concurrent_2',
  user_id: 'concurrent-user',
  platform: 'twitter',
  text: 'Second toxic comment'
});

// Analyze both simultaneously
const [result1, result2] = await Promise.all([
  shieldService.analyzeForShield(comment1, metadata),
  shieldService.analyzeForShield(comment2, metadata)
]);
```

### Implementation Approach

**Option A: Optimistic Locking (Recommended)**

**File:** `src/services/shieldService.js`

**Step 1: Add retry logic with optimistic locking (lines ~150-190)**

```javascript
async analyzeForShield(comment, metadata, retryCount = 0) {
  const userId = comment.user_id;
  const platform = comment.platform;
  const organizationId = metadata.organizationId;

  const MAX_RETRIES = 3;

  try {
    // Get aggregated user behavior
    const userBehavior = await this.getAggregatedUserBehavior(
      organizationId,
      userId,
      platform
    );

    // Store original violation count for optimistic locking
    const originalViolationCount = userBehavior.total_violations || 0;

    // Determine shield actions
    const actions = await this.determineShieldActions(
      comment.analysis,
      userBehavior,
      comment
    );

    // Update user behavior with optimistic lock check
    const updateSuccess = await this.updateUserBehaviorWithLock(
      organizationId,
      userId,
      platform,
      actions,
      originalViolationCount  // Check that count hasn't changed
    );

    if (!updateSuccess && retryCount < MAX_RETRIES) {
      // Concurrent update detected, retry
      this.logger.warn('[ShieldService] Concurrent update detected, retrying', {
        userId,
        retryCount
      });

      // Exponential backoff
      await this.sleep(100 * Math.pow(2, retryCount));

      return this.analyzeForShield(comment, metadata, retryCount + 1);
    }

    if (!updateSuccess) {
      this.logger.error('[ShieldService] Failed to update after max retries', {
        userId,
        maxRetries: MAX_RETRIES
      });
    }

    // Return updated behavior
    return {
      actions,
      userBehavior: {
        ...userBehavior,
        total_violations: originalViolationCount + 1
      }
    };

  } catch (error) {
    this.logger.error('[ShieldService] Error in analyzeForShield', { error });
    throw error;
  }
}

/**
 * Sleep helper for exponential backoff
 */
sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Step 2: Add optimistic lock update method (lines ~560-620)**

```javascript
/**
 * Update user behavior with optimistic locking
 * Issue #482: Prevent race conditions during concurrent violations
 *
 * @param {string} organizationId
 * @param {string} userId
 * @param {string} platform
 * @param {Object} actions - Shield actions to record
 * @param {number} expectedViolationCount - Original count (for lock check)
 * @returns {boolean} True if update succeeded, false if concurrent update detected
 */
async updateUserBehaviorWithLock(organizationId, userId, platform, actions, expectedViolationCount) {
  const newViolationCount = expectedViolationCount + 1;

  // Build update object
  const updates = {
    total_violations: newViolationCount,
    violation_severity_counts: {
      // Increment severity count
    },
    actions_taken: [
      // Append new action
    ],
    last_violation_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Upsert with WHERE clause checking original count (optimistic lock)
  const { data, error } = await this.supabase
    .from('user_behavior')
    .update(updates)
    .eq('organization_id', organizationId)
    .eq('platform_user_id', userId)
    .eq('platform', platform)
    .eq('total_violations', expectedViolationCount)  // ✅ Optimistic lock check
    .select();

  if (error) {
    this.logger.error('[ShieldService] Error updating user behavior', { error });
    return false;
  }

  if (!data || data.length === 0) {
    // No rows updated = concurrent modification detected
    this.logger.warn('[ShieldService] Optimistic lock failed - concurrent update', {
      userId,
      expectedCount: expectedViolationCount
    });
    return false;
  }

  return true;
}
```

**Option B: Database Transaction (Alternative)**

If Supabase supports transactions in your version:

```javascript
async updateUserBehaviorAtomic(organizationId, userId, platform, actions) {
  // Use Supabase transaction or stored procedure
  const { data, error } = await this.supabase
    .rpc('atomic_update_user_behavior', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_platform: platform,
      p_severity: actions.severity,
      p_action: actions.primary
    });

  // Stored procedure handles atomic increment + return
  return data;
}
```

### Validation Criteria

- [ ] Two simultaneous violations both see updated count (no race condition)
- [ ] Retry logic works (max 3 retries with exponential backoff)
- [ ] Optimistic locking detects concurrent updates
- [ ] Test 13 passes: Both `result1` and `result2` have `total_violations: 2`

---

## Implementation Order (Recommended)

### Phase 1: Foundation Features (6-8 hours)

1. **Test 10** - Special user types (2-3 hours) - MEDIUM complexity, no dependencies
2. **Test 5** - Cooling-off period (2-3 hours) - MEDIUM complexity, no dependencies

### Phase 2: Time-Based Features (3-4 hours)

3. **Test 6** - Time window escalation (3-4 hours) - MEDIUM complexity, depends on Test 5 cooling-off logic

### Phase 3: Advanced Features (8-10 hours)

4. **Test 7** - Cross-platform aggregation (4-5 hours) - HIGH complexity, major refactor
5. **Test 8** - Platform-specific policies (4-5 hours) - HIGH complexity, config management

### Phase 4: Concurrency (5-6 hours)

6. **Test 13** - Concurrent violations (5-6 hours) - HIGH complexity, requires database transaction support

**Total Estimated Effort:** 22-28 hours

---

## Testing Strategy

### Unit Testing

For each feature, add unit tests in `tests/unit/services/shieldService.test.js`:

```javascript
describe('ShieldService - Cooling-Off Period', () => {
  it('should escalate faster for violations during active mute', async () => {
    // Test cooling-off period logic in isolation
  });

  it('should NOT escalate for expired mutes', async () => {
    // Test boundary condition
  });
});
```

### Integration Testing

After implementing each feature, run full test suite:

```bash
npm test -- tests/integration/shield-escalation-logic.test.js

# Target progression:
# After Test 10: 10/15 passing (67%)
# After Test 5: 11/15 passing (73%)
# After Test 6: 12/15 passing (80%)
# After Test 7: 13/15 passing (87%)
# After Test 8: 14/15 passing (93%)
# After Test 13: 15/15 passing (100%) ✅
```

### Manual Testing

For each feature, manually test with real Shield service:

1. Start dev server: `npm run dev`
2. Create test comments with various scenarios
3. Verify Shield actions in database
4. Check logs for proper execution

---

## Rollback Plan

If a feature breaks production behavior:

1. **Immediate:** Revert commit with feature
2. **Short-term:** Disable feature via feature flag
3. **Long-term:** Fix implementation, add more tests, re-deploy

**Feature Flags (Add to ShieldService constructor):**

```javascript
constructor(supabase, options = {}) {
  this.features = {
    coolingOffPeriod: options.enableCoolingOff ?? true,
    timeWindowEscalation: options.enableTimeWindows ?? true,
    crossPlatformAggregation: options.enableCrossPlatform ?? true,
    platformPolicies: options.enablePlatformPolicies ?? true,
    specialUserTypes: options.enableSpecialUsers ?? true,
    concurrentViolations: options.enableConcurrency ?? true
  };
}
```

---

## Success Criteria

**For 15/15 tests passing (100%):**

- [ ] All 6 features implemented in production code
- [ ] No test-only hacks or shortcuts
- [ ] Full integration test suite passing
- [ ] Code reviewed and approved
- [ ] Documentation updated (Shield service README)
- [ ] GDD nodes updated (shield.md, escalation matrix)
- [ ] Performance benchmarks met (<100ms per Shield analysis)

**Quality Standards:**

- Clean, readable code
- Proper error handling
- Comprehensive logging
- Production-grade exception handling
- Database transaction safety (Test 13)

---

## Files to Modify

### Production Code

- `src/services/shieldService.js` - All features (estimated +500-700 lines)

### Test Infrastructure

- `tests/helpers/mockSupabaseFactory.js` - Add concurrent update simulation (Test 13)

### Tests

- `tests/integration/shield-escalation-logic.test.js` - No changes needed (tests already written correctly)
- `tests/unit/services/shieldService.test.js` - Add unit tests for new methods

### Documentation

- `docs/nodes/shield.md` - Update escalation logic, add new features
- `docs/test-evidence/issue-482-final-results.md` - Document 15/15 passing
- `README.md` - Update Shield service capabilities

---

## Next Session Checklist

**Before starting implementation:**

- [ ] Read this plan document completely
- [ ] Re-run tests to confirm current state (9/15 passing)
- [ ] Set up development environment (Shield service running)
- [ ] Create feature branch: `feat/shield-advanced-escalation-482`

**During implementation:**

- [ ] Follow implementation order (Tests 10, 5, 6, 7, 8, 13)
- [ ] Commit after each test fix (atomic commits)
- [ ] Run full test suite after each commit
- [ ] Update this plan with actual time spent vs. estimates

**After completion:**

- [ ] Verify 15/15 tests passing
- [ ] Run full test suite multiple times (ensure stability)
- [ ] Create PR with comprehensive summary
- [ ] Update GDD nodes with new Shield capabilities
- [ ] Generate test evidence report

---

## Risks and Mitigation

### Risk 1: Cross-platform aggregation breaks existing behavior

**Mitigation:** Add feature flag, gradual rollout per organization

### Risk 2: Concurrent violation handling causes deadlocks

**Mitigation:** Use exponential backoff, max 3 retries, fallback to single update

### Risk 3: Platform policies conflict with organization configs

**Mitigation:** Organization config takes precedence, document override rules

### Risk 4: Time estimates too optimistic

**Mitigation:** Focus on Tests 10, 5, 6 first (11/15 = 73%), defer complex features if needed

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Status:** ACTIVE - Ready for implementation
**Next Review:** After completing Phase 1 (Tests 10 + 5)
