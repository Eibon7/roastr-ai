# Roast Generation System

**Node ID:** `roast`
**Owner:** Backend Developer
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-10-13
**Coverage:** 0%
**Coverage Source:** auto
**Related PRs:** #499
**Protected:** true
**Last Verified:** 2025-10-10
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
RoastEngine.generateRoast()
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

### Component Files

| File | Path | Purpose |
|------|------|---------|
| **RoastEngine** | `src/services/roastEngine.js` | Main orchestrator with auto-approve logic |
| **RoastGeneratorEnhanced** | `src/services/roastGeneratorEnhanced.js` | Enhanced generation with RQC integration |
| **RoastPromptTemplate** | `src/services/roastPromptTemplate.js` | Master prompt template system |
| **CsvRoastService** | `src/services/csvRoastService.js` | Reference roast database |
| **RQCService** | `src/services/rqcService.js` | Roast Quality Control (3 parallel reviewers) |

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

| Reviewer | Role | Validation |
|----------|------|-----------|
| **Moderator** | Content safety and platform policies | No hate speech, violence, discrimination |
| **Comedian** | Humor quality and creativity | Clever, original, not lazy or obvious |
| **Style Expert** | Brand voice and user preferences | Matches user tone, intensity level, custom prompts |

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

## Voice Styles (SPEC 7)

**Feature:** Predefined voice styles per language
**Implementation:** `RoastEngine.voiceStyles`

### Spanish (ES)

| Style | Name | Description | Intensity |
|-------|------|-------------|-----------|
| `flanders` | Flanders | Tono amable pero con ironía sutil | 2/5 |
| `balanceado` | Balanceado | Equilibrio entre ingenio y firmeza | 3/5 |
| `canalla` | Canalla | Directo y sin filtros, más picante | 4/5 |

### English (EN)

| Style | Name | Description | Intensity |
|-------|------|-------------|-----------|
| `light` | Light | Gentle wit with subtle irony | 2/5 |
| `balanced` | Balanced | Perfect mix of humor and firmness | 3/5 |
| `savage` | Savage | Direct and unfiltered, maximum impact | 4/5 |

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

| Mode | Description | Example |
|------|-------------|---------|
| `signature` | AI signature in bio | "Roasts generados por IA" in profile |
| `inline` | Inline disclaimer | "✨ Cortesía de tu asistente anti-trolls" |
| `hidden` | No transparency (Creator+ only) | - |

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

| Scenario | Action |
|----------|--------|
| OpenAI API timeout | Retry with delay |
| Rate limit error | Retry with longer delay |
| Network error | Retry up to max attempts |
| Validation error | No retry, return error |
| Max attempts reached | Return fallback roast |

### Fallback Roast

When all retries fail:
1. Attempt safe fallback prompt (low temperature, strict safety)
2. If fallback fails, use mock generator
3. If mock fails, return static roast: "😉 Tomo nota, pero hoy prefiero mantener la clase."

## Metadata Persistence (GDPR Compliant)

**Table:** `roasts_metadata`
**Storage:** Only metadata, NO roast content stored

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique roast identifier |
| `user_id` | uuid | User who generated roast |
| `org_id` | uuid | Organization (multi-tenant) |
| `platform` | string | Social platform (twitter, youtube, etc.) |
| `comment_id` | string | Original comment identifier |
| `style` | string | Voice style used |
| `language` | string | Language (es, en) |
| `versions_count` | int | Number of versions generated |
| `auto_approve` | boolean | Was auto-approve enabled |
| `transparency_applied` | boolean | Was transparency disclaimer applied |
| `status` | string | pending, auto_approved, published |
| `tokens_used` | int | Total tokens consumed |
| `method` | string | basic_moderation, advanced_rqc, fallback |
| `created_at` | timestamp | Generation timestamp |

**GDPR Compliance:**
- No roast text stored in database
- Only metadata for analytics and debugging
- Full data deletion on account deletion
- Transparent data usage in privacy policy

## Model Selection (GPT-5 Auto-Detection)

