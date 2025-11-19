# Shield - Automated Content Moderation System

**Node ID:** `shield`
**Owner:** Back-end Dev
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-11-17
**Coverage:** 86%
**Coverage Source:** auto
**Note:** Coverage value updated to match actual test coverage (gdd-status.json validation). Will be auto-updated when tests pass.
**Related PRs:** #499, #587 (Issue #487 - Flow Validation Complete), #617 (Flow Validation Dashboard + Validation Script), #632 (Unified Analysis Department), #634 (CodeRabbit Security Fix - Conservative Gatekeeper Fallback), #865 (Issue #859 - Brand Safety for Sponsors)

## Dependencies

- `cost-control` - Usage tracking, billing integration, and limit enforcement
- `queue-system` - Unified Redis/Upstash + Database queue management

## Overview

Shield is the automated content moderation system for Roastr.ai that provides advanced toxicity protection through escalating response actions, user behavior tracking, and reincidence detection. It operates as a high-priority system that can automatically mute, block, or report toxic users based on configurable thresholds and offender history.

### Key Capabilities

1. **Automated Moderation** - Intelligent action escalation based on toxicity and user history
2. **Multi-Platform Support** - Platform-specific actions for Twitter, Discord, Twitch, YouTube, and more
3. **Recidivism Tracking** - Sophisticated offender history and risk level assessment
4. **Configurable Thresholds** - Database-driven settings with organization and platform-specific overrides
5. **Circuit Breaker Pattern** - Fault tolerance with automatic fallback strategies
6. **Red Lines System** - User-defined zero-tolerance rules for specific content

## Architecture

### Main Flow

```text
Comment Detected
    ↓
AnalyzeToxicityWorker
    ↓
Perspective API (Google)
    ↓ (toxicity_score, severity_level, categories, raw_scores)
Shield Service receives analysis
    ↓
ShieldDecisionEngine.makeDecision()
    ↓
[Load Settings] → Database settings with platform inheritance
    ↓
[Process Input] → Validate and normalize input data
    ↓
[Check Offender History] → Get recidivism data and risk level
    ↓
[Apply Decision Logic] → Severity-based decision tree
    ↓
    - Critical (severity='critical'): Immediate block + report
    - High (severity='high'): Auto-moderate + manual review
    - Medium (severity='medium'): Manual moderation (temp mute)
    - Low/Clean (severity='low'/'clean'): No action
    ↓
[Record Decision] → Persistence layer for audit trail
    ↓
[Queue Action] → ShieldActionWorker (priority 1)
    ↓
[Execute Action] → Platform-specific API calls with retry logic
    ↓
[Update History] → Track action and update user behavior
```

### Perspective API Integration

**Integration Point:** `src/workers/AnalyzeToxicityWorker.js` → `src/services/shieldService.js`

Shield receives toxicity analysis from Perspective API via AnalyzeToxicityWorker:

```javascript
{
  toxicity_score: 0.88,           // TOXICITY score (0-1)
  severity_level: 'high',          // Perspective's calculated severity
  categories: ['insult'],          // Detected categories
  raw_scores: {
    toxicity: 0.88,
    severeToxicity: 0.60,
    identityAttack: 0.44,
    insult: 0.616,
    profanity: 0.528,
    threat: 0.40
  }
}
```

**Severity Mapping (Perspective → Shield):**

| Perspective Severity | Shield Priority | Shield Action | Auto Execute | Manual Review |
|---------------------|-----------------|---------------|--------------|---------------|
| `critical` (≥0.95)  | 1 (critical)    | block + report | YES          | NO            |
| `high` (≥0.85)      | 2 (high)        | mute_permanent | YES          | YES           |
| `medium` (≥0.60)    | 3 (medium)      | mute_temp      | NO           | NO            |
| `low` (≥0.40)       | 5 (low)         | warn           | NO           | NO            |
| `clean` (<0.40)     | 5 (low)         | warn           | NO           | NO            |

**Important:** Shield uses Perspective's `severity_level` directly (not toxicity_score) for priority calculation. This ensures Perspective's multi-factor analysis (considering severeToxicity, threat, multiple thresholds) drives Shield decisions.

**Validation:** See `docs/test-evidence/perspective-shield-validation.md` for integration test results.

### Fallback Security Policy (CodeRabbit Review #634)

**Critical Security Enhancement:** Conservative fallback when security services unavailable.

**Issue:** When Gatekeeper service fails, the system must default to a secure state rather than allowing potentially malicious content through.

**Conservative Fallback Strategy:**

When Gatekeeper service is unavailable (timeout, API error, service outage):

```javascript
// SECURITY FIX (CodeRabbit Review #634)
return {
  classification: 'MALICIOUS',     // Conservative default
  is_prompt_injection: true,       // Treat as potential threat
  injection_score: 0.5,            // Moderate risk indicator
  injection_categories: ['fallback_mode'],
  fallback: true,
  fallback_reason: 'Gatekeeper unavailable - conservative classification applied'
};
```

**Decision Matrix Integration:**

The Analysis Department's decision matrix includes explicit fallback detection as **RULE 0** (highest priority):

```text
RULE 0: Gatekeeper Fallback Mode → SHIELD
    ↓
Condition: fallback=true AND fallback_reason present
    ↓
Action: Force SHIELD regardless of toxicity scores
Action Tags: ['hide_comment', 'require_manual_review', 'gatekeeper_unavailable']
Severity: critical
```

**Rationale:**
- **Fail-safe principle**: When security service unavailable, block rather than allow
- **Security over convenience**: False positives (blocked clean comments) < False negatives (published injections)
- **Manual review required**: All fallback-mode comments flagged for human oversight
- **Monitoring**: Track `gatekeeper_unavailable` action tag to detect service issues

**Fallback Action Tags:**
- `hide_comment` - Hide potentially malicious comment from public view
- `require_manual_review` - Queue for human moderator review
- `gatekeeper_unavailable` - Service availability flag for monitoring

**Monitoring Recommendations:**
- Alert if `gatekeeper_unavailable` appears in >5% of comments (indicates service issue)
- Track Gatekeeper service SLA and uptime
- Dashboard for fallback frequency by time period

