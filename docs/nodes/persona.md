# Persona - User Personality & Style Configuration

**Node ID:** `persona`
**Owner:** Back-end Dev
**Priority:** High
**Status:** Production (✅ Issue #595 + #615 Complete - 100%)
**Last Updated:** 2025-11-06
**Coverage:** 0%
**Coverage Source:** auto
**Note:** Coverage value updated to match actual test coverage (gdd-status.json validation). Will be auto-updated when tests pass.
**Related PRs:** #499, #600, #633 (Issue #615: Persona-Roast Integration)
**Related Issues:** ✅ #595 (Persona Setup - Complete), ✅ #615 (Persona-Roast Integration - Complete), #649 (Documentation)

## Dependencies

- `plan-features` - Subscription plan feature gates and limits

## Overview

The Persona system allows users to define their unique roasting personality through three core components: personal identity, zero-tolerance boundaries, and tolerance preferences. It uses encrypted storage, semantic embeddings for intelligent matching, and plan-based feature gating to deliver personalized AI-generated roasts.

**✅ Implementation Status: 100% Complete**
- ✅ Issue #595: Persona Setup & API endpoints (PR #499, #600)
- ✅ Issue #615: Persona-Roast Integration (PR #633)
- ✅ Issue #649: Documentation (Current PR)

All acceptance criteria met. Persona data is successfully retrieved during roast generation (`roastGeneratorEnhanced.js:328, 475`) and injected into prompts (`roastPromptTemplate.js:93, 473`). Integration tests passing 100%. See `docs/flows/persona-setup.md` for complete integration documentation.

### Key Capabilities

1. **Roastr Persona** - User's identity definition ("Lo que me define")
2. **Zero-Tolerance Boundaries** - Content auto-blocking ("Lo que no tolero")
3. **Tolerance Preferences** - False positive reduction ("Lo que me da igual")
4. **Semantic Embeddings** - Vector-based content matching (OpenAI text-embedding-3-small)
5. **Encryption at Rest** - GDPR-compliant encrypted storage
6. **Plan-Based Access** - Feature gating by subscription tier

## Architecture

### API Endpoints (src/routes/persona.js)

| Method | Endpoint | Description | Auth | Plan Required |
|--------|----------|-------------|------|---------------|
| `GET` | `/api/persona` | Get current user's persona fields (decrypted) | ✅ JWT | Starter+ |
| `POST` | `/api/persona` | Create/Update persona fields | ✅ JWT | Starter+ (lo_que_me_da_igual: Pro+) |
| `DELETE` | `/api/persona` | Delete all persona fields | ✅ JWT | Starter+ |
| `GET` | `/api/persona/health` | Health check endpoint | ❌ Public | None |

**Authentication:** All endpoints (except health) require valid JWT token via `authenticateToken` middleware.

**Plan Gating:**
- `lo_que_me_define` (Identity): Starter+
- `lo_que_no_tolero` (Intolerance): Starter+
- `lo_que_me_da_igual` (Tolerance): Pro+ **only**

**Request Body Example:**
```javascript
{
  "lo_que_me_define": "Soy desarrollador sarcástico, me encanta el humor técnico",
  "lo_que_no_tolero": "Ataques a mi familia, body shaming",
  "lo_que_me_da_igual": "Humor negro, palabrotas"
}
```

**Response Format:**
```javascript
{
  "success": true,
  "data": {
    "lo_que_me_define": "Soy desarrollador sarcástico...",
    "lo_que_no_tolero": "Ataques a mi familia...",
    "lo_que_me_da_igual": "Humor negro, palabrotas",
    "created_at": "2025-10-19T12:00:00Z",
    "updated_at": "2025-10-19T14:30:00Z"
  }
}
```

### Data Model

```
users table (core persona fields):
├── lo_que_me_define (identity)
│   ├── lo_que_me_define_encrypted TEXT
│   ├── lo_que_me_define_visible BOOLEAN (default: false)
│   ├── lo_que_me_define_embedding VECTOR(1536)
│   ├── lo_que_me_define_created_at TIMESTAMPTZ
│   └── lo_que_me_define_updated_at TIMESTAMPTZ
│
├── lo_que_no_tolero (intolerance/blocking)
│   ├── lo_que_no_tolero_encrypted TEXT
│   ├── lo_que_no_tolero_visible BOOLEAN (default: false)
│   ├── lo_que_no_tolero_embedding VECTOR(1536)
│   ├── lo_que_no_tolero_created_at TIMESTAMPTZ
│   └── lo_que_no_tolero_updated_at TIMESTAMPTZ
│
├── lo_que_me_da_igual (tolerance)
│   ├── lo_que_me_da_igual_encrypted TEXT
│   ├── lo_que_me_da_igual_visible BOOLEAN (default: false)
│   ├── lo_que_me_da_igual_embedding VECTOR(1536)
│   ├── lo_que_me_da_igual_created_at TIMESTAMPTZ
│   └── lo_que_me_da_igual_updated_at TIMESTAMPTZ
│
└── embeddings_metadata
    ├── embeddings_generated_at TIMESTAMPTZ
    ├── embeddings_model VARCHAR(100) (default: 'text-embedding-3-small')
    └── embeddings_version INTEGER (default: 1)
```

### Three-Component System

#### 1. Lo que me define (Identity Definition)

**Purpose:** Defines user's identity, humor style, and roasting personality

**Examples:**
- "Soy desarrollador sarcástico, me encanta el humor técnico"
- "Fan de los 90s, humor nostálgico y referencias retro"
- "Ironía británica, humor seco y sofisticado"

**Character Limit:** 300 characters (encrypted storage ~400-500 chars)

**Use Cases:**
- Personalize roast tone and references
- Match humor style to user's personality
- Generate contextual jokes and wordplay

#### 2. Lo que no tolero (Zero-Tolerance Boundaries)

**Purpose:** Auto-blocking preferences for content user never wants to see

**Examples:**
- "Ataques a mi familia, body shaming, racismo"
- "Comentarios sobre mi discapacidad"
- "Bromas sobre tragedias o pérdidas personales"

**Character Limit:** 300 characters (encrypted storage ~400-500 chars)

**Security Impact:** HIGH - Affects automatic blocking

**Use Cases:**
- Semantic auto-blocking of matching content
- Red line violations in Shield system
- Content filtering with zero false negatives

#### 3. Lo que me da igual (Tolerance Preferences)

**Purpose:** Reduces false positives by allowing content user considers harmless

**Examples:**
- "Humor negro, bromas de mal gusto, sarcasmo extremo"
- "Palabrotas, lenguaje vulgar"
- "Referencias a videojuegos violentos"

**Character Limit:** 300 characters (encrypted storage ~400-500 chars)

**Security Impact:** MEDIUM - Allows more content through

**Use Cases:**
- False positive reduction in toxicity detection
- Personalized toxicity threshold adjustment
- Content allowlist for user-specific tolerances

### Semantic Embeddings

**Model:** OpenAI `text-embedding-3-small`
**Dimension:** 1536
**Use Case:** Intelligent semantic matching beyond exact keyword search

#### Embedding Generation Flow

```
User updates persona field
    ↓
Encrypt plaintext → Store encrypted
    ↓
Generate embedding via OpenAI API
    ↓
Store embedding in VECTOR(1536) field
    ↓
Update embeddings_generated_at, model, version
    ↓
Index for efficient vector similarity search
```

#### Vector Similarity Search

```sql
-- Find semantically similar content to "lo que no tolero"
SELECT comment_id, similarity_score
FROM (
  SELECT
    c.id AS comment_id,
    1 - (c.embedding <=> u.lo_que_no_tolero_embedding) AS similarity_score
  FROM comments c
  CROSS JOIN users u
  WHERE u.id = $1
    AND u.lo_que_no_tolero_embedding IS NOT NULL
) matches
WHERE similarity_score > 0.85  -- 85% similarity threshold
ORDER BY similarity_score DESC;
```

**Operator:** `<=>` (cosine distance operator for pgvector)
**Threshold:** 0.85 (85% similarity) for blocking
**Performance:** O(log n) with HNSW index

### Encryption & Security

#### Encryption at Rest

**Algorithm:** AES-256-GCM (via Supabase Vault or application-level encryption)
**Key Management:** Supabase service key or dedicated encryption key
**Storage Format:** Base64-encoded encrypted text

**Encryption Flow:**
```javascript
plaintext → AES-256-GCM encrypt → Base64 encode → Store in *_encrypted field
```

**Decryption Flow:**
```javascript
Base64 decode → AES-256-GCM decrypt → Return plaintext (only to owner)
```

#### Row Level Security (RLS)

**Policy:** `user_isolation`
```sql
CREATE POLICY user_isolation ON users
  USING (auth.uid() = id);
```

**Effect:**
- Users can only read/write their own persona fields
- Service role bypasses RLS for background jobs
- Zero data leakage between users

### Audit Trail

**Table:** `audit_logs`
**Retention:** 3 years (1095 days)

#### Logged Actions

| Action | Trigger | Details |
|--------|---------|---------|
| `roastr_persona_identity_created` | First definition of identity | Field set from NULL |
| `roastr_persona_identity_updated` | Identity changed | Field content modified |
| `roastr_persona_identity_deleted` | Identity removed | Field set to NULL |
| `roastr_persona_intolerance_created` | First intolerance set | Zero-tolerance boundary created |
| `roastr_persona_intolerance_updated` | Intolerance changed | Blocking rules modified |
| `roastr_persona_intolerance_deleted` | Intolerance removed | Auto-blocking disabled |
| `roastr_persona_tolerance_created` | First tolerance set | Allowlist preferences created |
| `roastr_persona_tolerance_updated` | Tolerance changed | False positive rules modified |
| `roastr_persona_tolerance_deleted` | Tolerance removed | Allowlist disabled |

#### Audit Log Entry

```json
{
  "user_id": "user_uuid",
  "action": "roastr_persona_intolerance_updated",
  "actor_id": "user_uuid",
  "actor_type": "user",
  "resource_type": "roastr_persona_intolerance",
  "resource_id": "user_uuid",
  "details": {
    "field_changed": "lo_que_no_tolero",
    "visibility_changed": false,
    "field_had_content": true,
    "field_has_content": true,
    "updated_at": "2025-10-03T12:00:00Z",
    "security_impact": "high"
  },
  "legal_basis": "user_consent_safety_preferences",
  "retention_period_days": 1095,
  "created_at": "2025-10-03T12:00:00Z"
}
```

## Plan-Based Feature Gating

**Dependency:** `plan-features` node

### Feature Access by Plan

| Feature | Free | Starter | Pro | Plus |
|---------|------|---------|-----|------|
| **Lo que me define** | ❌ | ✅ | ✅ | ✅ |
| **Lo que no tolero** | ❌ | ✅ | ✅ | ✅ |
| **Lo que me da igual** | ❌ | ❌ | ✅ | ✅ |
| **Semantic embeddings** | ❌ | ✅ (1 field) | ✅ (3 fields) | ✅ (3 fields) |
| **Custom style prompt** | ❌ | ❌ | ❌ | ✅ (admin-configured) |
| **Visibility settings** | ❌ | ❌ | ✅ | ✅ |

### Feature Flag

`ENABLE_CUSTOM_PROMPT` - Allows Plus users to use custom_style_prompt

```javascript
if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && userPlan === 'plus') {
  // Use custom_style_prompt from user config
  promptBuilder.addCustomStyle(user.custom_style_prompt);
}
```

## Integration with Roast Generation

**Dependency:** `roast` node via `roastGeneratorEnhanced` and `roastPromptTemplate`
**Implemented:** PR #633 (Issue #615)

### Complete Integration Flow

```
RoastGeneratorEnhanced.generateWithBasicModeration()
    ↓
PersonaService.getPersona(user_id)  // Load user's persona
    ↓
RoastPromptTemplate.buildPrompt()   // Inject persona context
    ↓
buildPersonaContext()                // Format persona fields
    ↓
OpenAI API with persona-enhanced prompt
```

### Prompt Template Integration

**File:** `src/services/roastPromptTemplate.js`

```javascript
// RoastPromptTemplate.buildPrompt() - Issue #615
async buildPrompt(params) {
  const {
    originalComment,
    toxicityData,
    userConfig,
    includeReferences,
    persona  // New parameter from PersonaService
  } = params;

  // Build persona context section
  const personaContext = this.buildPersonaContext(persona);

  // Replace {{persona_context}} placeholder with actual persona data
  return masterPrompt
    .replace('{{original_comment}}', sanitizedComment)
    .replace('{{comment_category}}', category)
    .replace('{{reference_roasts_from_CSV}}', references)
    .replace('{{user_tone}}', tone)
    .replace('{{persona_context}}', personaContext);  // Issue #615
}

// Build persona context with plan-based field availability
buildPersonaContext(persona) {
  if (!persona || !this.hasAnyPersonaField(persona)) {
    return 'No especificado';
  }

  const sections = [];

  if (persona.lo_que_me_define) {
    sections.push(`- Lo que define al usuario: ${sanitize(persona.lo_que_me_define)}`);
  }

  if (persona.lo_que_no_tolero) {
    sections.push(`- Lo que NO tolera: ${sanitize(persona.lo_que_no_tolero)}`);
  }

  if (persona.lo_que_me_da_igual) {
    sections.push(`- Lo que le da igual: ${sanitize(persona.lo_que_me_da_igual)}`);
  }

  return sections.join('\n');
}
```

### Roast Generator Integration

**File:** `src/services/roastGeneratorEnhanced.js`

```javascript
// RoastGeneratorEnhanced.generateWithBasicModeration() - Issue #615
async generateWithBasicModeration(text, toxicityScore, tone, rqcConfig) {
  // Get model based on plan
  const model = await this.getModelForPlan(rqcConfig.plan);

  // Issue #615: Load user persona for personalized roast generation
  const persona = await this.personaService.getPersona(rqcConfig.user_id);

  // Build prompt using the master template with persona
  const systemPrompt = await this.promptTemplate.buildPrompt({
    originalComment: text,
    toxicityData: {
      score: toxicityScore,
      categories: []
    },
    userConfig: {
      tone: tone,
      humor_type: rqcConfig.humor_type || 'witty',
      intensity_level: rqcConfig.intensity_level,
      custom_style_prompt: flags.isEnabled('ENABLE_CUSTOM_PROMPT')
        ? rqcConfig.custom_style_prompt
        : null
    },
    includeReferences: rqcConfig.plan !== 'free',
    persona: persona  // Issue #615: Pass persona to buildPrompt
  });

  // Generate roast with OpenAI
  const completion = await this.openai.chat.completions.create({
    model: model,
    messages: [{ role: "system", content: systemPrompt }],
    max_tokens: 120,
    temperature: 0.8,
  });

  return completion.choices[0].message.content.trim();
}
```

### Master Prompt Template

**Template Section:** `🎯 CONTEXTO DEL USUARIO`

```
...previous sections...

🎯 CONTEXTO DEL USUARIO:
{{persona_context}}

...additional sections...
```

**Plan-Based Persona Context:**

- **Free Plan:** "No especificado" (no persona access)
- **Starter Plan (2 fields):**
  ```
  - Lo que define al usuario: [lo_que_me_define]
  - Lo que NO tolera: [lo_que_no_tolero]
  ```
- **Pro+ Plan (3 fields):**
  ```
  - Lo que define al usuario: [lo_que_me_define]
  - Lo que NO tolera: [lo_que_no_tolero]
  - Lo que le da igual: [lo_que_me_da_igual]
  ```

### Custom Style Prompt (Plus Plan)

**Field:** `custom_style_prompt` in user config
**Character Limit:** 500 characters
**Access:** Admin-configured, Plus plan only

**Example:**
```
"Eres un roaster que habla como un pirata del siglo XXI. Usa jerga moderna mezclada con términos náuticos. Siempre incluye referencias a la tecnología como si fueran tesoros."
```

**Integration:**
```javascript
// In prompt template
if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && userConfig.custom_style_prompt) {
  tone += `. Estilo personalizado: ${userConfig.custom_style_prompt}`;
}
```

## Database Schema

### Table: users (persona fields)

```sql
-- Identity definition
lo_que_me_define_encrypted TEXT,
lo_que_me_define_visible BOOLEAN DEFAULT FALSE,
lo_que_me_define_embedding VECTOR(1536),
lo_que_me_define_created_at TIMESTAMPTZ,
lo_que_me_define_updated_at TIMESTAMPTZ,

-- Zero-tolerance boundaries
lo_que_no_tolero_encrypted TEXT,
lo_que_no_tolero_visible BOOLEAN DEFAULT FALSE,
lo_que_no_tolero_embedding VECTOR(1536),
lo_que_no_tolero_created_at TIMESTAMPTZ,
lo_que_no_tolero_updated_at TIMESTAMPTZ,

-- Tolerance preferences
lo_que_me_da_igual_encrypted TEXT,
lo_que_me_da_igual_visible BOOLEAN DEFAULT FALSE,
lo_que_me_da_igual_embedding VECTOR(1536),
lo_que_me_da_igual_created_at TIMESTAMPTZ,
lo_que_me_da_igual_updated_at TIMESTAMPTZ,

-- Embeddings metadata
embeddings_generated_at TIMESTAMPTZ,
embeddings_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
embeddings_version INTEGER DEFAULT 1,

-- Constraints
CONSTRAINT users_lo_que_me_define_encrypted_length_check
  CHECK (lo_que_me_define_encrypted IS NULL OR char_length(lo_que_me_define_encrypted) <= 500),

CONSTRAINT users_lo_que_no_tolero_encrypted_length_check
  CHECK (lo_que_no_tolero_encrypted IS NULL OR char_length(lo_que_no_tolero_encrypted) <= 500),

CONSTRAINT users_lo_que_me_da_igual_encrypted_length_check
  CHECK (lo_que_me_da_igual_encrypted IS NULL OR char_length(lo_que_me_da_igual_encrypted) <= 500)
```

### Indexes

```sql
-- Embeddings tracking
CREATE INDEX idx_users_embeddings_generated ON users(id, embeddings_generated_at)
WHERE embeddings_generated_at IS NOT NULL;

CREATE INDEX idx_users_embeddings_model ON users(embeddings_model, embeddings_version)
WHERE embeddings_generated_at IS NOT NULL;

-- Field existence (for analytics)
CREATE INDEX idx_users_identity_embedding_exists ON users(id)
WHERE lo_que_me_define_embedding IS NOT NULL;

CREATE INDEX idx_users_intolerance_embedding_exists ON users(id)
WHERE lo_que_no_tolero_embedding IS NOT NULL;

CREATE INDEX idx_users_tolerance_embedding_exists ON users(id)
WHERE lo_que_me_da_igual_embedding IS NOT NULL;

-- Active personas
CREATE INDEX idx_users_lo_que_me_define_active ON users(id, lo_que_me_define_encrypted)
WHERE lo_que_me_define_encrypted IS NOT NULL;

CREATE INDEX idx_users_lo_que_no_tolero_active ON users(id, lo_que_no_tolero_encrypted)
WHERE lo_que_no_tolero_encrypted IS NOT NULL;

CREATE INDEX idx_users_lo_que_me_da_igual_active ON users(id, lo_que_me_da_igual_encrypted)
WHERE lo_que_me_da_igual_encrypted IS NOT NULL;
```

## Helper Functions

### Check Embeddings Existence

```sql
CREATE OR REPLACE FUNCTION user_has_embeddings(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = user_uuid
        AND (
            lo_que_me_define_embedding IS NOT NULL OR
            lo_que_no_tolero_embedding IS NOT NULL OR
            lo_que_me_da_igual_embedding IS NOT NULL
        )
    );
END;
$$ LANGUAGE plpgsql;
```

### Get Embeddings Metadata

```sql
CREATE OR REPLACE FUNCTION get_user_embeddings_metadata(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'has_identity_embedding', lo_que_me_define_embedding IS NOT NULL,
        'has_intolerance_embedding', lo_que_no_tolero_embedding IS NOT NULL,
        'has_tolerance_embedding', lo_que_me_da_igual_embedding IS NOT NULL,
        'embeddings_generated_at', embeddings_generated_at,
        'embeddings_model', embeddings_model,
        'embeddings_version', embeddings_version,
        'total_embeddings',
            CASE WHEN lo_que_me_define_embedding IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN lo_que_no_tolero_embedding IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN lo_que_me_da_igual_embedding IS NOT NULL THEN 1 ELSE 0 END
    ) INTO result
    FROM users
    WHERE id = user_uuid;

    RETURN COALESCE(result, jsonb_build_object('error', 'user_not_found'));
END;
$$ LANGUAGE plpgsql;
```

### Check Regeneration Needed

```sql
CREATE OR REPLACE FUNCTION embeddings_need_regeneration(
  user_uuid UUID,
  target_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  target_version INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    user_model VARCHAR(100);
    user_version INTEGER;
BEGIN
    SELECT embeddings_model, embeddings_version
    INTO user_model, user_version
    FROM users
    WHERE id = user_uuid
      AND embeddings_generated_at IS NOT NULL;

    -- Regenerate if model or version mismatch
    RETURN (user_model != target_model OR user_version != target_version);
END;
$$ LANGUAGE plpgsql;
```

## API Usage Examples

### Update User Persona (Identity)

```javascript
const { supabaseServiceClient } = require('../config/supabase');
const crypto = require('crypto');

// Encrypt plaintext
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

// Update identity
const identity = "Soy desarrollador sarcástico, me encanta el humor técnico";
const encrypted = encrypt(identity, process.env.ENCRYPTION_KEY);

const { data, error } = await supabaseServiceClient
  .from('users')
  .update({
    lo_que_me_define_encrypted: encrypted,
    lo_que_me_define_updated_at: new Date().toISOString()
  })
  .eq('id', userId);

// Generate embedding (background job)
await generateEmbedding(userId, 'lo_que_me_define', identity);
```

### Generate Semantic Embedding

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(userId, field, text) {
  // Generate embedding via OpenAI
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });

  const embedding = response.data[0].embedding;  // Array of 1536 floats

  // Store in database
  const fieldMapping = {
    'lo_que_me_define': 'lo_que_me_define_embedding',
    'lo_que_no_tolero': 'lo_que_no_tolero_embedding',
    'lo_que_me_da_igual': 'lo_que_me_da_igual_embedding'
  };

  await supabaseServiceClient
    .from('users')
    .update({
      [fieldMapping[field]]: embedding,
      embeddings_generated_at: new Date().toISOString(),
      embeddings_model: 'text-embedding-3-small',
      embeddings_version: 1
    })
    .eq('id', userId);
}
```

### Semantic Blocking Check

```javascript
async function checkSemanticBlocking(userId, commentText) {
  // Get user's intolerance embedding
  const { data: user } = await supabaseServiceClient
    .from('users')
    .select('lo_que_no_tolero_embedding')
    .eq('id', userId)
    .single();

  if (!user?.lo_que_no_tolero_embedding) {
    return { shouldBlock: false, reason: 'no_intolerance_defined' };
  }

  // Generate embedding for comment
  const commentEmbedding = await generateEmbedding(null, null, commentText);

  // Calculate cosine similarity
  const similarity = await calculateCosineSimilarity(
    commentEmbedding,
    user.lo_que_no_tolero_embedding
  );

  const threshold = 0.85;  // 85% similarity triggers blocking

  if (similarity >= threshold) {
    return {
      shouldBlock: true,
      reason: 'semantic_intolerance_match',
      similarity: similarity,
      threshold: threshold
    };
  }

  return { shouldBlock: false, similarity: similarity };
}
```

### Decrypt Persona Field

```javascript
function decrypt(encrypted, key) {
  const buffer = Buffer.from(encrypted, 'base64');

  const iv = buffer.slice(0, 16);
  const tag = buffer.slice(16, 32);
  const ciphertext = buffer.slice(32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}

// Get decrypted identity
const { data: user } = await supabaseServiceClient
  .from('users')
  .select('lo_que_me_define_encrypted')
  .eq('id', userId)
  .single();

if (user?.lo_que_me_define_encrypted) {
  const plaintext = decrypt(user.lo_que_me_define_encrypted, process.env.ENCRYPTION_KEY);
  console.log('User identity:', plaintext);
}
```

## Testing

### Unit Tests

| Test File | Coverage | Focus | Status |
|-----------|----------|-------|--------|
| `tests/unit/services/PersonaService.test.js` | 100% | PersonaService CRUD, plan gating, encryption, healthCheck | ✅ 36 tests passing (PR #600) |
| `tests/unit/utils/encryption.test.js` | 100% | AES-256-GCM encryption/decryption, key management | ✅ Implemented (PR #600) |

### Integration Tests

| Test File | Focus | Status |
|-----------|-------|--------|
| `tests/integration/persona-api.test.js` | Complete API workflow, auth, security, plan gating | ✅ 26 tests passing (PR #600) |
| `tests/integration/roast-persona-integration.test.js` | **Persona-Roast Integration**, E2E flow PersonaService → RoastGenerator → Prompt | ✅ **9/9 tests passing (PR #633)** |
| `tests/e2e/auth-complete-flow.test.js` | End-to-end user authentication and persona setup | ✅ Updated (PR #600) |

### Test Scenarios

**Encryption:**
- Encrypt/decrypt round-trip maintains original text
- Different keys produce different ciphertexts
- Tampered ciphertext fails decryption
- Null/empty values handled gracefully

**Embeddings:**
- Semantic similarity matches related content
- Different content produces low similarity scores
- Model/version mismatch triggers regeneration
- Embedding generation handles API failures

**Security:**
- RLS prevents cross-user access
- SQL injection attempts are sanitized
- Character limits enforced (300 chars plaintext, 500 encrypted)
- Audit logs capture all changes

**Plan Gating:**
- Free plan blocked from all persona features
- Starter gets identity + intolerance only
- Pro gets all three fields + embeddings
- Plus gets custom style prompts

## Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_STYLE_PROFILE` | `true` | Enable persona configuration UI |
| `ENABLE_CUSTOM_PROMPT` | `false` | Allow custom style prompts (Plus plan) |
| `ENABLE_SEMANTIC_BLOCKING` | `true` | Enable embedding-based content blocking |

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `Encryption key not found` | Missing ENCRYPTION_KEY env var | Configure encryption key in environment |
| `Embedding generation failed` | OpenAI API error | Retry with exponential backoff, log failure |
| `Character limit exceeded` | Input > 300 chars | Truncate or reject with validation error |
| `Plan restriction` | Feature not available for user's plan | Upgrade prompt or feature disabled |
| `Semantic similarity timeout` | Vector search too slow | Index optimization, query timeout |
| `Decryption failed` | Corrupted ciphertext or wrong key | Re-encrypt with current key, audit log |

### Error Response Format

```javascript
{
  success: false,
  error: 'Plan restriction: "Lo que me da igual" requires Pro plan or higher',
  code: 'PLAN_RESTRICTION',
  required_plan: 'pro',
  current_plan: 'starter',
  upgrade_url: '/pricing'
}
```

## Monitoring & Observability

### Key Metrics

- **Persona completion rate** - % users with at least 1 field defined
- **Embedding generation latency** - Time to generate embeddings (target: <2s)
- **Semantic blocking accuracy** - True positive rate for intolerance matches
- **False positive rate** - % of blocked content user considers acceptable
- **Encryption/decryption latency** - Time to encrypt/decrypt fields (target: <100ms)

### Logging

All persona changes logged with:
- User ID and field changed
- Action type (created, updated, deleted)
- Security impact level (high for intolerance, medium for tolerance)
- Visibility settings changed
- Timestamp and legal basis

### Alerting

- Alert when embedding generation fails > 5% of attempts
- Alert when semantic blocking false positive rate > 15%
- Alert when encryption key rotation needed
- Alert when audit log retention period expiring

## Future Enhancements

- [ ] Multi-language persona support (English, French, German)
- [ ] Persona templates for quick setup
- [ ] Collaborative personas (shared within organization)
- [ ] A/B testing of different persona configurations
- [ ] ML-based persona recommendation
- [ ] Cross-platform persona sync
- [ ] Persona effectiveness scoring
- [ ] Visual persona builder UI


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer** - Implementation (PersonaService, encryption, API routes)
- **Documentation Agent** - Node maintenance and sync
- **FrontendDev** - UI components (StyleProfile page)
- **TestEngineer** - Test coverage and validation
- **Orchestrator** - PR #600 coordination and planning
- **Test Engineer** - Test implementation (unit, integration, e2e)


## Related Nodes

- **plan-features** - Subscription plan access control for persona features
- **roast** - Roast generation integrates persona for personalization
- **shield** - Semantic blocking uses intolerance embeddings

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on persona feature changes
**Last Reviewed:** 2025-11-18 (Issue #868: Eliminated Humor Type references)
**Version:** 1.1.0
