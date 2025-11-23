# ShieldService

**Path:** `src/services/shieldService.js`

## Overview

The ShieldService provides automated toxicity protection and content moderation for the Roastr.ai multi-tenant platform. It implements escalating response actions based on user behavior patterns and content severity.

**Key Features:**

- High-priority toxicity analysis with Perspective API integration
- Automated user behavior tracking and violation management
- Action tag-based execution system (Issue #650)
- Escalating response actions (mute, block, report)
- Reincidence detection and prevention
- Platform-specific moderation actions via queue system

## Methods

### executeActionsFromTags()

**Added:** Issue #650
**Status:** ✅ Active

Execute Shield actions based on `action_tags` array from AnalysisDecisionEngine. This is the new primary API for Shield action execution.

```javascript
async executeActionsFromTags(organizationId, comment, action_tags, metadata)
```

**Parameters:**

- `organizationId` (string): Organization identifier
- `comment` (object): Comment object with id, platform, author info
- `action_tags` (array): Array of action tag strings from AnalysisDecisionEngine
- `metadata` (object): Analysis metadata including platform_violations, confidence scores

**Returns:**

```javascript
{
  success: boolean,
  actions_executed: [
    { tag: string, status: 'executed'|'skipped'|'failed', result: object }
  ],
  failed_actions: [
    { tag: string, error: string }
  ]
}
```

**Supported Action Tags:**

- `hide_comment`: Hide toxic comment from public view
- `block_user`: Block user from platform
- `report_to_platform`: Report to platform moderation (requires `metadata.platform_violations.reportable === true`)
- `mute_temp`: Temporarily mute user (24h)
- `mute_permanent`: Permanently mute user
- `check_reincidence`: Check for repeat violations
- `add_strike_1`: Add Level 1 strike to user record
- `add_strike_2`: Add Level 2 strike to user record
- `require_manual_review`: Flag for manual moderator review
- `gatekeeper_unavailable`: Log Gatekeeper service unavailability

**Critical Safeguards:**

- `report_to_platform` only executes if `metadata.platform_violations.reportable === true`
- Database recording failures do not block action execution (graceful degradation)
- All actions executed in parallel using `Promise.all()` for performance
- Each action queued with appropriate priority (Priority 1 for Shield actions)

**Example Usage:**

```javascript
const action_tags = ['hide_comment', 'add_strike_1', 'check_reincidence'];
const metadata = {
  confidence: 0.95,
  toxicity_score: 0.85,
  platform_violations: { reportable: false }
};

const result = await shieldService.executeActionsFromTags(
  'org-123',
  comment,
  action_tags,
  metadata
);

if (result.success) {
  console.log(`Executed ${result.actions_executed.length} actions`);
}
```

**Database Integration:**

- Records each action in `shield_actions` table with `action_tag` field
- Updates `user_behavior` table with violation counts and strikes
- Tracks `actions_taken` count for user behavior analytics

**Test Coverage:** 25/25 tests passing (100%)
**Test File:** `tests/unit/services/shield-action-tags.test.js`

---

### executeActions() **[DEPRECATED]**

**Status:** ⚠️ Deprecated (Issue #650)
**Replacement:** Use `executeActionsFromTags()` instead

Legacy method using analysis-based API. Will be removed in a future version.

```javascript
async executeActions(analysis, user, content)
```

**Migration Guide:**

```javascript
// Old API (deprecated)
await shieldService.executeActions(analysis, user, content);

// New API (recommended)
const action_tags = analysis.action_tags; // From AnalysisDecisionEngine
const metadata = {
  confidence: analysis.confidence,
  toxicity_score: analysis.toxicityScore,
  platform_violations: analysis.platform_violations
};
await shieldService.executeActionsFromTags(orgId, comment, action_tags, metadata);
```

---

### analyzeForShield()

Analyze comment for Shield-level threats and determine appropriate actions.

```javascript
async analyzeForShield(organizationId, comment, analysisResult)
```

Calculates Shield priority (low, medium, high, critical) based on toxicity severity and queues comment for processing if Shield is enabled for the organization.

---

### trackUserBehavior()

Update user behavior statistics after violations.

```javascript
async trackUserBehavior(user, violation)
```

Maintains violation counters, strike levels, and last violation timestamps in the `user_behavior` table.

---

### getUserRiskLevel()

Calculate user risk level based on violation history.

```javascript
async getUserRiskLevel(user)
```

Returns risk level: `'low'`, `'medium'`, `'high'`, or `'critical'` based on violation patterns and reincidence detection.

---

### getShieldStats()

Retrieve Shield statistics for an organization.

```javascript
async getShieldStats(organizationId)
```

Returns aggregated Shield metrics including total actions, action type breakdown, and effectiveness indicators.

---

## Action Tag Handlers

Internal handler methods for each action tag. All handlers follow the same pattern:

```javascript
async _handle<ActionName>(organizationId, comment, metadata)
```

**Handler List:**

1. `_handleHideComment()` - Queue hide_comment job
2. `_handleBlockUser()` - Queue block_user job
3. `_handleReportToPlatform()` - Queue report (with reportable check)
4. `_handleMuteTemp()` - Queue 24h mute
5. `_handleMutePermanent()` - Queue permanent mute
6. `_handleCheckReincidence()` - Check violation history
7. `_handleAddStrike1()` - Add Level 1 strike
8. `_handleAddStrike2()` - Add Level 2 strike
9. `_handleRequireManualReview()` - Flag for review
10. `_handleGatekeeperUnavailable()` - Log service issue

---

## Configuration

Shield behavior controlled via environment variables:

```bash
ROASTR_SHIELD_ENABLED=true           # Enable Shield system
SHIELD_AUTO_ACTIONS=true             # Enable automatic action execution
SHIELD_REINCIDENCE_THRESHOLD=3       # Repeat violation threshold
SHIELD_SEVERITY_ESCALATION=true      # Enable severity-based escalation
```

---

## Queue Integration

All Shield actions are queued with `Priority 1` (highest) for immediate processing:

```javascript
await queueService.addJob('shield_action', jobData, { priority: 1 });
```

**Queue Job Format:**

```javascript
{
  organization_id: string,
  action_type: string,  // Action tag name
  comment: object,
  metadata: object,
  user_id: string,
  platform: string
}
```

---

## Database Schema

### shield_actions Table

```sql
CREATE TABLE shield_actions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comment_id UUID NOT NULL,
  action_type VARCHAR(50),          -- Legacy field
  action_tag VARCHAR(50),            -- New field (Issue #650)
  platform VARCHAR(50),
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT shield_actions_action_tag_check CHECK (
    action_tag IN (
      'hide_comment', 'block_user', 'report_to_platform',
      'mute_temp', 'mute_permanent', 'check_reincidence',
      'add_strike_1', 'add_strike_2', 'require_manual_review',
      'gatekeeper_unavailable'
    )
  )
);

CREATE INDEX idx_shield_actions_action_tag ON shield_actions(action_tag);
```

### user_behavior Table

```sql
CREATE TABLE user_behavior (
  user_id UUID PRIMARY KEY,
  platform VARCHAR(50),
  organization_id UUID,
  total_violations INT DEFAULT 0,
  severe_violations INT DEFAULT 0,
  strikes_level_1 INT DEFAULT 0,
  strikes_level_2 INT DEFAULT 0,
  actions_taken INT DEFAULT 0,
  last_violation TIMESTAMPTZ
);
```

---

## Plan Availability

**Shield Access:**

- Free Plan: ❌ Not available
- Starter Plan: ❌ Not available
- Pro Plan: ✅ Available
- Plus Plan: ✅ Available
- Enterprise Plan: ✅ Available (custom rules)

---

## Related Documentation

- **GDD Node:** `docs/nodes/shield.md`
- **Planning Document:** `docs/plan/issue-650.md`
- **Test Evidence:** `tests/unit/services/shield-action-tags.test.js`
- **Worker Integration:** `src/workers/ShieldActionWorker.js`
- **Migration:** Issue #632 (Unified Analysis Department)

---

**Last Updated:** 2025-10-23
**Issue:** #650 - SHIELD: Migrate ShieldService to consume action_tags