**Implementation:** `src/services/AnalysisDecisionEngine.js:103-121` (fallback classification), `lines 265-284` (fallback detection in decision matrix)

**Test Coverage:** `tests/integration/analysis-department.test.js` - Edge 2, Edge 7, Edge 8 validate fallback behavior

### Component Files

| File | Path | Purpose |
|------|------|---------|
| **ShieldService** | `src/services/shieldService.js` | Legacy service, main orchestrator |
| **ShieldDecisionEngine** | `src/services/shieldDecisionEngine.js` | Core decision-making component |
| **ShieldActionExecutor** | `src/services/shieldActionExecutor.js` | Unified action execution with circuit breaker |
| **ShieldPersistenceService** | `src/services/shieldPersistenceService.js` | Database persistence and history tracking |
| **ShieldSettingsService** | `src/services/shieldSettingsService.js` | Settings management with inheritance |
| **ShieldActionWorker** | `src/workers/ShieldActionWorker.js` | Background worker for action execution |

## Shield Decision Engine

**Core Component:** `src/services/shieldDecisionEngine.js`
**Version:** 1.0

### Decision Thresholds

#### Default Thresholds (Toxicity Score Range: 0-1)

| Threshold | Score | Action |
|-----------|-------|--------|
| **Critical** | ≥0.98 | Immediate severe action (block, report, escalate) |
| **High** | ≥0.95 | Moderate Shield action (timeout, hide comment, warn) |
| **Moderate** | ≥0.90 | Roastable comment (generate roast, monitor user) |
| **Corrective** | ≥0.85 | First strike with corrective guidance message |
| **Normal** | <0.85 | Publish normally (no action) |

#### Database-Driven Thresholds

Thresholds can be configured per organization and platform in `organization_shield_settings`:

```sql
-- Organization-level settings (inherited by all platforms)
tau_roast_lower: 0.25    -- Minimum roastable threshold
tau_shield: 0.70         -- Shield activation threshold
tau_critical: 0.90       -- Critical action threshold

-- Platform-specific overrides (optional)
-- Example: More lenient for Discord, stricter for Twitter
```

**Threshold Calculation:**
```javascript
moderate = tau_roast_lower + ((tau_shield - tau_roast_lower) * 0.6)
high = tau_shield
critical = tau_critical
corrective = tau_roast_lower
```

### Recidivism Adjustment

Shield adjusts toxicity scores upward for repeat offenders:

```javascript
// Base adjustment: 0.02 per offense (max 0.08)
adjustment = min(0.08, totalOffenses * 0.02)

// Additional for escalation level
adjustment += escalationLevel * 0.01

// Bonus for high average toxicity (≥0.8)
if (avgToxicity >= 0.8) adjustment += 0.03

// Total cap: 0.12 maximum adjustment
finalScore = min(1.0, toxicityScore + adjustment)
```

**Example:**
- User has 5 prior offenses, escalation level 3, average toxicity 0.82
- New comment toxicity: 0.88
- Adjustment: (5 * 0.02) + (3 * 0.01) + 0.03 = 0.23 (capped at 0.12)
- Final score: 0.88 + 0.12 = 1.0 → Critical action

### Escalation Levels

| Level | Offenses | Description |
|-------|----------|-------------|
| 0 | 0-1 | First time or isolated offense |
| 1 | 2 | Early repeat offender |
| 2 | 3-4 | Multiple violations |
| 3 | 5-6 | Persistent offender |
| 4 | 7-9 | Habitual violator |
| 5 | 10+ | Critical repeat offender |

### Red Lines System

User-defined zero-tolerance rules that override all thresholds:

#### Category Red Lines

```javascript
userRedLines.categories = ['threat', 'harassment', 'hate']
// Any comment with these labels → immediate critical action
```

#### Keyword Red Lines

```javascript
userRedLines.keywords = ['palabra prohibida', 'otro término']
// Exact word boundary matching with special char support
// Case-insensitive, supports regex escaping
```

#### Threshold Red Lines

```javascript
userRedLines.toxicityThreshold = 0.60
// Any comment ≥0.60 → immediate critical action
// Overrides default thresholds
```

**Red Line Violation Result:**
```javascript
{
  action: 'shield_action_critical',
  reason: 'User red line violated: keyword:palabra',
  severity: 'critical',
  requiresHumanReview: true,
  autoExecute: !autoApprove,
  metadata: { redLineViolation: 'keyword:palabra', userDefined: true }
}
```

### Corrective Zone (First Strike)

For toxicity scores ≥0.85 and <0.90 (first-time offenders):

**Corrective Message Pools:**

```javascript
general: [
  "Parece que necesitas un momento para reflexionar...",
  "Tu comentario podría beneficiarse de un enfoque más respetuoso...",
  "Detectamos que tu mensaje puede resultar ofensivo..."
]

insult: [
  "Los insultos no fortalecen tu argumento...",
  "Entendemos que puedes estar frustrado, pero...",
  "Tu opinión es válida, pero sería más efectiva sin..."
]

harassment: [
  "Este tipo de comentarios puede hacer sentir incómodos...",
  "Valoramos la diversidad de opiniones, pero el respeto...",
  "Tu participación es importante, pero necesitamos..."
]

threat: [
  "Los comentarios amenazantes no están permitidos...",
  "Detectamos lenguaje que puede interpretarse como...",
  "Nuestra comunidad se basa en el respeto mutuo..."
]
```

**Selection Logic:**
- Primary category determines message pool
- Repeat offenders (≥2 offenses) get harassment pool (firmer tone)
- Random selection from pool for variety
- Fallback: Generic respectful message if pool empty

### Decision Output

