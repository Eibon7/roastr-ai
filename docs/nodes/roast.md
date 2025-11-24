# Roast Generation System

**Node ID:** `roast`
**Owner:** Backend Developer
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-11-23
**Coverage:** 59%
**Coverage Source:** auto
**Note:** Coverage value updated to match actual test coverage (gdd-status.json validation). Will be auto-updated when tests pass.
**Related PRs:** #499, #632 (Unified Analysis Department), #634 (CodeRabbit Security Fix - Conservative Gatekeeper Fallback), #865 (Issue #859 - Brand Safety for Sponsors), #946 (Zod Validation Migration)
**Protected:** true
**Last Verified:** 2025-11-23
**Protection Reason:** GDD 2.0 Maintenance Mode - Phase 18 Operational Freeze

## Dependencies

- `persona` - User personality and roast style configuration
- `tone` - Tone mapping and humor type configuration
- `platform-constraints` - Platform-specific character limits and style guides
- `shield` - Automated content moderation with escalating actions
- `cost-control` - Usage tracking, billing integration, and limit enforcement

## Overview

The roast generation system is the core feature of Roastr.ai, responsible for creating intelligent, context-aware, and personalized roast responses to toxic or offensive comments on social media platforms.

### Key Components

1. **RoastEngine** - Main orchestrator (SPEC 7 - Issue #363)
2. **RoastGeneratorEnhanced** - Enhanced generation with integrated RQC
3. **RoastPromptTemplate** - Master prompt template system (v1)
4. **CsvRoastService** - Reference roast database and similarity matching

## Architecture

### Main Flow

```
Comment Detection
    ↓
AnalyzeToxicityWorker → Analysis Department (Issue #632)
    ↓
[PARALLEL EXECUTION]
    ├─ Gatekeeper Service (Security)
    │  └─ Prompt injection detection
    └─ Perspective API (Toxicity)
       └─ Toxicity score + Platform violations
    ↓
AnalysisDecisionEngine → Unified Decision
    ↓
    - SHIELD (critical/high toxicity) → Shield Service
    - PUBLISH (<0.30 toxicity) → Publish normally
    - ROAST (0.30-0.94 toxicity) → Continue below ✅
    ↓
RoastEngine.generateRoast() [Only if direction=ROAST]
    ↓
[Validation] → Input validation, user config fetch
    ↓
[Generation] → RoastGeneratorEnhanced with retry logic (3 attempts)
    ↓
[Moderation] → Basic (Free/Pro) OR Advanced RQC (Creator+)
    ↓
[Transparency] → Apply AI-generated disclaimers
    ↓
[Auto-Approve] → Optional auto-publish with transparency validation
    ↓
[Metadata] → Persist metadata only (GDPR compliant)
```

**Analysis Department Integration (Issue #632):**

Before roast generation begins, the Analysis Department runs parallel Gatekeeper + Perspective analysis to determine if the comment should be:

- **SHIELD** (≥0.95 toxicity OR platform violations) → Blocked, no roast generated
- **PUBLISH** (<0.30 toxicity) → Published normally, no roast needed
- **ROAST** (0.30-0.94 toxicity) → Proceed to roast generation

This ensures platform violations (threats, identity attacks) are caught and reported BEFORE roast generation, preventing ToS violations.

**Key Change:** Roast generation is now **conditional** on Analysis Department returning `direction: 'ROAST'`. This is determined by:

- Combined Gatekeeper + Perspective results
- Platform violation detection (threat ≥0.8, identity_attack ≥0.8)
- Toxicity thresholds (roast_lower: 0.30, roast_upper: 0.94)

**Fallback Mode (CodeRabbit Review #634):**

When Gatekeeper service is unavailable, the decision matrix includes a conservative fallback:

```text
RULE 0: Gatekeeper Fallback Mode → SHIELD (highest priority)
    ↓
Condition: Gatekeeper unavailable + fallback=true
    ↓
Action: Force SHIELD regardless of toxicity scores
Result: NO roast generation (security over convenience)
```

This fail-safe ensures that during Gatekeeper outages, low-toxicity prompt injections cannot bypass security by routing to ROAST. All fallback-mode comments are blocked and flagged for manual review.

See `docs/nodes/shield.md` for full Analysis Department decision matrix and fallback security policy.

### Component Files

| File                       | Path                                     | Purpose                                      |
| -------------------------- | ---------------------------------------- | -------------------------------------------- |
| **RoastEngine**            | `src/services/roastEngine.js`            | Main orchestrator with auto-approve logic    |
| **RoastGeneratorEnhanced** | `src/services/roastGeneratorEnhanced.js` | Enhanced generation with RQC integration     |
| **RoastPromptTemplate**    | `src/services/roastPromptTemplate.js`    | Master prompt template system                |
| **CsvRoastService**        | `src/services/csvRoastService.js`        | Reference roast database                     |
| **RQCService**             | `src/services/rqcService.js`             | Roast Quality Control (3 parallel reviewers) |

## Master Prompt Template System (v1)

**Version:** `v1-roast-prompt` (Issue #122, #128)
**Template Service:** `src/services/roastPromptTemplate.js`

### Features

- **Dynamic Field Replacement** - Supports placeholders for original comment, category, references, user tone
- **Comment Categorization** - Automatically categorizes comments (insults, body shaming, political, etc.)
- **Reference Integration** - Includes similar roasts from CSV database as examples
- **User Tone Mapping** - Personalizes responses based on user preferences and plan features
- **Security Protection** - Robust input sanitization and prompt injection prevention (Issue #127)
- **Performance Optimization** - O(n log n) similarity algorithm with word frequency indexing (Issue #128)

### Template Structure

```
Tu tarea es generar una respuesta sarcástica e ingeniosa...

💬 COMENTARIO ORIGINAL: {{original_comment}}
🎭 CATEGORÍA DEL COMENTARIO: {{comment_category}}
📚 EJEMPLOS DE ROASTS: {{reference_roasts_from_CSV}}
👤 TONO PERSONAL: {{user_tone}}
```

### Security (Issue #127)

- **Prompt Injection Protection** - Sanitizes malicious template placeholders
- **Input Validation** - Strict validation for comment type, length, content
- **Error Traceability** - Comprehensive logging with error context and version tracking
- **Length Limits** - 2000 character limit to prevent DoS attacks
- **Fallback System** - Graceful degradation when validation fails

### Performance Optimizations (Issue #128)

- **Word Frequency Index** - Pre-built index for O(n log n) similarity matching
- **Centralized Constants** - All patterns and mappings in `src/config/constants.js`
- **Chunked CSV Loading** - Memory-optimized reference roast loading
- **Category Score Boost** - Higher weight for category matches (5 points)
- **Adaptive Thresholds** - Dynamic thresholds based on dataset size

## RQC (Roast Quality Control)

**Feature:** Advanced quality control for Creator+ plans
**Service:** `src/services/rqcService.js`

### Two-Tier System

#### Basic Moderation (Free/Pro Plans)

- Integrated moderation in prompt template
- Single-pass generation with OpenAI
- Cost-optimized for high volume
- Uses `gpt-3.5-turbo` (Free) or `gpt-4o` (Pro)

#### Advanced RQC (Creator+ Plans)

- 3 parallel AI reviewers: Moderator, Comedian, Style Expert
- Up to 3 regeneration attempts
- Higher quality and brand safety
- Uses `gpt-4o` or `gpt-5` (auto-detected, Issue #326)

### RQC Reviewers

| Reviewer         | Role                                 | Validation                                         |
| ---------------- | ------------------------------------ | -------------------------------------------------- |
| **Moderator**    | Content safety and platform policies | No hate speech, violence, discrimination           |
| **Comedian**     | Humor quality and creativity         | Clever, original, not lazy or obvious              |
| **Style Expert** | Brand voice and user preferences     | Matches user tone, intensity level, custom prompts |

### RQC Decision Flow

```
Generate Roast (Attempt 1-3)
    ↓
[Parallel Review] → Moderator + Comedian + Style
    ↓
All Pass? → Approved ✅
    ↓
Any Fail? → Regenerate with feedback
    ↓
Max Attempts Reached? → Fallback roast
```

## Voice Styles (SPEC 7) - Dynamic Tone System (Issue #876)

**Feature:** Dynamic roast tone configuration from database  
**Implementation:** `ToneConfigService` + Admin Panel  
**Migration:** Issue #876 - From hardcoded to DB-driven

### System Overview

Los tonos de roast ahora se gestionan dinámicamente desde base de datos, permitiendo:

- ✅ Editar tonos sin modificar código
- ✅ Añadir nuevos tonos fácilmente
- ✅ Activar/desactivar tonos temporalmente
- ✅ Reordenar tonos
- ✅ Soporte multiidioma (ES/EN)
- ✅ Cache inteligente (5min TTL)

### Initial Tones (Migrated from Hardcoded)

#### Spanish (ES)

| Style        | Name       | Description                        | Intensity |
| ------------ | ---------- | ---------------------------------- | --------- |
| `flanders`   | Flanders   | Tono amable pero con ironía sutil  | 2/5       |
| `balanceado` | Balanceado | Equilibrio entre ingenio y firmeza | 3/5       |
| `canalla`    | Canalla    | Directo y sin filtros, más picante | 4/5       |

#### English (EN)

| Style        | Name     | Description                           | Intensity |
| ------------ | -------- | ------------------------------------- | --------- |
| `flanders`   | Light    | Gentle wit with subtle irony          | 2/5       |
| `balanceado` | Balanced | Perfect mix of humor and firmness     | 3/5       |
| `canalla`    | Savage   | Direct and unfiltered, maximum impact | 4/5       |

### Dynamic Configuration

**Database:** `roast_tones` table  
**Service:** `src/services/toneConfigService.js`  
**API:** `/api/admin/tones` (admin-only)  
**Integration:** `src/lib/prompts/roastPrompt.js` (buildBlockA async)

**Documentation:** See `docs/admin/tone-management.md` for complete guide

## Version Control (1-2 Versions)

**Feature Flag:** `ROAST_VERSIONS_MULTIPLE`
**Default:** 1 version (cost optimization)

### Single Version Mode (Flag OFF)

- 1 roast generated per request
- Faster processing (~2-3 seconds)
- Lower cost (~150-200 tokens)
- Recommended for Free/Pro plans

### Multiple Version Mode (Flag ON)

- 2 roasts generated in parallel
- User selects preferred version
- Higher quality options
- Recommended for Creator+ plans
- ~300-400 tokens total

## Transparency & Disclaimers

**Service:** `src/services/transparencyService.js` (Issue #196, #199)
**Requirement:** Mandatory for auto-approve flow

### Transparency Modes

| Mode        | Description                     | Example                                   |
| ----------- | ------------------------------- | ----------------------------------------- |
| `signature` | AI signature in bio             | "Roasts generados por IA" in profile      |
| `inline`    | Inline disclaimer               | "✨ Cortesía de tu asistente anti-trolls" |
| `hidden`    | No transparency (Creator+ only) | -                                         |

### Creative Disclaimer Pool

**Auto-Approve Mode:** Random selection from predefined pool

Spanish:

- "Cortesía de tu asistente personal anti-trolls ✨"
- "Mensaje automático: troll detectado y neutralizado 🎯"
- "Tu IA personal se encarga de los molestos 🤖"
- "Auto-respuesta inteligente: problema resuelto 🛡️"
- "Generado automáticamente por tu escudo digital 🔥"

English:

- "Courtesy of your personal anti-troll assistant ✨"
- "Auto-response: troll detected and neutralized 🎯"
- "Your AI personal assistant handles the annoying ones 🤖"
- "Smart auto-reply: problem solved 🛡️"
- "Auto-generated by your digital shield 🔥"

### Transparency Validation

**Requirement:** Mandatory validation before auto-publish

```javascript
validateTransparency(disclaimerResult) {
  if (!disclaimerResult.enhancedText) return { isValid: false };
  if (!disclaimerResult.disclaimer) return { isValid: false };
  if (!disclaimerResult.enhancedText.includes(disclaimerResult.disclaimer)) {
    return { isValid: false };
  }
  return { isValid: true };
}
```

**Failure Handling:**

- Block publication if transparency validation fails
- Log error to Sentry (production)
- Fallback to pending status (requires manual approval)

## Auto-Approve Flow

**Feature:** Automatic publication with transparency validation
**SPEC 7 Requirement:** Distinct behavior from manual flow

### Auto-Approve Checklist

1. ✅ User has auto-approve enabled in settings
2. ✅ Roast generation successful
3. ✅ Transparency disclaimer applied from pool
4. ✅ Transparency validation passed
5. ✅ Metadata persisted to database

### Transparency Validation Flow

```
Auto-Approve Requested
    ↓
Apply Creative Transparency (random from pool)
    ↓
Validate Transparency Integration
    ↓
Valid? → Status: auto_approved ✅
    ↓
Invalid? → Log to Sentry → Status: pending ⚠️
```

## Retry Logic

**Max Attempts:** 3
**Delay:** Exponential backoff (500ms × attempt)

### Retry Scenarios

| Scenario             | Action                   |
| -------------------- | ------------------------ |
| OpenAI API timeout   | Retry with delay         |
| Rate limit error     | Retry with longer delay  |
| Network error        | Retry up to max attempts |
| Validation error     | No retry, return error   |
| Max attempts reached | Return fallback roast    |

### Fallback Roast

When all retries fail:

1. Attempt safe fallback prompt (low temperature, strict safety)
2. If fallback fails, use mock generator
3. If mock fails, return static roast: "😉 Tomo nota, pero hoy prefiero mantener la clase."

## Metadata Persistence (GDPR Compliant)

**Table:** `roasts_metadata`
**Storage:** Only metadata, NO roast content stored

### Metadata Fields

| Field                  | Type      | Description                              |
| ---------------------- | --------- | ---------------------------------------- |
| `id`                   | string    | Unique roast identifier                  |
| `user_id`              | uuid      | User who generated roast                 |
| `org_id`               | uuid      | Organization (multi-tenant)              |
| `platform`             | string    | Social platform (twitter, youtube, etc.) |
| `comment_id`           | string    | Original comment identifier              |
| `style`                | string    | Voice style used                         |
| `language`             | string    | Language (es, en)                        |
| `versions_count`       | int       | Number of versions generated             |
| `auto_approve`         | boolean   | Was auto-approve enabled                 |
| `transparency_applied` | boolean   | Was transparency disclaimer applied      |
| `status`               | string    | pending, auto_approved, published        |
| `tokens_used`          | int       | Total tokens consumed                    |
| `method`               | string    | basic_moderation, advanced_rqc, fallback |
| `created_at`           | timestamp | Generation timestamp                     |

**GDPR Compliance:**

- No roast text stored in database
- Only metadata for analytics and debugging
- Full data deletion on account deletion
- Transparent data usage in privacy policy

## Model Selection (GPT-5 Auto-Detection)

**Feature:** Automatic GPT-5 detection and usage (Issue #326)
**Service:** `src/services/modelAvailabilityService.js`

### Model Mapping by Plan

| Plan    | Default Model   | GPT-5 Available       | Notes           |
| ------- | --------------- | --------------------- | --------------- |
| Free    | `gpt-3.5-turbo` | No                    | Basic quality   |
| Starter | `gpt-4o`        | Auto-detect           | Good quality    |
| Pro     | `gpt-4o`        | Auto-detect           | High quality    |
| Plus    | `gpt-4o`        | Auto-detect → `gpt-5` | Premium quality |
| Custom  | `gpt-4o`        | Auto-detect → `gpt-5` | Enterprise      |

### Auto-Detection Logic

```javascript
async getModelForPlan(plan) {
  const modelService = getModelAvailabilityService();
  return await modelService.getModelForPlan(plan); // Auto-detects GPT-5
}
```

## CSV Reference Roast Database

**Service:** `src/services/csvRoastService.js`
**Data:** `data/roasts.csv`

### Reference Roast Structure

| Field      | Description                 |
| ---------- | --------------------------- |
| `comment`  | Original toxic comment      |
| `roast`    | High-quality roast response |
| `category` | Comment category            |
| `language` | Language (es, en)           |

### Similarity Matching (O(n log n))

**Algorithm:** Word frequency indexing with category boost

1. Build word frequency index (lazy, cached)
2. Score roasts by shared words
3. Boost score for matching category (+5 points)
4. Sort by score (O(n log n))
5. Return top N matches (default: 3)

**Performance:**

- Index rebuilds every 5 minutes or on first load
- Adaptive thresholds for small datasets (<100 roasts)
- Minimal word length: 2 characters (small datasets) or 3 characters (large)
- Minimum similarity score: 1 point

### Reference Integration by Plan

| Plan     | References Included | Count |
| -------- | ------------------- | ----- |
| Free     | ❌ No               | 0     |
| Starter  | ✅ Yes              | 3     |
| Pro      | ✅ Yes              | 3     |
| Plus     | ✅ Yes              | 3-5   |
| Creator+ | ✅ Yes              | 5     |

## API Usage Examples

### Basic Generation

```javascript
const roastEngine = new RoastEngine();

const result = await roastEngine.generateRoast(
  {
    comment: 'Esta aplicación es horrible',
    toxicityScore: 0.7,
    commentId: 'comment_123'
  },
  {
    userId: 'user_uuid',
    orgId: 'org_uuid',
    platform: 'twitter',
    style: 'balanceado',
    language: 'es',
    autoApprove: false
  }
);

console.log(result.roast); // Generated roast text
console.log(result.status); // "pending" or "auto_approved"
```

### With Auto-Approve

```javascript
const result = await roastEngine.generateRoast(
  {
    comment: "You're so dumb",
    toxicityScore: 0.8,
    commentId: 'comment_456'
  },
  {
    userId: 'user_uuid',
    autoApprove: true, // Enable auto-approve
    style: 'savage',
    language: 'en'
  }
);

// Auto-approve flow:
// 1. Generates roast
// 2. Applies creative transparency disclaimer
// 3. Validates transparency integration
// 4. Sets status to "auto_approved" (or "pending" if validation fails)
```

### Multiple Versions

```javascript
// Requires ROAST_VERSIONS_MULTIPLE flag enabled
const result = await roastEngine.generateRoast(input, options);

console.log(result.versions);
// [
//   { id: 1, text: "First version...", style: "balanced" },
//   { id: 2, text: "Second version...", style: "balanced" }
// ]
```

## Cost Control Integration

**Dependency:** `cost-control` node
**Service:** `src/services/costControl.js`

### Token Tracking

- Estimate tokens: ~4 characters per token
- Track total tokens per roast generation
- Include prompt + response + RQC reviews

### Cost Limits by Plan

| Plan    | Monthly Roasts | Approximate Cost |
| ------- | -------------- | ---------------- |
| Free    | 100            | $0 (subsidized)  |
| Starter | 500            | $2-3             |
| Pro     | 1,000          | $5-7             |
| Plus    | Unlimited      | Pay-as-you-go    |

### Throttling

- Automatic throttling when approaching plan limits
- Hard limit enforcement at 100% usage
- Grace period: 10% overage allowed

## Toxicity Analysis (Perspective API)

**Service:** `src/services/perspective.js` → `src/workers/AnalyzeToxicityWorker.js`
**Provider:** Google Perspective API
**Documentation:** https://developers.perspectiveapi.com/s/

### Integration Flow

```text
Comment Detected
    ↓
AnalyzeToxicityWorker.processJob()
    ↓
PerspectiveService.analyzeToxicity()
    ↓
Perspective API (Google)
    ↓
[Toxicity Analysis Result]
    ↓
    - toxicity_score: 0-1 (TOXICITY attribute)
    - severity_level: critical/high/medium/low/clean
    - categories: threat, severe_toxicity, insult, profanity, etc.
    - raw_scores: All 6 Perspective attributes
    ↓
Router: BLOCK (≥0.85) | ROAST (0.30-0.84) | PUBLISH (<0.30)
```

### Toxicity Attributes

Perspective API analyzes 6 toxicity dimensions:

| Attribute           | Description                          | Roast Usage              |
| ------------------- | ------------------------------------ | ------------------------ |
| **TOXICITY**        | Overall toxicity score               | Primary routing decision |
| **SEVERE_TOXICITY** | Severe toxic content                 | Contributes to severity  |
| **IDENTITY_ATTACK** | Attacks on identity/protected groups | Shield escalation        |
| **INSULT**          | Insulting language                   | Comment categorization   |
| **PROFANITY**       | Profane language                     | Tone adjustment          |
| **THREAT**          | Threatening language                 | Shield critical priority |

### Severity Calculation

Perspective API calculates severity using multi-factor logic:

```javascript
// Critical: Severe toxicity or threat >= 0.95
if (severeToxicity >= 0.95 || threat >= 0.95) return 'critical';

// High: Any critical category >= 0.85
if (toxicity >= 0.85 || severeToxicity >= 0.85 || threat >= 0.85) return 'high';

// Medium: Toxicity >= 0.6
if (toxicity >= 0.6) return 'medium';

// Low: Toxicity >= 0.4
if (toxicity >= 0.4) return 'low';

// Clean: Toxicity < 0.4
return 'clean';
```

**Important:** Severity considers multiple attributes, not just toxicity score. A comment with low toxicity (0.60) but high threat (0.95) will be classified as `critical`.

### Roast Routing by Toxicity

| Toxicity Score | Severity      | Routing Decision                       |
| -------------- | ------------- | -------------------------------------- |
| ≥0.85          | critical/high | **BLOCK** + Shield analysis (no roast) |
| 0.60-0.84      | medium        | **ROAST** generation eligible          |
| 0.30-0.59      | low           | **ROAST** generation eligible          |
| <0.30          | clean         | **PUBLISH** normally (no roast needed) |

### Fallback Strategy

If Perspective API is unavailable:

1. **OpenAI Moderation API** - Secondary toxicity detection
2. **Pattern-Based Detection** - Regex patterns for common toxic language
3. **Safe Default** - Classify as medium toxicity (roastable)

**Fallback Chain:**

```text
Perspective API fails
    ↓
Try OpenAI Moderation
    ↓ (fails)
Try Pattern-Based Detection
    ↓ (fails)
Safe Default: toxicity = 0.55 (roastable)
```

### Integration with Roast Generation

```javascript
// Example: Toxicity analysis result
{
  toxicity_score: 0.72,           // TOXICITY attribute
  severity_level: 'medium',        // Calculated severity
  categories: ['insult'],          // Detected categories
  raw_scores: {
    toxicity: 0.72,
    severeToxicity: 0.35,
    identityAttack: 0.20,
    insult: 0.68,
    profanity: 0.42,
    threat: 0.15
  }
}

// Roasting eligible (0.30-0.84)
await roastEngine.generateRoast(comment, {
  userId,
  toxicityScore: 0.72,           // Used for tone intensity
  categories: ['insult'],         // Used for roast style selection
  style: 'balanced',              // User preference
  language: 'en'
});
```

### Perspective API Configuration

**Rate Limiting:** 1 QPS (free tier)
**Request Timeout:** 10 seconds
**Max Retries:** 3 with exponential backoff
**Character Limit:** 3000 characters (auto-truncate)
**Languages Supported:** English, Spanish (configurable)

### Validation

**Test Evidence:** `docs/test-evidence/perspective-shield-validation.md`
**Integration Tests:** `tests/unit/services/perspective.test.js` (31 tests, 100% passing)

## Shield Integration

**Dependency:** `shield` node
**Integration Point:** Post-generation safety check

### Shield Actions

After roast generation, Shield may:

1. **Auto-mute** - Mute user if roast quality is low
2. **Flag for review** - Queue roast for human review
3. **Block publication** - Prevent roast from being published
4. **Report to platform** - Report toxic comment to platform

### Priority System

Shield actions get priority 1 in queue system for immediate processing.

### Perspective → Shield Flow

For comments with toxicity ≥0.85 (BLOCK zone):

```text
Perspective Analysis (severity = 'high')
    ↓
Shield receives severity_level
    ↓
Shield Priority Calculation
    ↓
    - critical → Priority 1, auto-block + report
    - high → Priority 2, auto-mute + manual review
    - medium → Priority 3, manual moderation
    ↓
ShieldActionWorker executes platform action
```

**Note:** Shield decisions are based on Perspective's `severity_level`, not just `toxicity_score`. This ensures multi-factor analysis (threat, severe toxicity, etc.) drives moderation actions.

## Platform Constraints Integration

**Dependency:** `platform-constraints` node
**Service:** `src/config/platforms.js`

### Character Limits

| Platform  | Limit  | Validation                  |
| --------- | ------ | --------------------------- |
| Twitter   | 280    | Hard limit                  |
| YouTube   | 10,000 | Soft limit (recommend 500)  |
| Instagram | 2,200  | Soft limit (recommend 500)  |
| Facebook  | 63,206 | Soft limit (recommend 1000) |
| Discord   | 2,000  | Hard limit                  |

### Platform Validation

```javascript
const { validateRoastForPlatform } = require('../config/platforms');

const isValid = validateRoastForPlatform(roastText, 'twitter');
if (!isValid) {
  // Roast exceeds platform character limit
  // Trigger regeneration with stricter length constraint
}
```

## Testing

### Unit Tests

| Test File                        | Coverage | Focus                                           |
| -------------------------------- | -------- | ----------------------------------------------- |
| `roastPromptTemplate.test.js`    | 85%      | Template building, sanitization, categorization |
| `roastGeneratorEnhanced.test.js` | 75%      | Basic/advanced generation, RQC integration      |
| `roastEngine.test.js`            | 70%      | Auto-approve flow, retry logic, metadata        |
| `csvRoastService.test.js`        | 90%      | Similarity matching, reference loading          |

### Integration Tests

| Test File                      | Focus                                                                     | Status           |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------- |
| `multiTenantWorkflow.test.js`  | End-to-end roast generation with cost control                             | ✅ Passing       |
| `rqc-integration.test.js`      | RQC review process and decision flow                                      | ✅ Passing       |
| `generation-issue-409.test.js` | **Issue #409** - Tone enforcement + 2 initial variants + 1 post-selection | ✅ 15/15 passing |

### Test Utilities

```javascript
// Using Jest moduleNameMapper alias
const { createMockRoastConfig } = require('@tests/utils/sharedMocks');

const mockConfig = createMockRoastConfig({
  plan: 'pro',
  rqc_enabled: true,
  intensity_level: 3
});
```

### E2E Tests (Issue #419)

**Test Suite:** [`tests/e2e/manual-approval-resilience.spec.js`](../../tests/e2e/manual-approval-resilience.spec.js)

**Frontend Implementation:** [`public/js/manual-approval.js`](../../public/js/manual-approval.js)

**Backend Error Handling:** [`src/routes/approval.js`](../../src/routes/approval.js)

| Test File                            | Focus                                  | Tests | Status         |
| ------------------------------------ | -------------------------------------- | ----- | -------------- |
| `manual-approval-resilience.spec.js` | UI resilience for manual approval flow | 17    | ✅ Implemented |

**Test Coverage:**

- AC #1: Timeout handling (3 tests) - 30s timeout, retry, no hanging
- AC #2: Network error handling (4 tests) - approval, variant, rejection, transient recovery
- AC #3: Variant exhaustion (3 tests) - 429 handling, approval/rejection still available
- AC #4: Error messages (3 tests) - clear messages, no sensitive data, actionable guidance
- AC #5: Retry functionality (4 tests) - conditional retry, no duplication

**Infrastructure:**

- Playwright E2E framework with Chromium browser
- Mock server pattern for API simulation
- Screenshot/video capture on failure
- CI/CD integration via GitHub Actions

**Configuration:** `playwright.config.js` - 30s timeout, retry: 1, screenshots on failure

## Feature Flags

| Flag                      | Default | Purpose                                       |
| ------------------------- | ------- | --------------------------------------------- |
| `ROAST_VERSIONS_MULTIPLE` | OFF     | Enable 2-version generation                   |
| `ENABLE_RQC`              | ON      | Enable advanced RQC system                    |
| `ENABLE_CUSTOM_PROMPT`    | OFF     | Allow custom style prompts (admin-configured) |
| `ENABLE_GPT5_DETECTION`   | ON      | Auto-detect and use GPT-5                     |

## Error Handling

### Common Errors

| Error                            | Cause                  | Resolution                       |
| -------------------------------- | ---------------------- | -------------------------------- |
| `OPENAI_API_KEY not found`       | Missing API key        | Use mock mode fallback           |
| `Comment exceeds maximum length` | Comment > 2000 chars   | Return validation error          |
| `RQC all attempts failed`        | Quality too low        | Return safe fallback roast       |
| `Transparency validation failed` | Disclaimer not applied | Block publication, log to Sentry |
| `User config not found`          | Database error         | Use default config               |

### Error Codes (Issue #419)

**Backend Constants** (`src/routes/approval.js`):

```javascript
const ERROR_CODES = {
  TIMEOUT: 'E_TIMEOUT',
  NETWORK_ERROR: 'E_NETWORK',
  VARIANTS_EXHAUSTED: 'E_VARIANT_LIMIT',
  VALIDATION_ERROR: 'E_VALIDATION',
  SERVER_ERROR: 'E_SERVER'
};

const MAX_VARIANTS_PER_ROAST = 5;
```

**Frontend Error Handling** (`public/js/manual-approval.js`):

- Displays user-friendly error messages based on error code
- Implements retry logic for transient errors (E_TIMEOUT, E_NETWORK)
- Shows fallback UI when variants exhausted (E_VARIANT_LIMIT)
- Prevents retry for validation/server errors (E_VALIDATION, E_SERVER)

**OpenAI Client Configuration** (`src/services/roastGeneratorEnhanced.js`):

```javascript
const VARIANT_GENERATION_TIMEOUT = 30000; // 30 seconds

this.openai = new OpenAI({
  apiKey,
  timeout: VARIANT_GENERATION_TIMEOUT,
  maxRetries: 1
});
```

### Error Response Format

```javascript
{
  success: false,
  error: 'No pudimos generar el roast en este momento',
  details: 'OpenAI API timeout', // Only in development
  retries: 3,
  processingTimeMs: 5234
}
```

## Monitoring & Observability

### Logging

All roast generation events logged with:

- User ID and organization ID
- Plan and RQC status
- Processing time and token usage
- Method (basic_moderation, advanced_rqc, fallback)
- Errors and retry attempts

### Metrics to Track

- **Generation success rate** - % successful generations
- **Average processing time** - Median time per roast
- **RQC approval rate** - % roasts approved by RQC
- **Fallback rate** - % roasts using fallback
- **Transparency compliance** - % auto-approved roasts with valid transparency

### Alerting

- Alert when fallback rate > 20%
- Alert when transparency validation fails > 5%
- Alert when average processing time > 10 seconds

## Future Enhancements

- [ ] Multi-language support (French, German, Italian)
- [ ] User-uploadable reference roasts
- [ ] A/B testing for prompt templates
- [ ] Real-time roast quality scoring
- [ ] Advanced RQC with human-in-the-loop
- [ ] Platform-specific style guides
- [ ] Sentiment analysis integration

---

## Brand Safety Integration (Issue #859)

### Overview

Brand Safety allows Plus plan users to configure sponsors/brands to protect from offensive comments with **defensive roasts**. When a comment mentions a configured sponsor and contains toxicity, the roast generation system applies tone overrides and includes sponsor context in the prompt to generate appropriate responses.

### Cacheable Prompt Structure

The RoastPromptBuilder uses OpenAI's Prompt Caching with three blocks:

**Block A (System):** Core identity, rules, and style guides (cacheable, rarely changes)

**Block B (User):** User's persona + **sponsor list** (cacheable per user, changes when persona or sponsors update)

- Includes all configured sponsors with their protection rules
- General defensive instructions for sponsor mentions
- Cached separately per user for efficiency

**Block C (Dynamic):** Current comment + toxicity data + **sponsor match** (non-cacheable, changes per comment)

- Specific details if a sponsor match is detected
- Sponsor-specific tone instructions
- Fresh context for each roast generation

### Sponsor Context in Prompts

When a user has configured sponsors, Block B includes:

```
PROTECTED BRANDS & SPONSORS:

You are protecting the following brands/sponsors from offensive comments:

1. Nike (priority: 1, severity: high)
   - Tags: sportswear, athletics, sneakers, shoes
   - Tone override: professional
   - Actions: hide_comment, def_roast

2. Adidas (priority: 2, severity: medium)
   - Tags: sportswear, training, apparel
   - Tone override: light_humor
   - Actions: def_roast

If a comment offensively mentions any of these brands:
- Generate a DEFENSIVE roast that protects the brand's reputation
- Use the specified tone override (not your default tone)
- Be witty but measured, never agree with the toxicity
- Redirect criticism to the commenter's ignorance or lack of taste
```

When a specific sponsor match is detected, Block C includes:

```
⚠️ SPONSOR MATCH DETECTED: Nike

This comment offensively mentions Nike, one of your protected sponsors.

- Match type: exact (brand name directly mentioned)
- Severity: high
- Tone override: professional (use measured, diplomatic tone)
- Actions: def_roast (generate defensive roast)

INSTRUCTIONS:
1. DO NOT agree with the toxic comment about Nike
2. Generate a professional, measured roast defending Nike's reputation
3. Redirect the criticism to the commenter (their ignorance, poor taste, etc.)
4. Keep it witty but diplomatic - no aggressive humor
5. Focus on facts and Nike's actual quality/reputation
```

### Sponsor Tone Mapping

The tone override system allows sponsors to specify how roasts should be generated when defending them:

| Tone               | Description                   | Roast Style                            | Example                                                                                                                                                              |
| ------------------ | ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normal`           | User's default tone           | As configured in persona               | No override, use default                                                                                                                                             |
| `professional`     | Measured, no aggressive humor | Diplomatic, factual, measured          | "Interesting take on Nike. Perhaps you'd benefit from researching their innovation history before making such sweeping claims?"                                      |
| `light_humor`      | Lighthearted, desenfadado     | Playful, non-confrontational, friendly | "Ah yes, Nike is 'terrible' - that's why they're only worn by... _checks notes_ ...millions of satisfied athletes worldwide 😊"                                      |
| `aggressive_irony` | Marked irony, direct sarcasm  | Sharp, cutting, ironic                 | "Oh absolutely, Nike is a 'scam'. I'm sure your expert fashion analysis from the depths of your mom's basement is far more credible than decades of global success." |

### Integration Flow

1. **Job Payload** (from AnalyzeToxicityWorker)

   ```json
   {
     "comment_id": "...",
     "original_text": "Nike is a scam brand",
     "toxicity_score": 0.65,
     "brand_safety": {
       "sponsor": "Nike",
       "tone": "professional",
       "defensive_roast": true
     }
   }
   ```

2. **GenerateReplyWorker** receives payload and extracts `brand_safety`

3. **buildPrompt** called with `brand_safety` parameter:

   ```javascript
   systemPrompt = await this.promptTemplate.buildPrompt({
     originalComment: originalText,
     toxicityData: { score, severity, categories },
     userConfig,
     includeReferences: true,
     brand_safety // ← Passed to prompt builder
   });
   ```

4. **RoastPromptBuilder** includes sponsor context in blocks:
   - Block B: All sponsors (if any configured)
   - Block C: Specific match details (if match detected)

5. **OpenAI generates roast** with:
   - Tone override applied (professional, light_humor, etc.)
   - Defensive framing (protect sponsor, redirect to commenter)
   - Sponsor context from cacheable blocks

### Example Roast Generation

**Input:**

- Comment: "Nike is a scam brand, terrible quality"
- Sponsor: Nike (severity: high, tone: professional, priority: 1)
- Toxicity: 0.65

**Prompt (Block C excerpt):**

```
⚠️ SPONSOR MATCH DETECTED: Nike
Tone override: professional

Generate a professional, measured roast defending Nike's reputation.
Focus on facts, use diplomatic language, redirect criticism to commenter.
```

**Generated Roast:**

```
"Your assessment of Nike's quality is interesting, though it seems to overlook
their decades of innovation, partnerships with elite athletes, and industry-leading
R&D. Perhaps exploring their actual product lines and customer satisfaction ratings
might offer a more balanced perspective than sweeping generalizations?"
```

### Metadata Tracking

Roast decisions with Brand Safety include metadata for analytics:

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

This allows tracking:

- Which sponsors trigger roasts most frequently
- Effectiveness of tone overrides
- User engagement with defensive roasts

### API Access

Sponsors are managed via REST API (Plus plan required):

- `POST /api/sponsors` - Create sponsor
- `GET /api/sponsors` - List sponsors
- `PUT /api/sponsors/:id` - Update sponsor (including tone overrides)
- `DELETE /api/sponsors/:id` - Delete sponsor

See `shield.md` for full Brand Safety documentation.

---

## Input Validation (Issue #946)

### Zod Schema Validation

**Implementation:** Issue #946 migrated roast endpoint validation from manual checks to Zod schemas for improved type safety and error messages.

**Benefits:**
- ✅ Declarative validation schemas
- ✅ Automatic type inference
- ✅ Better error messages with field-level details
- ✅ Consistent validation across all endpoints
- ✅ Easier to maintain and extend

**Schema Location:** `src/validators/zod/roast.schema.js`

**Middleware:** `src/middleware/zodValidation.js`

### Validated Endpoints

| Endpoint | Schema | Fields Validated |
|----------|--------|------------------|
| `POST /preview` | `roastPreviewSchema` | text, tone, styleProfile, persona, platform |
| `POST /generate` | `roastGenerateSchema` | text, tone |
| `POST /engine` | `roastEngineSchema` | comment, style, language, autoApprove, platform, commentId |
| `POST /:id/validate` | `roastValidateSchema` | text, platform |

### Validation Rules

**Text:**
- Required: `string`
- Min length: 1 character
- Max length: 2000 characters
- Transformation: automatic trim

**Tone/Style:**
- Required: `enum`
- Valid values: `Flanders`, `Balanceado`, `Canalla` (canonical form)
- Default: `Balanceado`

**Platform:**
- Required: `enum`
- Valid values: `twitter`, `facebook`, `instagram`, `youtube`, etc.
- Default: `twitter`
- Supports normalization (e.g., `X` → `twitter`)

**Language:**
- Required: `enum`
- Valid values: `es`, `en`
- Default: `es`
- Supports BCP-47 normalization

**Auto-Approve:**
- Optional: `boolean`
- Default: `false`

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "text",
      "message": "Text cannot be empty",
      "code": "too_small"
    }
  ],
  "timestamp": "2025-11-23T..."
}
```

**Error Details:**
- `field`: dot-notation path to invalid field (e.g., `user.email`)
- `message`: human-readable error message
- `code`: Zod error code for programmatic handling

### Testing

**Unit Tests:** 
- Schemas: `tests/unit/validators/zod/roast.schema.test.js` (43 tests ✅)
- Middleware: `tests/unit/middleware/zodValidation.test.js` (22 tests ✅)

**Integration Tests:**
- Endpoint validation: `tests/integration/roast.test.js` (8 tests ✅)

**Coverage:** 100% for Zod validation layer

---

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer**
- **Documentation Agent**
- **Front-end Dev** (Issue #419 - Manual approval UI)
- **Guardian** (PR #640 - Validated Fallback Mode documentation)
- **Orchestrator**
- **Test Engineer** (Issue #419 - E2E resilience tests, Issue #924 - middleware tests, Issue #946 - Zod validation tests)

## Related Nodes

- **persona** - User personality configuration and style preferences
- **tone** - Tone mapping system for humor type and intensity
- **platform-constraints** - Character limits and platform-specific rules
- **shield** - Post-generation safety validation and actions
- **cost-control** - Usage tracking and billing enforcement

---

**Maintained by:** Backend Developer
**Review Frequency:** Bi-weekly or on major feature changes
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0
