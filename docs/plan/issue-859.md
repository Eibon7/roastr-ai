# Plan: Brand Safety para Sponsors (Plan Plus) - Issue #859

**Priority:** P1  
**Complexity:** High (≥3 AC)  
**Plan Plus Feature:** Yes

---

## 🎯 Objetivo

Implementar sistema de Brand Safety que permite a usuarios del plan Plus configurar sponsors/marcas a proteger y aplicar acciones automáticas cuando comentarios ofensivos los mencionen.

---

## 📋 Acceptance Criteria

1. **Sponsor Configuration (CRUD)**
   - Crear, listar, actualizar y eliminar sponsors
   - Configurar severity (low, medium, high, zero_tolerance)
   - Configurar tone override (normal, professional, light_humor, aggressive_irony)
   - Configurar actions (hide, ban, def_roast, agg_roast, report)
   - Asignar priority (1=high, 5=low) para resolver conflictos

2. **Automated Tag Extraction**
   - Extraer tags relevantes desde URL del sponsor usando OpenAI GPT-4o
   - Rate limiting: 5 requests/min
   - Cost tracking: 2 cents per extraction

3. **Real-time Sponsor Detection**
   - Detectar menciones de sponsors en comentarios (exact match, tag match)
   - Integración no-bloqueante en toxicity analysis flow
   - Priority-based matching (highest priority sponsor wins)

4. **Shield Integration**
   - Zero tolerance sponsors → immediate block + hide
   - Other severities → dynamic threshold adjustment
   - Pass brand_safety metadata to SHIELD decisions

5. **Roast Integration**
   - Generate defensive roasts con tone override
   - Incluir sponsor context en prompt cacheables
   - Pass brand_safety metadata to ROAST decisions

6. **API Endpoints**
   - `POST /api/sponsors` - Create
   - `GET /api/sponsors` - List
   - `GET /api/sponsors/:id` - Get single
   - `PUT /api/sponsors/:id` - Update
   - `DELETE /api/sponsors/:id` - Delete
   - `POST /api/sponsors/extract-tags` - Extract tags from URL

7. **Plan Gating**
   - Middleware: `requirePlan('plus', { feature: 'brand_safety' })`
   - Database: RLS policies por user_id
   - Frontend: Plan upgrade prompts

---

## 🗂️ Estado Actual

### Existente

- ✅ `requirePlan` middleware (needs Plus plan addition)
- ✅ Cost Control service (needs new operation type)
- ✅ AnalyzeToxicityWorker (needs sponsor detection logic)
- ✅ AnalysisDecisionEngine (needs sponsor rules)
- ✅ GenerateReplyWorker (needs brand_safety metadata)
- ✅ RoastPromptBuilder (cacheable blocks A/B/C ready)

### Faltante

- ❌ `sponsors` table (database/migrations/)
- ❌ SponsorService (CRUD, tag extraction, detection)
- ❌ API routes (`/api/sponsors`)
- ❌ Middleware updates (Plus plan features)
- ❌ Shield integration (sponsor protection rules)
- ❌ Roast integration (defensive roasts with tone)
- ❌ Tests (unit, integration, E2E)
- ❌ Documentation updates (GDD nodes)

---

## 🔨 Pasos de Implementación

### FASE 1: Database Schema & Migration ✅

```sql
CREATE TABLE sponsors (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  url TEXT,
  tags TEXT[],
  severity VARCHAR(50) DEFAULT 'medium',
  tone VARCHAR(50) DEFAULT 'normal',
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  actions TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, name)
);
```

**Files:** `database/migrations/027_sponsors.sql`

---

### FASE 2: SponsorService ✅

Implementar servicio con:

- **CRUD operations**: create, get, update, delete
- **Tag extraction**: `extractTagsFromURL(url)` using OpenAI GPT-4o
- **Sponsor detection**: `detectSponsorMention(comment, sponsors)` (exact, tag, priority)
- **URL sanitization**: Security validation

**Files:** `src/services/sponsorService.js`

**Dependencies:**

- `@supabase/supabase-js` (database)
- `openai` (tag extraction)

---

### FASE 3: API Endpoints ✅

REST API con authentication + plan gating:

- POST /api/sponsors
- GET /api/sponsors
- GET /api/sponsors/:id
- PUT /api/sponsors/:id
- DELETE /api/sponsors/:id
- POST /api/sponsors/extract-tags (rate limited: 5/min)

**Files:** `src/routes/sponsors.js`

**Middleware:**

- `authenticateToken` (JWT validation)
- `requirePlan('plus', { feature: 'brand_safety' })`

---

### FASE 4: Shield Integration ✅

Modificar toxicity analysis para:

1. Detectar sponsor mentions (non-blocking)
2. Añadir `sponsors` y `sponsorMatch` al `userContext`
3. Aplicar sponsor rules en `AnalysisDecisionEngine`:
   - Zero tolerance → immediate SHIELD
   - Other severities → dynamic threshold adjustment
4. Incluir `brand_safety` metadata en decisiones

**Files:**

- `src/workers/AnalyzeToxicityWorker.js`
- `src/services/AnalysisDecisionEngine.js`

**Logic Flow:**

```
Comment → Detect Sponsors → Toxicity Analysis →
  IF sponsor match + zero_tolerance → SHIELD (block + hide)
  IF sponsor match + other severity → Adjust threshold → Evaluate
  IF threshold met → SHIELD with sponsor_protection action
```

---

### FASE 5: Roast Integration ✅

Modificar roast generation para defensive roasts:

1. Recibir `brand_safety` metadata del job payload
2. Pasar `sponsors` y `sponsorMatch` a prompt builder
3. Incluir sponsor context en cacheable blocks:
   - Block B (User): General sponsor list
   - Block C (Dynamic): Specific sponsor match details + tone override
4. Generate roast con tone ajustado (professional, light_humor, etc.)

**Files:**

- `src/workers/GenerateReplyWorker.js`
- `src/lib/prompts/roastPrompt.js` (RoastPromptBuilder)

**Tone Mapping:**

- `normal` → User's default tone
- `professional` → Measured, no aggressive humor
- `light_humor` → Lighthearted, desenfadado
- `aggressive_irony` → Marked irony, direct sarcasm

---

### FASE 6: Cost Control ✅

Añadir tracking para tag extraction:

- Operation: `extract_sponsor_tags`
- Cost: 2 cents per extraction
- Resource type: `ai_operations`

**Files:** `src/services/costControl.js`

---

### FASE 7: Frontend UI (CANCELLED)

Admin dashboard page para sponsor management:

- List sponsors (table con active status, severity, priority)
- Create sponsor form (name, URL, tags, severity, tone, actions)
- Edit sponsor modal
- Delete confirmation
- Tag extraction UI (URL → tags preview)
- Plan upgrade prompt (if not Plus)

**Files:**

- `src/components/admin/SponsorsManager.jsx`
- `src/pages/admin/sponsors.jsx`

**UI Framework:** React + Tailwind CSS

**Status:** CANCELLED (backend-first approach, UI deferred to future PR)

---

### FASE 8: Testing ✅

**Unit Tests:**

- SponsorService CRUD (34 tests - 100% passing)
- Tag extraction (OpenAI integration, URL validation, timeouts)
- Sponsor detection (exact, tag, priority, edge cases)

**Integration Tests:**

- API routes (auth, plan gating, validation, error handling)
- Shield integration (sponsor protection rules)
- Roast integration (defensive roasts with tone)

**E2E Tests:**

- Full workflow: Create sponsor → Toxic comment mentions sponsor → SHIELD triggered
- Zero tolerance: Immediate block
- Defensive roast: Tone override applied

**Files:**

- `tests/unit/services/sponsorService.test.js`
- `tests/integration/routes/sponsors.test.js`
- `tests/e2e/brand-safety.spec.js` (deferred)

---

### FASE 9: Documentation ✅

Actualizar nodos GDD:

- **shield.md**: Brand Safety section (sponsor detection, actions, metadata)
- **roast.md**: Defensive roasts with tone override (cacheable prompt blocks)
- **plan-features.md**: Plus plan features (brand_safety, sponsor_protection)

**Files:**

- `docs/nodes/shield.md`
- `docs/nodes/roast.md`
- `docs/nodes/plan-features.md`

---

## 🎨 Detalles Técnicos

### Severity Levels