```javascript
{
  action: 'shield_action_moderate',           // Decision action
  reason: 'High toxicity requiring moderation',
  severity: 'high',                           // critical, high, moderate, low, none
  toxicityScore: 0.96,                        // Adjusted score (with recidivism)
  primaryCategory: 'insult',                  // Top toxicity category
  escalationLevel: 2,                         // Current escalation level
  requiresHumanReview: false,                 // Flag for manual review
  autoExecute: true,                          // Auto-execute or queue for approval
  suggestedActions: [                         // Platform actions to take
    'timeout_user',
    'hide_comment',
    'warn_user'
  ],
  correctiveMessage: null,                    // Only for corrective zone
  timestamp: '2025-10-03T12:00:00Z',
  version: '1.0',
  processingTimeMs: 45,
  metadata: {
    originalScore: 0.88,                      // Pre-adjustment score
    escalationAdjustment: 0.08,               // Recidivism adjustment
    isRepeatOffender: true,
    offenderHistory: {
      totalOffenses: 4,
      riskLevel: 'medium',
      escalationLevel: 2
    }
  }
}
```

## Platform-Specific Actions

Shield maps generic actions to platform-specific implementations:

### Action Mapping Matrix

| Generic Action | Twitter | Discord | Twitch | YouTube |
|---------------|---------|---------|--------|---------|
| **warn** | Reply warning | Send warning DM | 60s timeout | Reply warning |
| **mute_temp** | Mute 24h | Timeout 1h | Timeout 10m | ❌ Not available |
| **mute_permanent** | Mute permanent | Remove voice perms | Ban user | ❌ Limited access |
| **block** | Block user | Kick user | Ban user | ❌ Not available |
| **report** | Report user | Report to mods | Report to Twitch | Report comment |

### Platform Capabilities

#### Twitter/X
```javascript
{
  warn: { action: 'reply_warning', available: true },
  mute_temp: { action: 'mute_user', duration: '24h', available: true },
  mute_permanent: { action: 'mute_user', duration: 'permanent', available: true },
  block: { action: 'block_user', available: true },
  report: { action: 'report_user', available: true }
}
```

#### Discord
```javascript
{
  warn: { action: 'send_warning_dm', available: true },
  mute_temp: { action: 'timeout_user', duration: '1h', available: true },
  mute_permanent: { action: 'remove_voice_permissions', available: true },
  block: { action: 'kick_user', available: true },
  report: { action: 'report_to_moderators', available: true }
}
```

#### Twitch
```javascript
{
  warn: { action: 'timeout_user', duration: '60s', available: true },
  mute_temp: { action: 'timeout_user', duration: '10m', available: true },
  mute_permanent: { action: 'ban_user', available: true },
  block: { action: 'ban_user', available: true },
  report: { action: 'report_to_twitch', available: true }
}
```

#### YouTube
```javascript
{
  warn: { action: 'reply_warning', available: true },
  mute_temp: { action: 'hide_user_comments', duration: '24h', available: false },
  mute_permanent: { action: 'ban_user_from_channel', available: false },
  block: { action: 'block_user', available: false },
  report: { action: 'report_comment', available: true }
}
```

### Action Execution Flow

```text
Decision Made → Queue shield_action job (priority 1)
    ↓
ShieldActionWorker picks up job
    ↓
ShieldActionExecutor.executeAction()
    ↓
[Get Platform Adapter] → Twitter/Discord/Twitch/YouTube adapter
    ↓
[Circuit Breaker Check] → Is platform healthy?
    ↓
[Execute with Retry] → 3 attempts, exponential backoff
    ↓
Success? → Record event, update history ✅
    ↓
Failure? → Try fallback action or manual review queue ⚠️
```

## Offender History & Persistence

**Service:** `src/services/shieldPersistenceService.js`
**Table:** `shield_offender_history`

### Offender History Structure

```javascript
{
  id: 'uuid',
  organization_id: 'org_uuid',
  platform: 'twitter',
  external_author_id: 'twitter_user_123',
  external_author_username: '@toxicuser',

  // Violation tracking
  total_offenses: 5,
  total_critical: 2,
  total_high: 2,
  total_moderate: 1,
  total_low: 0,

  // Toxicity metrics
  average_toxicity: 0.87,
  max_toxicity: 0.96,

  // Escalation
  escalation_level: 2,
  is_recidivist: true,
  risk_level: 'medium',  // low, medium, high

  // Recent actions
  recent_actions_summary: {
    warn: 1,
    mute_temp: 2,
    mute_permanent: 1,
    block: 1
  },

  // Timeline
  first_offense_at: '2025-09-15T10:00:00Z',
  last_offense_at: '2025-10-03T12:00:00Z',
  last_action: 'mute_permanent',
  last_action_at: '2025-10-03T12:00:00Z',

  // Metadata
  metadata: {
    primaryCategories: ['insult', 'profanity', 'harassment'],
    platformSpecificData: { /* platform context */ }
  },

  created_at: '2025-09-15T10:00:00Z',
  updated_at: '2025-10-03T12:00:00Z'
}
```

### Shield Events Log

**Table:** `shield_events`

```javascript
{
  id: 'uuid',
  organization_id: 'org_uuid',
  user_id: 'user_uuid',

  // Comment context
  platform: 'twitter',
  account_ref: 'account_ref_uuid',
  external_comment_id: 'tweet_123',
  external_author_id: 'twitter_user_123',
  external_author_username: '@toxicuser',
  original_text: 'toxic comment text',  // Only for shield actions (GDPR)

  // Toxicity analysis
  toxicity_score: 0.96,
  toxicity_labels: ['insult', 'profanity'],

  // Decision
  action_taken: 'shield_action_moderate',
  action_reason: 'High toxicity requiring moderation',
  action_status: 'completed',  // pending, completed, failed, manual_review
  action_details: {
    severity: 'high',
    escalationLevel: 2,
    suggestedActions: ['timeout_user', 'hide_comment'],
    requiresHumanReview: false
  },

  // Execution
  processed_by: 'shield_decision_engine',
  processing_time_ms: 45,

  // Metadata
  metadata: {
    decisionVersion: '1.0',
    offenderHistory: {
      isRecidivist: true,
      totalOffenses: 4,
      riskLevel: 'medium'
    },
    circuitBreakerStatus: 'closed',
    fallbackUsed: false
  },

  created_at: '2025-10-03T12:00:00Z',
  updated_at: '2025-10-03T12:00:05Z'
}
```

## Circuit Breaker & Fault Tolerance

**Service:** `src/services/shieldActionExecutor.js`
**Pattern:** Circuit Breaker with exponential backoff