**Feature:** Automatic GPT-5 detection and usage (Issue #326)
**Service:** `src/services/modelAvailabilityService.js`

### Model Mapping by Plan

| Plan | Default Model | GPT-5 Available | Notes |
|------|---------------|-----------------|-------|
| Free | `gpt-3.5-turbo` | No | Basic quality |
| Starter | `gpt-4o` | Auto-detect | Good quality |
| Pro | `gpt-4o` | Auto-detect | High quality |
| Plus | `gpt-4o` | Auto-detect → `gpt-5` | Premium quality |
| Custom | `gpt-4o` | Auto-detect → `gpt-5` | Enterprise |

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

| Field | Description |
|-------|-------------|
| `comment` | Original toxic comment |
| `roast` | High-quality roast response |
| `category` | Comment category |
| `language` | Language (es, en) |

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

| Plan | References Included | Count |
|------|---------------------|-------|
| Free | ❌ No | 0 |
| Starter | ✅ Yes | 3 |
| Pro | ✅ Yes | 3 |
| Plus | ✅ Yes | 3-5 |
| Creator+ | ✅ Yes | 5 |

## API Usage Examples

### Basic Generation

```javascript
const roastEngine = new RoastEngine();

const result = await roastEngine.generateRoast(
  {
    comment: "Esta aplicación es horrible",
    toxicityScore: 0.7,
    commentId: "comment_123"
  },
  {
    userId: "user_uuid",
    orgId: "org_uuid",
    platform: "twitter",
    style: "balanceado",
    language: "es",
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
    commentId: "comment_456"
  },
  {
    userId: "user_uuid",
    autoApprove: true, // Enable auto-approve
    style: "savage",
    language: "en"
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

| Plan | Monthly Roasts | Approximate Cost |
|------|----------------|------------------|
| Free | 100 | $0 (subsidized) |
| Starter | 500 | $2-3 |
| Pro | 1,000 | $5-7 |
| Plus | Unlimited | Pay-as-you-go |

### Throttling

- Automatic throttling when approaching plan limits
- Hard limit enforcement at 100% usage
- Grace period: 10% overage allowed

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

## Platform Constraints Integration

**Dependency:** `platform-constraints` node
**Service:** `src/config/platforms.js`

### Character Limits

| Platform | Limit | Validation |
|----------|-------|-----------|
| Twitter | 280 | Hard limit |
| YouTube | 10,000 | Soft limit (recommend 500) |
| Instagram | 2,200 | Soft limit (recommend 500) |
| Facebook | 63,206 | Soft limit (recommend 1000) |
| Discord | 2,000 | Hard limit |

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

| Test File | Coverage | Focus |
|-----------|----------|-------|
| `roastPromptTemplate.test.js` | 85% | Template building, sanitization, categorization |
| `roastGeneratorEnhanced.test.js` | 75% | Basic/advanced generation, RQC integration |
| `roastEngine.test.js` | 70% | Auto-approve flow, retry logic, metadata |
| `csvRoastService.test.js` | 90% | Similarity matching, reference loading |

### Integration Tests

| Test File | Focus | Status |
|-----------|-------|--------|
| `multiTenantWorkflow.test.js` | End-to-end roast generation with cost control | ✅ Passing |
| `rqc-integration.test.js` | RQC review process and decision flow | ✅ Passing |
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

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `ROAST_VERSIONS_MULTIPLE` | OFF | Enable 2-version generation |
| `ENABLE_RQC` | ON | Enable advanced RQC system |
| `ENABLE_CUSTOM_PROMPT` | OFF | Allow custom style prompts (admin-configured) |
| `ENABLE_GPT5_DETECTION` | ON | Auto-detect and use GPT-5 |

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `OPENAI_API_KEY not found` | Missing API key | Use mock mode fallback |
| `Comment exceeds maximum length` | Comment > 2000 chars | Return validation error |
| `RQC all attempts failed` | Quality too low | Return safe fallback roast |
| `Transparency validation failed` | Disclaimer not applied | Block publication, log to Sentry |
| `User config not found` | Database error | Use default config |

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

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer**
- **Documentation Agent**
- **Orchestrator**
- **Test Engineer**


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