| Severity         | Description         | Threshold Adjustment | Actions                                      |
| ---------------- | ------------------- | -------------------- | -------------------------------------------- |
| `low`            | Monitoring only     | -0.05                | Logging                                      |
| `medium`         | Moderate protection | -0.1                 | hide_comment, def_roast                      |
| `high`           | Strong protection   | -0.2                 | hide_comment, block_user, def_roast          |
| `zero_tolerance` | Immediate block     | N/A (always SHIELD)  | hide_comment, block_user, sponsor_protection |

### Tone Overrides

| Tone               | Description                   | Roast Style                  |
| ------------------ | ----------------------------- | ---------------------------- |
| `normal`           | User's default tone           | As configured                |
| `professional`     | Measured, no aggressive humor | Diplomatic, factual          |
| `light_humor`      | Lighthearted, desenfadado     | Playful, non-confrontational |
| `aggressive_irony` | Marked irony, direct sarcasm  | Sharp, cutting               |

### Priority-based Matching

- Multiple sponsors mentioned → highest priority (lowest number) wins
- Conflict resolution: Sponsor with priority=1 overrides priority=3
- Order: Already sorted by priority in `getSponsors` query

### Detection Methods

1. **Exact Match**: Case-insensitive exact sponsor name match (`\bNike\b`)
2. **Tag Match**: Case-insensitive tag match from extracted tags
3. **Semantic** (deferred): Embeddings-based similarity search

---

## 🔗 Agentes Relevantes

- **@task-assessor**: Plan creation (AC ≥3, P1 priority)
- **@back-end-dev**: Database, service, routes, integration
- **@test-engineer**: Unit, integration, E2E tests
- **@github-guardian**: Security audit, RLS policies, secrets validation
- **@documentation-agent**: GDD node updates

---

## 📊 Validación

### Pre-Flight Checklist

- [ ] Tests pasando al 100% (`npm test`)
- [ ] Coverage ≥90% (`npm run test:coverage`)
- [ ] GDD validado (`node scripts/validate-gdd-runtime.js --full`)
- [ ] GDD health ≥87 (`node scripts/score-gdd-health.js --ci`)
- [ ] CodeRabbit = 0 comentarios (`npm run coderabbit:review`)
- [ ] Lint errors = 0 (`npm run lint`)
- [ ] No conflictos con main
- [ ] Receipts generados (agents/receipts/)
- [ ] Documentación actualizada (spec.md, nodos GDD)

### Test Commands

```bash
# Unit tests
npm test tests/unit/services/sponsorService.test.js

# Integration tests
npm test tests/integration/routes/sponsors.test.js

# E2E tests (deferred)
npm run test:e2e -- brand-safety

# Coverage
npm run test:coverage -- --collectCoverageFrom=src/services/sponsorService.js
```

---

## 📝 Notas de Implementación

### CodeRabbit Fixes Applied

1. **Supabase initialization**: Fail-fast con error descriptivo si credenciales faltan
2. **Priority default type**: Usar `3` (numeric) en vez de `'medium'` (string)
3. **Priority ordering**: `ascending: true` para que prioridad 1 venga primero

### Security Considerations

- **RLS policies**: Multi-tenant isolation por `user_id`
- **URL sanitization**: Solo HTTP/HTTPS, no `javascript:`, `file:`, `data:`
- **Rate limiting**: Tag extraction limitado a 5 req/min
- **Cost tracking**: Track usage ANTES de llamar OpenAI (evitar abuse)
- **Plan gating**: Middleware enforcea Plus plan requirement

### Performance

- **Non-blocking**: Sponsor detection no bloquea toxicity analysis
- **Caching**: Sponsor list cacheado en worker (no re-fetch cada comment)
- **Indexes**: `idx_sponsors_user_id_active`, `idx_sponsors_priority`
- **Priority sorting**: DB-level ORDER BY (no in-memory sort)

---

## 🔗 Referencias

- **Issue:** #859
- **GDD Nodes:** shield.md, roast.md, plan-features.md
- **Related PRs:** #865
- **CodeRabbit Review:** PR #865 comments

---

**Status:** Implementation complete ✅ | Tests 100% passing ✅ | Documentation updated ✅
**Last Updated:** 2025-11-17