### Circuit Breaker States

| State | Description | Behavior |
|-------|-------------|----------|
| **CLOSED** | Normal operation | Requests pass through normally |
| **OPEN** | Too many failures | Requests fail fast, no API calls |
| **HALF_OPEN** | Testing recovery | Limited requests to test platform health |

### Configuration

```javascript
{
  maxRetries: 3,                 // Max retry attempts
  baseDelay: 500,                // Base delay in ms
  maxDelay: 30000,               // Max delay (30s)
  failureThreshold: 5,           // Failures to open circuit
  recoveryTimeout: 60000         // Time before half-open (60s)
}
```

### Retry Logic

```javascript
// Exponential backoff with jitter
delay = min(maxDelay, baseDelay * 2^attempt + random(0, 1000))

// Example retry delays:
// Attempt 1: 500ms + jitter
// Attempt 2: 1000ms + jitter
// Attempt 3: 2000ms + jitter
```

### Fallback Strategies

When primary action fails or circuit is open:

1. **Fallback Actions:**
   - `blockUser` fails → Try `reportUser`
   - `hideComment` fails → Try `reportUser`
   - `reportUser` fails → Queue for manual review

2. **Manual Review Queue:**
   ```javascript
   {
     requiresManualReview: true,
     reason: 'All automated actions failed',
     originalAction: 'blockUser',
     attemptedFallbacks: ['reportUser'],
     platformError: 'Twitter API rate limit exceeded'
   }
   ```

3. **Circuit Breaker Open:**
   - All requests fail fast (no API calls)
   - Queued for manual review
   - Logged for monitoring

## Shield Settings & Configuration

**Service:** `src/services/shieldSettingsService.js`
**Table:** `organization_shield_settings`

### Settings Inheritance Model

```text
Global Defaults
    ↓
Organization Settings (org-level)
    ↓
Platform-Specific Overrides (org + platform)
```

**Example:**
```sql
-- Organization default
INSERT INTO organization_shield_settings (
  organization_id,
  platform,  -- NULL = applies to all platforms
  shield_enabled,
  tau_roast_lower,
  tau_shield,
  tau_critical,
  aggressiveness
) VALUES (
  'org_123',
  NULL,
  true,
  0.25,
  0.70,
  0.90,
  0.95
);

-- Twitter-specific override (stricter)
INSERT INTO organization_shield_settings (
  organization_id,
  platform,
  tau_shield  -- Only override shield threshold
) VALUES (
  'org_123',
  'twitter',
  0.60  -- More aggressive on Twitter
);
```

**Effective Settings for Twitter:**
```javascript
{
  shield_enabled: true,          // From org default
  tau_roast_lower: 0.25,         // From org default
  tau_shield: 0.60,              // From Twitter override
  tau_critical: 0.90,            // From org default
  aggressiveness: 0.95,          // From org default
  source: 'platform_override'    // Inheritance source
}
```

### User Aggressiveness (Legacy)

For backward compatibility, user aggressiveness (0.90 - 1.00) adjusts thresholds:

```javascript
// aggressiveness = 0.90 → more lenient (higher thresholds)
// aggressiveness = 0.95 → baseline (no adjustment)
// aggressiveness = 1.00 → stricter (lower thresholds)

adjustment = (0.95 - aggressiveness) * 0.2  // Range: -0.1 to +0.01

adjusted_thresholds = {
  critical: base.critical + adjustment,
  high: base.high + adjustment,
  moderate: base.moderate + adjustment,
  corrective: base.corrective + adjustment
}
```

## Worker Architecture

**Worker:** `src/workers/ShieldActionWorker.js`
**Queue:** `shield_action`
**Priority:** 1 (highest)

### Worker Configuration

```javascript
{
  maxConcurrency: 3,     // 3 concurrent Shield actions
  pollInterval: 2000,    // Poll every 2 seconds
  maxRetries: 1,         // Let ShieldActionExecutor handle retries
  priority: 1            // Highest priority in queue
}
```

### Job Payload

```javascript
{
  organizationId: 'org_uuid',
  userId: 'user_uuid',               // Optional
  platform: 'twitter',
  accountRef: 'account_ref_uuid',
  externalCommentId: 'tweet_123',
  externalAuthorId: 'twitter_user_123',
  externalAuthorUsername: '@toxicuser',
  action: 'blockUser',               // hideComment, reportUser, blockUser, unblockUser
  reason: 'Shield automated action',
  originalText: 'toxic comment',     // Optional, for GDPR
  metadata: { /* additional context */ }
}
```

### Worker Metrics

```javascript
{
  totalProcessed: 156,
  successfulActions: 142,
  failedActions: 14,
  fallbackActions: 8,
  averageProcessingTime: 1250,  // ms
  lastActionTime: '2025-10-03T12:00:00Z',

  actionExecutor: {
    metrics: { /* executor metrics */ },
    circuitBreakers: { /* platform status */ },
    supportedPlatforms: ['twitter', 'discord', 'twitch', 'youtube']
  }
}
```

## Integration with Triage System

Shield integrates with the triage system for automated comment routing:

### Triage Flow Integration

```text
Comment Analyzed (toxicity_score)
    ↓
TriageService.processComment()
    ↓
[Check Plan] → Free: no Shield, Starter+: Shield enabled
    ↓
[Toxicity Threshold Check]
    ↓
    - ≥0.85: BLOCK + Shield analysis
    - 0.30-0.84: ROAST
    - <0.30: PUBLISH
    ↓
[Shield Analysis] (if Starter+ and ≥0.85)
    ↓
ShieldDecisionEngine.makeDecision()
    ↓
[Execute in Parallel]
    - Triage decision (block comment)
    - Shield action (block user, report, etc.)
```

**Key Points:**
- Shield runs **in parallel** with triage blocking
- Triage is fail-closed: Shield failure → comment still blocked
- Shield adds user-level actions beyond comment-level blocking

## Cost Control Integration

**Dependency:** `cost-control` node
**Integration:** Usage recording per action

### Usage Tracking

