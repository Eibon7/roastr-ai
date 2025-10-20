# Implementation Plan: Issue #595 - Persona Setup Flow

**Issue:** #595
**Priority:** P1 (High)
**Estimate:** 3-4 days
**Status:** Planning Complete → Ready for Implementation

---

## Executive Summary

**Objective:** Implement complete Persona Setup Flow with 3 encrypted fields, OpenAI embeddings, and plan-based access control.

**Actual State (NOT 50%):**
- ✅ GDD documentation exists (docs/nodes/persona.md - 70% coverage)
- ❌ Database schema: 0% (NO persona fields exist)
- ❌ Service layer: 0% (PersonaService.js doesn't exist)
- ❌ API endpoints: 0% (/api/persona routes don't exist)
- ❌ Frontend: 0% (no UI components)
- ❌ Tests: 0%

**Reality Check:** This is a greenfield implementation (0% code exists), not a continuation from 50%.

**Scope:** Large - 6 new files, database migration, encryption + embeddings integration

---

## Current State Analysis

### Based on Assessment (docs/assessment/issue-595.md)

**What EXISTS:**
1. ✅ GDD node documentation (persona.md) - Comprehensive architecture spec
2. ✅ Authentication system (login/registration from Issue #593)
3. ✅ OpenAI SDK installed ("openai": "^4.77.3")
4. ✅ Cost control infrastructure (plan limits defined)
5. ✅ Supabase connection (database operational)

**What's MISSING:**
1. ❌ Database schema (users table lacks persona fields)
2. ❌ Encryption utilities (no crypto implementation)
3. ❌ PersonaService.js
4. ❌ API endpoints
5. ❌ OpenAI embeddings generation
6. ❌ Plan-based access middleware
7. ❌ Frontend UI (backend-only project, coordinate with frontend team)
8. ❌ Test suite

**Blockers Identified:**
- ⚠️ Payment integration status unclear (needed for plan-based access)
- ⚠️ pgvector extension verification needed (for embeddings)

---

## Architecture Decision: Schema Design

### Decision: Extend `users` table (NOT separate `user_personas` table)

**Rationale:**
- GDD node persona.md specifies fields in `users` table (lines 300-338)
- Reduces join complexity (1 table vs 2)
- RLS policies already exist on users table
- Follows existing codebase patterns

**Schema to Add (based on docs/nodes/persona.md):**

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_updated_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_updated_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_updated_at TIMESTAMPTZ;

-- Embeddings metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_generated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_model VARCHAR(100) DEFAULT 'text-embedding-3-small';
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_version INTEGER DEFAULT 1;

-- Constraints (max 500 chars encrypted = ~300 chars plaintext)
ALTER TABLE users ADD CONSTRAINT users_lo_que_me_define_encrypted_length_check
  CHECK (lo_que_me_define_encrypted IS NULL OR char_length(lo_que_me_define_encrypted) <= 500);

ALTER TABLE users ADD CONSTRAINT users_lo_que_no_tolero_encrypted_length_check
  CHECK (lo_que_no_tolero_encrypted IS NULL OR char_length(lo_que_no_tolero_encrypted) <= 500);

ALTER TABLE users ADD CONSTRAINT users_lo_que_me_da_igual_encrypted_length_check
  CHECK (lo_que_me_da_igual_encrypted IS NULL OR char_length(lo_que_me_da_igual_encrypted) <= 500);
```

**Indexes (from GDD persona.md lines 341-369):**

```sql
CREATE INDEX IF NOT EXISTS idx_users_embeddings_generated ON users(id, embeddings_generated_at)
WHERE embeddings_generated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lo_que_me_define_active ON users(id, lo_que_me_define_encrypted)
WHERE lo_que_me_define_encrypted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lo_que_no_tolero_active ON users(id, lo_que_no_tolero_encrypted)
WHERE lo_que_no_tolero_encrypted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lo_que_me_da_igual_active ON users(id, lo_que_me_da_igual_encrypted)
WHERE lo_que_me_da_igual_encrypted IS NOT NULL;
```

---

## Implementation Phases

### Phase 1: Database Migration (Day 1 Morning - 3 hours)

**Objective:** Add persona fields to users table with proper constraints and indexes

**Tasks:**
1. **Create migration script** `database/migrations/001_add_persona_fields.sql`
   - [ ] Add persona encrypted fields (3x fields × 5 columns = 15 columns)
   - [ ] Add embeddings metadata (3 columns)
   - [ ] Add length constraints (3 constraints)
   - [ ] Create indexes (4 indexes)

2. **Verify pgvector extension**
   - [ ] Run: `SELECT * FROM pg_extension WHERE extname = 'vector';`
   - [ ] If missing, run: `CREATE EXTENSION IF NOT EXISTS vector;`
   - [ ] Test vector column creation: `SELECT '[]'::vector(1536);`

3. **Deploy migration**
   - [ ] Test in local Supabase
   - [ ] Run migration in production (if approved)
   - [ ] Verify all columns created: `\d users` in psql

4. **Update schema.sql**
   - [ ] Add persona fields to base schema
   - [ ] Commit updated schema

**Deliverables:**
- Migration script ready
- pgvector verified
- users table updated
- schema.sql updated

**Validation:**
```sql
-- Verify persona fields exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name LIKE '%lo_que%';
-- Expected: 15 rows
```

---

### Phase 2: Encryption Utilities (Day 1 Afternoon - 4 hours)

**Objective:** Implement AES-256-GCM encryption/decryption utilities

**Tasks:**
1. **Create encryption utility** `src/utils/encryption.js`
   - [ ] Import crypto module (Node.js built-in)
   - [ ] Implement `encryptField(plaintext)` → Base64 ciphertext
   - [ ] Implement `decryptField(ciphertext)` → plaintext
   - [ ] Generate random IV per encryption (16 bytes)
   - [ ] Use AES-256-GCM with auth tag
   - [ ] Error handling for corrupt data

2. **Generate encryption key**
   - [ ] Create script: `scripts/generate-persona-key.js`
   - [ ] Generate 32-byte hex key: `crypto.randomBytes(32).toString('hex')`
   - [ ] Add to .env.example: `PERSONA_ENCRYPTION_KEY=<placeholder>`
   - [ ] Document in CLAUDE.md

3. **Write encryption tests** `tests/unit/utils/encryption.test.js`
   - [ ] Test: Encrypt → Decrypt = original text
   - [ ] Test: Same plaintext → different ciphertexts (unique IV)
   - [ ] Test: Tampered ciphertext → decryption fails
   - [ ] Test: Null/empty values handled gracefully
   - [ ] Test: Long text (300 chars) → encrypted < 500 chars

**Implementation Reference (from persona.md lines 453-580):**

```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(process.env.PERSONA_ENCRYPTION_KEY, 'hex'); // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encryptField(plaintext) {
  if (!plaintext) return null;

  const iv = crypto.randomBytes(16); // Unique IV per encryption
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag(); // 16 bytes for GCM

  // Format: iv (16) + tag (16) + encrypted data
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

function decryptField(ciphertext) {
  if (!ciphertext) return null;

  const combined = Buffer.from(ciphertext, 'base64');

  const iv = combined.subarray(0, 16);
  const tag = combined.subarray(16, 32);
  const encrypted = combined.subarray(32);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

module.exports = { encryptField, decryptField };
```

**Security Checklist:**
- [ ] No hardcoded keys
- [ ] IV unique per encryption (crypto.randomBytes)
- [ ] Key length: 32 bytes (256 bits)
- [ ] Never log plaintext or keys
- [ ] Validate PERSONA_ENCRYPTION_KEY on startup

**Deliverables:**
- encryption.js with encrypt/decrypt functions
- Tests passing (5 test cases minimum)
- Key generation script
- Documentation updated

---

### Phase 3: PersonaService Implementation (Day 2 - 8 hours)

**Objective:** Create PersonaService with CRUD operations, encryption, embeddings, and plan-based access

**Tasks:**
1. **Create PersonaService.js** `src/services/PersonaService.js`

   **Methods to implement:**
   - [ ] `constructor()` - Initialize Supabase client (SERVICE_KEY)
   - [ ] `getPersona(userId)` - Retrieve and decrypt persona fields
   - [ ] `updatePersona(userId, fields, userPlan)` - Encrypt and save with plan validation
   - [ ] `deletePersona(userId)` - Set all fields to NULL (GDPR compliance)
   - [ ] `_validatePlanAccess(userPlan, field)` - Check plan permissions
   - [ ] `_generateEmbedding(text)` - Call OpenAI embeddings API
   - [ ] `_updateEmbeddings(userId, fields)` - Generate and store embeddings

2. **Plan-based access control**
   ```javascript
   const PLAN_ACCESS = {
     free: [],  // No access
     starter: ['lo_que_me_define', 'lo_que_no_tolero'],  // 2 fields
     pro: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'],  // 3 fields
     plus: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual']  // 3 fields
   };

   _validatePlanAccess(userPlan, field) {
     const allowed = PLAN_ACCESS[userPlan] || [];
     if (!allowed.includes(field)) {
       throw new Error(`Plan ${userPlan} does not allow access to ${field}`);
     }
   }
   ```

3. **OpenAI embeddings integration**
   - [ ] Update `src/services/openai.js` to add `generateEmbedding()` method
   - [ ] Model: `text-embedding-3-small` (1536 dimensions)
   - [ ] Error handling for API failures
   - [ ] Retry logic with exponential backoff

4. **Error handling**
   - [ ] Specific error codes (PLAN_RESTRICTION, ENCRYPTION_FAILED, API_TIMEOUT)
   - [ ] Logging with utils/logger.js (NO console.log)
   - [ ] Graceful degradation (embeddings optional if API fails)

**Implementation Skeleton:**

```javascript
const { createClient } = require('@supabase/supabase-js');
const { encryptField, decryptField } = require('../utils/encryption');
const { generateEmbedding } = require('./openai');
const logger = require('../utils/logger');

class PersonaService {
  constructor() {
    // Use SERVICE_KEY for admin operations (per cost-control.md lines 19-56)
    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_KEY required for PersonaService');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  async getPersona(userId) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('lo_que_me_define_encrypted, lo_que_no_tolero_encrypted, lo_que_me_da_igual_encrypted, plan')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      lo_que_me_define: decryptField(user.lo_que_me_define_encrypted),
      lo_que_no_tolero: decryptField(user.lo_que_no_tolero_encrypted),
      lo_que_me_da_igual: decryptField(user.lo_que_me_da_igual_encrypted),
      plan: user.plan
    };
  }

  async updatePersona(userId, fields, userPlan) {
    // Validate plan access
    for (const field of Object.keys(fields)) {
      this._validatePlanAccess(userPlan, field);
    }

    // Encrypt fields
    const updates = {};
    if (fields.lo_que_me_define) {
      updates.lo_que_me_define_encrypted = encryptField(fields.lo_que_me_define);
      updates.lo_que_me_define_updated_at = new Date().toISOString();
    }
    // ... repeat for other fields

    // Save to database
    const { error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;

    // Generate embeddings (async, non-blocking)
    await this._updateEmbeddings(userId, fields);

    return { success: true };
  }

  async _updateEmbeddings(userId, fields) {
    const embeddings = {};

    if (fields.lo_que_me_define) {
      try {
        embeddings.lo_que_me_define_embedding = await generateEmbedding(fields.lo_que_me_define);
      } catch (error) {
        logger.error('Embedding generation failed for lo_que_me_define', { userId, error });
      }
    }
    // ... repeat for other fields

    if (Object.keys(embeddings).length > 0) {
      embeddings.embeddings_generated_at = new Date().toISOString();
      embeddings.embeddings_model = 'text-embedding-3-small';
      embeddings.embeddings_version = 1;

      await this.supabase
        .from('users')
        .update(embeddings)
        .eq('id', userId);
    }
  }

  _validatePlanAccess(userPlan, field) {
    const PLAN_ACCESS = {
      free: [],
      starter: ['lo_que_me_define', 'lo_que_no_tolero'],
      pro: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'],
      plus: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual']
    };

    const allowed = PLAN_ACCESS[userPlan] || [];
    if (!allowed.includes(field)) {
      throw new Error(`PLAN_RESTRICTION: ${field} requires ${this._requiredPlan(field)} plan or higher`);
    }
  }

  _requiredPlan(field) {
    if (field === 'lo_que_me_da_igual') return 'pro';
    return 'starter';
  }
}

module.exports = new PersonaService();
```

**Deliverables:**
- PersonaService.js with all methods
- OpenAI embeddings integrated
- Plan-based access enforced
- Error handling comprehensive

---

### Phase 4: API Endpoints (Day 2 Evening - 4 hours)

**Objective:** Create REST API endpoints for persona management

**Tasks:**
1. **Add routes to** `src/index.js`
   - [ ] `GET /api/persona` - Retrieve current user's persona
   - [ ] `POST /api/persona` - Create/update persona
   - [ ] `DELETE /api/persona` - Delete persona (GDPR)

2. **Middleware requirements**
   - [ ] `authenticateToken` - Verify JWT (already exists)
   - [ ] `validatePersonaInput` - Input validation with express-validator
   - [ ] Error handling middleware

3. **Input validation**
   ```javascript
   const { body, validationResult } = require('express-validator');

   const validatePersonaInput = [
     body('lo_que_me_define')
       .optional()
       .isString()
       .isLength({ max: 300 })
       .trim()
       .escape(),
     body('lo_que_no_tolero')
       .optional()
       .isString()
       .isLength({ max: 300 })
       .trim()
       .escape(),
     body('lo_que_me_da_igual')
       .optional()
       .isString()
       .isLength({ max: 300 })
       .trim()
       .escape()
   ];
   ```

**Implementation:**

```javascript
const PersonaService = require('./services/PersonaService');
const { authenticateToken } = require('./middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/persona - Retrieve persona
app.get('/api/persona', authenticateToken, async (req, res) => {
  try {
    const persona = await PersonaService.getPersona(req.user.id);
    res.json({ success: true, data: persona });
  } catch (error) {
    logger.error('Get persona failed', { userId: req.user.id, error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/persona - Create/update persona
app.post(
  '/api/persona',
  authenticateToken,
  validatePersonaInput,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual } = req.body;

      // Get user plan (from users table or JWT)
      const { data: user } = await supabase
        .from('users')
        .select('plan')
        .eq('id', req.user.id)
        .single();

      const result = await PersonaService.updatePersona(
        req.user.id,
        { lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual },
        user.plan
      );

      res.json({ success: true, data: result });
    } catch (error) {
      if (error.message.includes('PLAN_RESTRICTION')) {
        return res.status(403).json({
          success: false,
          error: error.message,
          upgrade_url: '/pricing'
        });
      }

      logger.error('Update persona failed', { userId: req.user.id, error });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DELETE /api/persona - Delete persona
app.delete('/api/persona', authenticateToken, async (req, res) => {
  try {
    await PersonaService.deletePersona(req.user.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Delete persona failed', { userId: req.user.id, error });
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Rate Limiting (optional, Phase 2):**
```javascript
const rateLimit = require('express-rate-limit');

const personaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 updates per hour
  message: 'Too many persona updates, please try again later'
});

app.post('/api/persona', authenticateToken, personaLimiter, ...);
```

**Deliverables:**
- 3 API endpoints implemented
- Input validation working
- Error handling comprehensive
- Rate limiting configured (optional)

---

### Phase 5: Testing (Day 3 - 8 hours)

**Objective:** Achieve 90%+ test coverage with unit, integration, and security tests

#### 5.1 Unit Tests (4 hours)

**File:** `tests/unit/PersonaService.test.js`

**Test cases:**
```javascript
describe('PersonaService', () => {
  describe('Encryption', () => {
    it('should encrypt and decrypt field correctly');
    it('should generate unique IVs for each encryption');
    it('should handle null/empty values gracefully');
    it('should fail decryption on tampered ciphertext');
  });

  describe('CRUD Operations', () => {
    it('should retrieve persona with decrypted fields');
    it('should update persona with encrypted storage');
    it('should delete persona (set all fields to NULL)');
    it('should return null for non-existent persona');
  });

  describe('Plan-based Access', () => {
    it('should reject Free plan users (all fields)');
    it('should allow Starter plan users (2 fields)');
    it('should reject Starter plan for "lo_que_me_da_igual"');
    it('should allow Pro plan users (all 3 fields)');
    it('should allow Plus plan users (all 3 fields)');
  });

  describe('Embeddings', () => {
    it('should generate 1536-dimension embedding', async () => {
      const embedding = await PersonaService._generateEmbedding('test text');
      expect(embedding).toHaveLength(1536);
    });

    it('should handle OpenAI API failures gracefully');
    it('should update embeddings_generated_at timestamp');
    it('should store correct model name (text-embedding-3-small)');
  });

  describe('Validation', () => {
    it('should reject fields longer than 300 chars');
    it('should sanitize HTML/script tags');
    it('should reject invalid field names');
  });
});
```

#### 5.2 Integration Tests (3 hours)

**File:** `tests/integration/persona-api.test.js`

**Test cases:**
```javascript
describe('POST /api/persona', () => {
  it('should create persona with valid data (Pro user)', async () => {
    const response = await request(app)
      .post('/api/persona')
      .set('Authorization', `Bearer ${proUserToken}`)
      .send({
        lo_que_me_define: 'Soy developer sarcástico',
        lo_que_no_tolero: 'Body shaming',
        lo_que_me_da_igual: 'Humor negro'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify data encrypted in DB
    const { data: user } = await supabase
      .from('users')
      .select('lo_que_me_define_encrypted')
      .eq('id', proUserId)
      .single();

    expect(user.lo_que_me_define_encrypted).not.toContain('developer'); // Encrypted
  });

  it('should return 403 for Free user', async () => {
    const response = await request(app)
      .post('/api/persona')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send({ lo_que_me_define: 'Test' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('PLAN_RESTRICTION');
  });

  it('should return 401 for unauthenticated request');
  it('should validate input (reject empty fields)');
  it('should enforce character limits (300 chars)');
});

describe('GET /api/persona', () => {
  it('should return decrypted persona', async () => {
    const response = await request(app)
      .get('/api/persona')
      .set('Authorization', `Bearer ${proUserToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.lo_que_me_define).toBe('Soy developer sarcástico'); // Decrypted
  });

  it('should return 404 if no persona exists');
  it('should not return embeddings (only text fields)');
});

describe('DELETE /api/persona', () => {
  it('should soft delete persona', async () => {
    const response = await request(app)
      .delete('/api/persona')
      .set('Authorization', `Bearer ${proUserToken}`);

    expect(response.status).toBe(204);

    // Verify fields are NULL
    const { data: user } = await supabase
      .from('users')
      .select('lo_que_me_define_encrypted')
      .eq('id', proUserId)
      .single();

    expect(user.lo_que_me_define_encrypted).toBeNull();
  });
});
```

#### 5.3 Security Tests (1 hour)

**File:** `tests/security/persona-security.test.js`

**Test cases:**
```javascript
describe('Persona Security', () => {
  it('should prevent SQL injection via persona fields', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    await expect(
      PersonaService.updatePersona(userId, { lo_que_me_define: maliciousInput }, 'pro')
    ).resolves.not.toThrow();

    // Verify users table still exists
    const { data } = await supabase.from('users').select('id').limit(1);
    expect(data).toBeTruthy();
  });

  it('should prevent XSS via persona fields', async () => {
    const xssInput = '<script>alert("XSS")</script>';

    await PersonaService.updatePersona(userId, { lo_que_me_define: xssInput }, 'pro');

    const persona = await PersonaService.getPersona(userId);
    expect(persona.lo_que_me_define).not.toContain('<script>'); // Sanitized
  });

  it('should enforce RLS (users cannot read other users personas)', async () => {
    // User A creates persona
    await PersonaService.updatePersona(userAId, { lo_que_me_define: 'Secret' }, 'pro');

    // User B attempts to read User A's persona via direct DB query
    const { data, error } = await supabaseAnonClient // Using ANON key (not SERVICE_KEY)
      .from('users')
      .select('lo_que_me_define_encrypted')
      .eq('id', userAId)
      .single();

    expect(error).toBeTruthy(); // RLS blocks access
  });

  it('should not log plaintext persona data');
  it('should validate encryption key exists on startup');
});
```

**Deliverables:**
- 30+ test cases covering all scenarios
- 90%+ code coverage
- All tests passing
- Security audit clean

---

### Phase 6: Documentation & GDD Updates (Day 3 Evening - 3 hours)

**Objective:** Complete documentation and update GDD system

**Tasks:**
1. **Update CLAUDE.md**
   - [ ] Add PERSONA_ENCRYPTION_KEY to env vars section
   - [ ] Document `/api/persona` endpoints
   - [ ] Add PersonaService to service architecture
   - [ ] Note: NO actual keys in docs (use placeholder)

2. **Update GDD node** `docs/nodes/persona.md`
   - [ ] Update coverage percentage (run tests with --coverage)
   - [ ] Add "Agentes Relevantes": Backend Developer, Test Engineer, Orchestrator
   - [ ] Update "Related PRs" section with Issue #595 PR number
   - [ ] Verify schema documentation matches implementation

3. **Create API documentation** (optional, if time permits)
   - [ ] Request/response schemas
   - [ ] Error codes and meanings
   - [ ] Rate limits
   - [ ] Example curl commands

4. **Create SUMMARY** `docs/test-evidence/issue-595/SUMMARY.md`
   - [ ] Use template: `docs/templates/SUMMARY-template.md`
   - [ ] Document implementation decisions
   - [ ] Security considerations
   - [ ] Known limitations
   - [ ] Future improvements

**Deliverables:**
- CLAUDE.md updated
- persona.md GDD node updated
- SUMMARY.md created
- API docs (optional)

---

### Phase 7: Frontend (Optional - Coordinate with Frontend Team)

**Note:** This appears to be a backend-only repository. If frontend is in a separate repo, coordinate with frontend team for implementation.

**If frontend needed in this repo:**

**File:** `public/persona-setup.html` (or React component)

**Features:**
- [ ] 3 textarea fields with character counters
- [ ] Plan-based field disabling (Free/Starter can't use field 3)
- [ ] Real-time validation (max 300 chars)
- [ ] Submit button with loading state
- [ ] Success/error notifications
- [ ] Upgrade prompt for lower-tier users
- [ ] Mobile-responsive design

**Estimate:** 1.5 days (8 hours UI + 4 hours validation + 4 hours E2E tests)

**Status:** Defer to separate issue or coordinate with frontend team

---

## Risk Mitigation

### Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **pgvector not enabled** | Medium | High | Verify in Phase 1, enable if needed |
| **Payment integration missing** | Medium | Critical | Create stub for testing, clarify with team |
| **Encryption key leak** | Low | Critical | Never log keys, use env vars only, document rotation |
| **OpenAI API rate limits** | Low | Medium | Implement retry logic, cache embeddings |

### Technical Risks

| Risk | Mitigation |
|------|------------|
| **Database migration fails** | Test in local Supabase first, have rollback plan |
| **Embedding generation slow** | Make async/non-blocking, add timeout (30s) |
| **Plan verification unavailable** | Graceful degradation (default to Free plan) |
| **GDPR compliance gaps** | Ensure hard delete, audit logs, document retention policy |

---

## Success Criteria

**Definition of Done:**

1. ✅ Database schema updated with 18 persona columns
2. ✅ PersonaService.js implemented with all methods
3. ✅ Encryption working (AES-256-GCM verified)
4. ✅ OpenAI embeddings generating successfully
5. ✅ API endpoints functional (GET/POST/DELETE)
6. ✅ Plan-based access enforced
7. ✅ **ALL tests passing (30+ test cases)**
8. ✅ Test coverage ≥90%
9. ✅ Security audit passed (no XSS, SQL injection, RLS verified)
10. ✅ Documentation updated (CLAUDE.md, persona.md, SUMMARY.md)
11. ✅ GDD validation passing
12. ✅ Pre-Flight Checklist complete
13. ✅ **0 CodeRabbit comments** (Quality Standard)

**Quality Gates:**
- [ ] No console.log statements in code
- [ ] All errors logged with logger.js
- [ ] No hardcoded credentials
- [ ] JSDoc comments on exported functions
- [ ] Express-validator on all inputs
- [ ] RLS policies verified in Supabase

---

## File Structure

```
roastr-ai/
├── database/
│   ├── schema.sql                          # ⚠️ UPDATE (add persona fields)
│   └── migrations/
│       └── 001_add_persona_fields.sql      # ❌ CREATE
│
├── src/
│   ├── services/
│   │   ├── PersonaService.js               # ❌ CREATE (main service)
│   │   └── openai.js                       # ⚠️ ENHANCE (add generateEmbedding)
│   ├── utils/
│   │   └── encryption.js                   # ❌ CREATE (AES-256-GCM)
│   └── index.js                            # ⚠️ ENHANCE (add /api/persona routes)
│
├── scripts/
│   └── generate-persona-key.js             # ❌ CREATE
│
├── tests/
│   ├── unit/
│   │   ├── PersonaService.test.js          # ❌ CREATE
│   │   └── utils/
│   │       └── encryption.test.js          # ❌ CREATE
│   ├── integration/
│   │   └── persona-api.test.js             # ❌ CREATE
│   └── security/
│       └── persona-security.test.js        # ❌ CREATE
│
├── docs/
│   ├── nodes/
│   │   └── persona.md                      # ⚠️ UPDATE (coverage, agents)
│   ├── plan/
│   │   └── issue-595.md                    # ✅ THIS FILE
│   ├── assessment/
│   │   └── issue-595.md                    # ✅ EXISTS
│   └── test-evidence/
│       └── issue-595/
│           ├── tests-passing.txt           # ❌ CREATE
│           ├── coverage-report.json        # ❌ CREATE (auto-generated)
│           └── SUMMARY.md                  # ❌ CREATE
│
└── .env.example                            # ⚠️ UPDATE (add PERSONA_ENCRYPTION_KEY)
```

**Legend:**
- ❌ CREATE - New file to create
- ⚠️ UPDATE - Existing file to modify
- ✅ EXISTS - Already created

---

## Pre-Flight Checklist (Execute Before Each Commit)

- [ ] Read `docs/patterns/coderabbit-lessons.md`
- [ ] Run tests locally: `npm test`
- [ ] Verify 0 console.log statements: `grep -r "console.log" src/ --exclude-dir=node_modules`
- [ ] Check coverage: `npm test -- --coverage`
- [ ] Self-review code (pretend you're CodeRabbit)
- [ ] Update GDD nodes if architecture changed
- [ ] Run GDD validation: `node scripts/validate-gdd-runtime.js --full`

---

## Next Steps (Immediate Actions)

**Before Implementation:**

1. **Verify pgvector extension** (BLOCKER)
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM pg_extension WHERE extname = 'vector';
   -- If empty, run: CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Clarify payment integration** (BLOCKER)
   - Contact backend team lead
   - Locate plan verification logic
   - If missing, create stub for testing

3. **Generate encryption key**
   ```bash
   node -e "console.log('PERSONA_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   # Add to .env (NOT committed)
   ```

4. **Create branch**
   ```bash
   git checkout -b feat/persona-setup-595
   ```

**During Implementation (Auto-Continue):**

Following CLAUDE.md guidelines, this plan will **automatically continue** with implementation without waiting for user confirmation. The plan serves as documentation, not a pause point.

**Proceed immediately to Phase 1: Database Migration**

---

## Lessons Learned (Post-Implementation)

**To be filled after completion:**

- [ ] What worked well?
- [ ] What took longer than expected?
- [ ] New patterns discovered for coderabbit-lessons.md
- [ ] Technical decisions reconsidered
- [ ] Security improvements needed

---

**Plan Status:** COMPLETE ✅
**Ready for Implementation:** YES
**Auto-Continue:** YES (per CLAUDE.md workflow)

**Proceeding to Phase 1: Database Migration**