```javascript
await costControl.recordUsage(
  organizationId,
  platform,
  'shield_action',
  {
    action: 'blockUser',
    success: true,
    fallback: false,
    requiresManualReview: false,
    executionTime: 1250,
    platform: 'twitter',
    timestamp: '2025-10-03T12:00:00Z'
  },
  null,  // userId - not applicable for shield
  1      // quantity
);
```

### Plan Restrictions

| Plan | Shield Access | Features |
|------|---------------|----------|
| **Free** | ❌ Disabled | No Shield protection |
| **Starter** | ✅ Enabled | Basic Shield with standard thresholds |
| **Pro** | ✅ Enabled | Full Shield with custom thresholds |
| **Plus** | ✅ Enabled | Advanced Shield + red lines + priority actions |

## API Usage Examples

### Make a Shield Decision

```javascript
const ShieldDecisionEngine = require('./services/shieldDecisionEngine');

const decisionEngine = new ShieldDecisionEngine();

const decision = await decisionEngine.makeDecision({
  organizationId: 'org_123',
  userId: 'user_456',
  platform: 'twitter',
  accountRef: 'account_ref_789',
  externalCommentId: 'tweet_123',
  externalAuthorId: 'twitter_user_123',
  externalAuthorUsername: '@toxicuser',
  originalText: 'You are an idiot',
  toxicityAnalysis: {
    toxicity_score: 0.92,
    toxicity_labels: ['insult', 'profanity'],
    confidence: 0.95,
    model: 'perspective'
  },
  userConfiguration: {
    redLines: {
      categories: ['threat', 'harassment'],
      keywords: ['kill', 'die'],
      toxicityThreshold: 0.80
    },
    aggressiveness: 0.97,
    autoApprove: false
  },
  metadata: {
    commentSource: 'mentions',
    detectedLanguage: 'en'
  }
});

console.log(decision);
// {
//   action: 'shield_action_moderate',
//   reason: 'High toxicity requiring moderation',
//   severity: 'high',
//   toxicityScore: 0.96,  // Adjusted for recidivism
//   escalationLevel: 2,
//   suggestedActions: ['timeout_user', 'hide_comment', 'warn_user'],
//   ...
// }
```

### Execute Shield Action

```javascript
const ShieldActionExecutor = require('./services/shieldActionExecutor');

const executor = new ShieldActionExecutor({
  maxRetries: 3,
  baseDelay: 500,
  failureThreshold: 5
});

const result = await executor.executeAction({
  organizationId: 'org_123',
  platform: 'twitter',
  accountRef: 'account_ref_789',
  externalCommentId: 'tweet_123',
  externalAuthorId: 'twitter_user_123',
  externalAuthorUsername: '@toxicuser',
  action: 'blockUser',
  reason: 'High toxicity requiring moderation',
  metadata: {
    severity: 'high',
    escalationLevel: 2
  }
});

console.log(result);
// {
//   success: true,
//   platform: 'twitter',
//   action: 'block_user',
//   originalAction: 'blockUser',
//   fallback: false,
//   requiresManualReview: false,
//   executionTime: 1250,
//   details: {
//     platformResponse: { /* Twitter API response */ },
//     timestamp: '2025-10-03T12:00:00Z'
//   }
// }
```

### Get Offender History

```javascript
const ShieldPersistenceService = require('./services/shieldPersistenceService');

const persistence = new ShieldPersistenceService();

const history = await persistence.getOffenderHistory(
  'org_123',
  'twitter',
  'twitter_user_123'
);

console.log(history);
// {
//   isRecidivist: true,
//   totalOffenses: 5,
//   totalCritical: 2,
//   totalHigh: 2,
//   escalationLevel: 2,
//   averageToxicity: 0.87,
//   maxToxicity: 0.96,
//   riskLevel: 'medium',
//   recentActionsSummary: {
//     warn: 1,
//     mute_temp: 2,
//     mute_permanent: 1
//   },
//   lastOffenseAt: '2025-10-03T12:00:00Z',
//   ...
// }
```

## Testing

### Unit Tests

| Test File | Coverage | Focus |
|-----------|----------|-------|
| `shieldService.test.js` | 80% | Service initialization, analysis, action execution |
| `shieldDecisionEngine.test.js` | 90% | Decision logic, thresholds, recidivism, red lines |
| `shieldActionExecutor.test.js` | 85% | Circuit breaker, retry logic, fallback strategies |
| `shieldPersistenceService.test.js` | 88% | History tracking, event logging, database operations |
| `ShieldActionWorker.test.js` | 85% | Worker job processing, metrics, error handling |

### Integration Tests

**Comprehensive Coverage:** 15 integration test files with 200+ test cases validating all Shield functionality.

**Issue #408 Validation:** Complete integration test coverage for Shield actions and offender registration.

| Test File | Lines | Focus | Issue |
|-----------|-------|-------|-------|
| `shield-actions-integration.test.js` | 660 | Hide/block/report/escalate actions, NO roast generation | #408 AC1, AC3 |
| `shield-offender-registration.test.js` | 945 | Author tracking, severity, reason logging | #408 AC2 |
| `shield-escalation-logic.test.js` | 845 | Escalation matrix, time decay, cross-platform | #408 AC4 |
| `shieldDecisionEngine.integration.test.js` | 400 | Decision logic, thresholds, recidivism | #408 AC1, AC4 |
| `shieldPersistence.integration.test.js` | 350 | Database persistence, history tracking | #408 AC5 |
| `shieldActionExecutor.integration.test.js` | 300 | Circuit breaker, retries, fallback | #408 AC1 |
| `shield-system-e2e.test.js` | 500 | End-to-end Shield workflow | #408 ALL |
| `shield-triage-integration.test.js` | - | Shield + Triage parallel execution | - |
| `shield-platform-adapters.test.js` | - | Platform-specific action execution | - |
| `shield-ui-complete-integration.test.js` | - | UI integration with Shield | - |
| `shield-stability.test.js` | - | Stability and resilience testing | - |
| `shield-database-round4.test.js` | - | Database operations validation | - |

**Total Test Coverage:** ~4,000+ lines of integration tests

**Critical Validation (Issue #408 AC3):** 50+ explicit assertions that `shouldGenerateResponse === false` across all test files, ensuring **NO roast generation when Shield acts**.

**Test Evidence Report:** See `docs/test-evidence/shield-issue-408-evidence.md` for detailed validation.

### Flow Validation

**Issue #487 - Shield Automated Moderation Flow Validation:**

Complete end-to-end flow validation from toxic comment detection to automated action execution.

**Phase 2 - COMPLETE (100%):**
- ✅ **15/15 test cases passed** (100% success rate)
- ✅ **9/9 Decision Matrix** (100% coverage)
- ✅ **6/6 Edge Cases** (100% coverage)

**Validation Results:**
- **Test Cases:** 15/15 passed (100%) ✅
- **Performance:** 0.42s - 0.66s per test, avg 0.69s (target: <3s) ✅
- **Total Execution Time:** 10.35s (budget: 45s, 77% faster) ✅
- **Evidence:** `docs/test-evidence/flow-shield/VALIDATION.md` (v2.0)
- **Logs:**
  - Phase 1: `validation-run-20251020-162206.log` (3 tests)
  - Phase 2: `validation-run-phase2-complete.log` (15 tests)
- **UI Screenshots:** 6 screenshots (mobile/tablet/desktop)
  - Shield Settings: `/shield/settings`
  - Shield Validation Dashboard: `/shield/validation`

**Validated Components:**
- ✅ Shield activation (≥0.65 toxicity)
- ✅ Action determination (decision matrix complete)
- ✅ Offense level detection (first-time, repeat, high-risk)
- ✅ App logging
- ✅ Performance requirements
- ✅ Test data cleanup
- ✅ UI operational
- ✅ Platform API timeout handling (EDGE-01)
- ✅ Idempotency (EDGE-02)
- ✅ Queue priority (EDGE-03)
- ✅ DB failure handling (EDGE-04)
- ✅ Escalation threshold (EDGE-05)
- ✅ Multi-platform independence (EDGE-06)

**Coverage Status:**
- **Decision Matrix:** 9/9 scenarios (100%) ✅
- **Edge Cases:** 6/6 scenarios (100%) ✅
- **Worker Execution:** Deferred
- **Platform API Integration:** Deferred

**Approval Status:** ✅ **FULLY APPROVED FOR PRODUCTION**
- Complete test suite passing (15/15)
- All core functionality validated
- Edge case testing complete
- **Ready for production deployment**

### Test Utilities

```javascript
// Using Jest moduleNameMapper alias
const { createMockShieldConfig } = require('@tests/utils/sharedMocks');

const mockConfig = createMockShieldConfig({
  enabled: true,
  autoActions: true,
  reincidenceThreshold: 3
});
```

### Coverage Thresholds

```javascript
{
  "src/services/shieldService.js": {
    branches: 80, functions: 80, lines: 80, statements: 80
  },
  "src/services/shieldDecisionEngine.js": {
    branches: 90, functions: 90, lines: 90, statements: 90
  },
  "src/workers/ShieldActionWorker.js": {
    branches: 85, functions: 85, lines: 85, statements: 85
  }
}
```

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `ROASTR_SHIELD_ENABLED` | `true` | Enable Shield system globally |
| `SHIELD_AUTO_ACTIONS` | `true` | Enable automatic action execution |
| `SHIELD_SEVERITY_ESCALATION` | `true` | Enable escalation based on user history |
| `SHIELD_REINCIDENCE_THRESHOLD` | `3` | Number of offenses to mark as recidivist |

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `Missing required decision input fields` | Invalid input to decision engine | Validate all required fields before calling |
| `Invalid toxicity analysis data` | Missing or malformed toxicity data | Ensure toxicity_score is a number 0-1 |
| `Platform not supported` | Platform has no adapter | Check supported platforms list |
| `Circuit breaker OPEN` | Too many platform failures | Wait for recovery timeout, check platform status |
| `Database connection failed` | Persistence service error | Check Supabase connection, retry with backoff |
| `Red line violation` | User-defined rule triggered | User must approve action or adjust red lines |

### Error Response Format

```javascript
{
  success: false,
  error: 'Circuit breaker OPEN for platform: twitter',
  platform: 'twitter',
  requiresManualReview: true,
  fallbackAttempted: false,
  metadata: {
    circuitBreakerStatus: 'OPEN',
    lastFailureAt: '2025-10-03T11:58:00Z',
    failureCount: 6
  }
}
```

## Monitoring & Observability

### Key Metrics

- **Decision latency** - Time to make Shield decisions (target: <100ms)
- **Action execution time** - Time to execute platform actions (target: <2s)
- **Circuit breaker state** - Per-platform circuit breaker status
- **Fallback rate** - % of actions using fallback strategies
- **Manual review queue depth** - Number of actions awaiting manual review
- **Recidivism rate** - % of repeat offenders vs first-time

### Logging

All Shield events logged with:
- Organization ID and user ID
- Platform and action type
- Toxicity score and primary category
- Decision reason and severity
- Escalation level and recidivism data
- Execution time and circuit breaker status

### Alerting

- Alert when circuit breaker opens for any platform
- Alert when manual review queue > 100 items
- Alert when decision latency > 500ms
- Alert when fallback rate > 30%
- Alert when critical actions fail to execute

### Dashboard Metrics

```javascript
// Get Shield statistics for organization
const stats = await shieldService.getShieldStats('org_123', 30);

{
  totalShieldActivations: 245,
  actionBreakdown: {
    warn: 85,
    mute_temp: 78,
    mute_permanent: 45,
    block: 32,
    report: 5
  },
  severityBreakdown: {
    high: 120,
    medium: 95,
    low: 30
  },
  platformBreakdown: {
    twitter: 140,
    discord: 65,
    twitch: 30,
    youtube: 10
  },
  blockedUsers: 32,
  totalTrackedUsers: 245,
  averageViolationsPerUser: 1.8,
  topOffenders: [
    { username: '@toxicuser1', violations: 8, isBlocked: true },
    { username: '@toxicuser2', violations: 6, isBlocked: true },
    ...
  ]
}
```

## Future Enhancements

- [ ] Machine learning for adaptive thresholds
- [ ] Sentiment analysis for context-aware decisions
- [ ] User appeal system for Shield actions
- [ ] Cross-platform identity linking (same user on multiple platforms)
- [ ] Shield action effectiveness scoring
- [ ] Automated A/B testing of thresholds
- [x] Real-time dashboard for Shield operations (✅ Completed in #617: ShieldValidation dashboard)
- [ ] Integration with external moderation services (ModAPI, Hive)

---

## Brand Safety for Sponsors (Plan Plus) - Issue #859

### Overview

Brand Safety allows Plus plan users to configure sponsors/brands to protect from offensive comments. When a comment mentions a sponsor and contains toxicity, automated actions are triggered based on configurable severity levels.

### Sponsor Configuration

Sponsors are configured per-user with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | String | Sponsor name (required, unique per user) |
| `url` | String | Sponsor website URL (optional, for tag extraction) |
| `tags` | Array<String> | Keywords/tags to detect (e.g., ["sportswear", "sneakers"]) |
| `severity` | Enum | Protection level: `low`, `medium`, `high`, `zero_tolerance` |
| `tone` | Enum | Roast tone override: `normal`, `professional`, `light_humor`, `aggressive_irony` |
| `priority` | Integer | Conflict resolution priority (1=highest, 5=lowest) |
| `actions` | Array<String> | Actions to take: `hide_comment`, `block_user`, `def_roast`, `agg_roast`, `report`, `sponsor_protection` |
| `active` | Boolean | Enable/disable sponsor protection |

### Detection Flow

1. **Comment Analysis** (AnalyzeToxicityWorker)
   - Before toxicity analysis, fetch active sponsors for organization owner
   - Detect sponsor mentions in comment text (exact match, tag match)
   - Add `sponsors` and `sponsorMatch` to `userContext`

2. **Decision Matrix** (AnalysisDecisionEngine - RULE 0.5)
   - **Zero Tolerance**: Immediate SHIELD with `block_user` + `hide_comment` + `sponsor_protection`
   - **High Severity**: Threshold adjustment -0.2 (more sensitive), apply sponsor actions if triggered
   - **Medium Severity**: Threshold adjustment -0.1, apply sponsor actions if triggered
   - **Low Severity**: Threshold adjustment -0.05, monitoring only

3. **Action Execution** (ShieldService)
   - Execute sponsor-defined actions via platform integrations
   - Tag actions with `sponsor_protection` for analytics
   - Log sponsor match details for reporting

### Shield Actions

When a sponsor match triggers SHIELD, the following actions are available:

- **`hide_comment`**: Hide the offending comment from public view
- **`block_user`**: Block the user from future interactions
- **`def_roast`**: Generate defensive roast (requires Roast integration)
- **`agg_roast`**: Generate aggressive roast (requires Roast integration)
- **`report`**: Report to platform moderation
- **`sponsor_protection`**: Tag for analytics and reporting

### Roast Integration

When sponsor actions include `def_roast` or `agg_roast`, the roast generation system:
1. Receives `brand_safety` metadata in job payload
2. Includes sponsor context in cacheable prompt blocks (A/B/C)
3. Applies tone override:
   - `professional` → Measured, diplomatic, factual
   - `light_humor` → Lighthearted, playful, non-confrontational
   - `aggressive_irony` → Sharp, cutting, marked irony

See `roast.md` for detailed roast integration.

### Cost Control

Tag extraction from sponsor URLs uses OpenAI GPT-4o:
- **Operation**: `extract_sponsor_tags`
- **Cost**: 2 cents per extraction
- **Rate Limit**: 5 requests/min per user
- **Resource Type**: `ai_operations`

### API Endpoints

- `POST /api/sponsors` - Create sponsor
- `GET /api/sponsors` - List sponsors (sorted by priority)
- `GET /api/sponsors/:id` - Get single sponsor
- `PUT /api/sponsors/:id` - Update sponsor
- `DELETE /api/sponsors/:id` - Delete sponsor
- `POST /api/sponsors/extract-tags` - Extract tags from URL (rate limited)

**Access Control**: Authentication required + Plus plan gating

### Example Flow

```
1. User creates sponsor:
   POST /api/sponsors
   {
     "name": "Nike",
     "url": "https://www.nike.com",
     "severity": "high",
     "tone": "professional",
     "priority": 1,
     "actions": ["hide_comment", "def_roast"]
   }

2. Toxic comment received: "Nike is a scam brand, terrible quality"

3. AnalyzeToxicityWorker:
   - Detect sponsor match: Nike (exact match)
   - toxicity_score: 0.65
   - Apply threshold adjustment: 0.8 - 0.2 = 0.6 (high severity)
   - Decision: SHIELD (0.65 >= 0.6)

4. AnalysisDecisionEngine:
   - RULE 0.5: Sponsor Protection
   - Create SHIELD decision with actions: ["hide_comment", "sponsor_protection"]
   - Include brand_safety metadata:
     {
       sponsor: "Nike",
       severity: "high",
       tone: "professional",
       matchType: "exact",
       threshold_adjustment: -0.2
     }

5. ShieldService:
   - Execute hide_comment via platform integration
   - Tag action with sponsor_protection for analytics

6. Generate defensive roast (if def_roast action):
   - GenerateReplyWorker receives brand_safety metadata
   - Apply tone override: professional
   - Include sponsor context in prompt
   - Generate measured, diplomatic roast defending Nike
```

### Metadata Structure

**SHIELD Decision:**
```json
{
  "direction": "SHIELD",
  "action_tags": ["hide_comment", "block_user", "sponsor_protection"],
  "metadata": {
    "brand_safety": {
      "sponsor": "Nike",
      "severity": "zero_tolerance",
      "tone": "professional",
      "matchType": "exact",
      "threshold_adjustment": null
    }
  }
}
```

**ROAST Decision:**
```json
{
  "direction": "ROAST",
  "action_tags": ["generate_reply", "defensive_roast"],
  "metadata": {
    "brand_safety": {
      "sponsor": "Nike",
      "tone": "professional",
      "defensive_roast": true
    }
  }
}
```

---

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer**
- **Documentation Agent**
- **Guardian** (PR #640 - Validated Fallback Security Policy)
- **Orchestrator**
- **Security Engineer**
- **Test Engineer**


## Related Nodes

- **cost-control** - Usage tracking and billing for Shield actions
- **queue-system** - High-priority queue for Shield action jobs
- **roast** - Moderate toxicity comments routed to roast generation
- **multi-tenant** - Organization isolation and settings inheritance
- **social-platforms** - Platform-specific adapters for action execution

---

## Tests

### Ubicación de Tests

**Unit Tests** (14 archivos):
- `tests/unit/services/shieldService.test.js` - Core service functionality
- `tests/unit/services/shieldService-edge-cases.test.js` - Edge cases and error handling
- `tests/unit/services/shieldDecisionEngine.test.js` - Decision logic and thresholds
- `tests/unit/services/shieldActionExecutor.test.js` - Action execution layer
- `tests/unit/services/shieldPersistenceService.test.js` - Database persistence
- `tests/unit/services/shieldPersistenceService-retention.test.js` - Data retention policies
- `tests/unit/services/shieldSettingsService.test.js` - **Settings service (Issue #503)** ✅
  - **64 comprehensive tests** covering all functionality
  - **Coverage: 96.93%** (improved from 8.58%)
  - Cache management, org/platform settings, validation, inheritance logic
- `tests/unit/routes/shield-round2.test.js` - API endpoints (Round 2)
- `tests/unit/routes/shield-round3-security.test.js` - Security hardening
- `tests/unit/routes/shield-round4-enhancements.test.js` - Feature enhancements
- `tests/unit/routes/shield-round5.test.js` - Latest API additions
- `tests/unit/database/shield-migration.test.js` - Database migrations
- `tests/unit/database/shield-migration-round5.test.js` - Latest schema changes
- `tests/unit/utils/shield-validation.test.js` - Input validation utilities

**Integration Tests** (10+ archivos):
- `tests/integration/shieldDecisionEngine.integration.test.js` - Full decision flow
- `tests/integration/shieldActionExecutor.integration.test.js` - Action execution with platforms
- `tests/integration/shieldPersistenceIntegration.test.js` - Database integration
- `tests/integration/shield-round3-complete.test.js` - Round 3 complete flow
- `tests/integration/shield-actions-integration.test.js` - Multi-action scenarios
- `tests/integration/shieldUIIntegration.test.js` - UI integration
- Additional platform-specific integration tests

**Visual Tests** (1 archivo):
- `tests/unit/visual/shield-round5-stability.test.js` - Visual regression testing

**E2E Flow Validation** (Issue #487):
- `scripts/validate-flow-shield.js` - End-to-end Shield flow validation (15 test cases)
  - 9 decision matrix tests (toxicity + user risk → action)
  - 6 edge case tests (timeouts, idempotency, priority, failures)
- `admin-dashboard/src/pages/ShieldValidation/index.tsx` - Validation dashboard UI
- `admin-dashboard/src/pages/ShieldSettings/index.tsx` - Shield configuration UI
- `docs/test-evidence/flow-shield/` - Validation evidence and screenshots

### Cobertura de Tests

- **Total Tests**: ~31 archivos de test
- **Unit Test Coverage**: ~96% del código crítico
- **ShieldSettingsService Coverage**: 96.93% (Issue #503 - improved from 8.58%)
- **Integration Tests**: 10+ escenarios de flujo completo
- **Visual Tests**: Estabilidad de UI en Round 5

### Casos de Prueba Cubiertos

**Decision Engine:**
- ✅ Threshold-based decision making (Critical, High, Moderate, Corrective, Normal)
- ✅ Offender history tracking and recidivism detection
- ✅ Risk level calculation (Critical, High, Moderate, Low)
- ✅ Platform-specific threshold overrides
- ✅ Organization-level settings inheritance
- ✅ Red Lines (zero-tolerance) detection
- ✅ Circuit breaker pattern with fallback strategies

**Action Execution:**
- ✅ Platform-specific actions (mute, block, report, hide, timeout)
- ✅ Action escalation based on recidivism
- ✅ Multi-platform support (Twitter, Discord, Twitch, YouTube, etc.)
- ✅ Action priority handling (high-priority actions via Priority 1 queue)
- ✅ Error handling and retry logic
- ✅ Action logging and audit trail

**Persistence:**
- ✅ Shield events database storage
- ✅ Offender history queries and aggregation
- ✅ Settings CRUD operations
- ✅ Data retention policies (30 days default, configurable)
- ✅ Organization-scoped data access (RLS)
- ✅ Platform-level settings inheritance

**API Endpoints:**
- ✅ GET /api/shield/events - List shield events
- ✅ GET /api/shield/offenders - Get offender stats
- ✅ GET /api/shield/settings - Retrieve settings
- ✅ PUT /api/shield/settings - Update settings
- ✅ POST /api/shield/test - Test Shield decision
- ✅ Authentication and authorization
- ✅ Input validation and sanitization
- ✅ Rate limiting

**Edge Cases:**
- ✅ Missing or invalid input data
- ✅ Database connection failures
- ✅ Platform API errors
- ✅ Concurrent action requests
- ✅ Empty offender history
- ✅ Circular dependencies in settings inheritance
- ✅ Extremely high toxicity scores (>1.0)

### Tests Pendientes

- [ ] E2E tests con plataformas reales (requiere API keys de producción)
- [ ] Performance tests con alto volumen (>1000 eventos/segundo)
- [ ] Chaos engineering tests (simulación de fallos de infraestructura)
- [ ] Load tests para Action Executor (múltiples plataformas simultáneas)
- [ ] Security penetration tests (autenticación, autorización, SQL injection)

### Comandos de Test

```bash
# Run all Shield tests
npm test -- shield

# Run unit tests only
npm test -- tests/unit/services/shield

# Run integration tests
npm test -- tests/integration/shield

# Run specific test file
npm test -- tests/unit/services/shieldDecisionEngine.test.js

# Run with coverage
npm test -- shield --coverage
```

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Weekly or on critical incidents
**Last Reviewed:** 2025-10-20
**Version:** 1.0.0
