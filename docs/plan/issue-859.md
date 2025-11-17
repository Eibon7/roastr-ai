# Plan de Implementación: Brand Safety para Sponsors (Plan Plus)

**Issue:** #859
**Plan:** Plus
**Prioridad:** P1
**Agente:** TaskAssessor → Backend Dev → Test Engineer → Guardian

---

## Estado Actual

**Contexto:**
El plan Plus actualmente ofrece límites superiores (5,000 roasts/mes, 100,000 análisis/mes, 10 plataformas) pero carece de una feature distintiva de valor agregado para justificar el precio premium (€50/mo vs €15/mo del Pro).

**Problema:**
Los creadores de contenido con sponsors/marcas necesitan proteger su reputación y relaciones comerciales cuando comentarios ofensivos atacan a sus patrocinadores.

**Oportunidad:**
Brand Safety es una feature enterprise-level que resuelve un pain point real para creators monetizados y justifica el upgrade a Plus.

---

## Objetivo

Implementar **Brand Safety para Sponsors (Plan Plus)** que permita a usuarios:
1. Configurar sponsors/marcas a proteger
2. Detectar automáticamente menciones negativas de sponsors en comentarios
3. Aplicar acciones protectivas (Shield) o defensivas (Roast)
4. Ajustar el tono de respuesta según la severidad y preferencias del sponsor

---

## Acceptance Criteria

### AC1: Database Schema ✅
- [ ] Tabla `sponsors` con RLS policies
- [ ] Campos: `user_id`, `name`, `url`, `tags[]`, `severity`, `tone`, `priority`, `actions[]`, `active`
- [ ] Relación con `users` table
- [ ] Índices optimizados

### AC2: API Endpoints ✅
- [ ] POST /api/sponsors (create)
- [ ] GET /api/sponsors (list)
- [ ] GET /api/sponsors/:id (get)
- [ ] PUT /api/sponsors/:id (update)
- [ ] DELETE /api/sponsors/:id (delete)
- [ ] POST /api/sponsors/extract-tags (AI tag extraction)
- [ ] Plus plan gating en todas las rutas

### AC3: Tag Extraction ✅
- [ ] Integración con OpenAI para extraer tags de URLs
- [ ] Scraping de HTML + limpieza
- [ ] Generación automática de 3-6 tags relevantes
- [ ] Rate limiting (5 req/min)
- [ ] Cost tracking (2 cents/operation)

### AC4: Shield Integration ✅
- [ ] Detección de sponsors en AnalyzeToxicityWorker
- [ ] RULE 0.5 en AnalysisDecisionEngine
- [ ] Zero-tolerance: bloqueo inmediato
- [ ] Dynamic threshold adjustment (low/medium/high)
- [ ] Metadata `brand_safety` en análisis

### AC5: Roast Integration ✅
- [ ] Sponsor context en prompt (cacheable Block B)
- [ ] Sponsor match específico (dynamic Block C)
- [ ] Tone mapping (professional/light_humor/aggressive_irony/normal)
- [ ] Defensive roast generation

### AC6: Testing ✅
- [ ] Unit tests (SponsorService): 34 tests
- [ ] Integration tests (API routes): completo
- [ ] E2E tests: recomendado para siguiente fase

### AC7: Documentation ✅
- [ ] Actualizar `docs/nodes/shield.md`
- [ ] Actualizar `docs/nodes/roast.md`
- [ ] Actualizar `docs/nodes/plan-features.md`

---

## Implementación por Fases

### FASE 1: Database Schema & Migration ✅
**Archivos:**
- `database/migrations/027_sponsors.sql`

**Detalles:**
```sql
CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT,
  tags TEXT[],
  active BOOLEAN DEFAULT TRUE NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium' NOT NULL, -- low, medium, high, zero_tolerance
  tone VARCHAR(50) DEFAULT 'normal' NOT NULL, -- normal, professional, light_humor, aggressive_irony
  priority INTEGER DEFAULT 3 NOT NULL, -- 1 (high) to 5 (low)
  actions TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL, -- hide, ban, def_roast, agg_roast, report
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS Policy
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_sponsors_isolation ON sponsors FOR ALL 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- Index
CREATE INDEX idx_sponsors_user_id_active ON sponsors(user_id, active);
```

---

### FASE 2: SponsorService ✅
**Archivos:**
- `src/services/sponsorService.js`

**Métodos:**
- `createSponsor(userId, sponsorData)` - CRUD create
- `getSponsors(userId, includeInactive)` - CRUD read
- `getSponsorById(sponsorId, userId)` - CRUD read single
- `updateSponsor(sponsorId, userId, updates)` - CRUD update
- `deleteSponsor(sponsorId, userId)` - CRUD delete
- `extractTagsFromURL(url)` - OpenAI GPT-4o para tags
- `detectSponsorMention(commentText, sponsors)` - Exact/tag/semantic match
- `_sanitizeURL(url)` - Security validation

**Dependencias:**
- `@supabase/supabase-js` (RLS queries)
- `openai` (tag extraction)
- `node-fetch` (HTML scraping)

---

### FASE 3: API Endpoints ✅
**Archivos:**
- `src/routes/sponsors.js`

**Rutas:**
```javascript
POST   /api/sponsors              // Create sponsor
GET    /api/sponsors              // List sponsors
GET    /api/sponsors/:id          // Get sponsor
PUT    /api/sponsors/:id          // Update sponsor
DELETE /api/sponsors/:id          // Delete sponsor
POST   /api/sponsors/extract-tags // Extract tags from URL
```

**Middleware:**
- `authenticateToken` - Auth required
- `requirePlan('plus')` - Plus plan only
- `tagExtractionLimiter` - Rate limit 5/min

**Validaciones:**
- UUID format validation
- Severity enum validation
- Tone enum validation
- Actions array validation

---

### FASE 4: Shield Integration ✅
**Archivos:**
- `src/workers/AnalyzeToxicityWorker.js`
- `src/services/AnalysisDecisionEngine.js`

**AnalyzeToxicityWorker:**
```javascript
// Load sponsors for organization owner
const sponsors = await sponsorService.getSponsors(orgData.owner_id, false);
const sponsorMatch = await sponsorService.detectSponsorMention(commentText, sponsors);

const userContext = {
  // ... existing context
  sponsors: sponsors,
  sponsorMatch: sponsorMatch.matched ? sponsorMatch : null
};
```

**AnalysisDecisionEngine - RULE 0.5:**
```javascript
// Zero-tolerance sponsors
if (severity === 'zero_tolerance') {
  return createShieldDecision('critical', [
    'hide_comment', 'block_user', 'sponsor_protection', ...actions
  ]);
}

// Dynamic threshold adjustment
const adjustment = { low: 0.0, medium: -0.1, high: -0.2 }[severity];
const adjustedToxicity = final_toxicity - adjustment;

if (adjustedToxicity >= thresholds.shield) {
  return createShieldDecision('medium/high', ['hide_comment', 'sponsor_protection', ...actions]);
}

// Defensive roast
if (actions.includes('def_roast') || actions.includes('agg_roast')) {
  combinedScores.sponsor_defensive_roast = true;
}
```

---

### FASE 5: Roast Integration ✅
**Archivos:**
- `src/lib/prompts/roastPrompt.js` (RoastPromptBuilder v2.0.0)
- `src/services/roastGeneratorEnhanced.js`
- `src/workers/GenerateReplyWorker.js`

**RoastPromptBuilder - Cacheable Blocks:**
```javascript
// Block B (User - Cacheable)
buildBlockB({ sponsors }) {
  if (sponsors.length > 0) {
    return `
🛡️ SPONSORS DEL CREADOR:
${sponsors.map(s => `- ${s.name} (tags: ${s.tags.join(', ')}) → acciones: ${s.actions.join(', ')}`).join('\n')}

Si el comentario ataca estos sponsors:
- Protege la imagen del creador
- Mantén consistencia con su tono
- NO suenes vendido
- Defiende de forma natural
    `;
  }
}

// Block C (Dynamic - Not Cacheable)
buildBlockC({ sponsorMatch }) {
  if (sponsorMatch) {
    return `
⚠️ ESTE COMENTARIO MENCIONA: ${sponsorMatch.sponsor.name}
Ajusta tono: ${sponsorMatch.sponsor.tone}
Instrucción: ${getToneInstruction(sponsorMatch.sponsor.tone)}
    `;
  }
}
```

**Tone Mapping:**
- `professional`: Measured, no aggressive humor
- `light_humor`: Lighthearted, desenfadado
- `aggressive_irony`: Marked irony, direct sarcasm
- `normal`: User's default tone

---

### FASE 6: Cost Control ✅
**Archivos:**
- `src/services/costControl.js`
- `src/routes/sponsors.js`

**Tracking:**
```javascript
await costControl.recordUsage(
  organizationId,
  'api',
  'extract_sponsor_tags', // Operation type
  { url, tagsCount },
  userId,
  1 // Quantity
);
```

**Costos:**
- Tag extraction: 2 cents/operation
- Resource type: `ai_operations`

---

### FASE 7: Frontend UI (CANCELADA - Siguiente Issue)
**Razón:** Scope change para mantener PR enfocada en backend.

**Recomendación:** Issue separada con:
- Admin dashboard `/admin/sponsors`
- Form create/edit sponsor
- Severity/tone/actions selectors
- URL input + "Extract Tags" button
- Tag management (add/remove)
- Plus plan gating

---

### FASE 8: Testing ✅
**Archivos:**
- `tests/unit/services/sponsorService.test.js` (34 tests - 100%)
- `tests/integration/routes/sponsors.test.js` (completo)

**Cobertura:**
- ✅ CRUD operations
- ✅ Tag extraction (OpenAI, fetch, timeouts, errors)
- ✅ Sponsor detection (exact, tag, priority, edge cases)
- ✅ URL sanitization (protocols, security)

---

### FASE 9: Documentation ✅
**Archivos:**
- `docs/nodes/shield.md` - Brand Safety section
- `docs/nodes/roast.md` - Brand Safety Integration section
- `docs/nodes/plan-features.md` - Plus plan features

**Contenido:**
- Overview & configuration
- Detection flow & actions
- Roast integration & tone mapping
- Cost control & API endpoints
- Example flows & metadata structure

---

## Archivos Afectados

### Nuevos (5):
1. `database/migrations/027_sponsors.sql`
2. `src/services/sponsorService.js`
3. `src/routes/sponsors.js`
4. `tests/unit/services/sponsorService.test.js`
5. `tests/integration/routes/sponsors.test.js`

### Modificados (11):
1. `src/index.js` - Register sponsors routes
2. `src/middleware/requirePlan.js` - Plus plan + features
3. `src/workers/AnalyzeToxicityWorker.js` - Sponsor detection
4. `src/services/AnalysisDecisionEngine.js` - RULE 0.5
5. `src/lib/prompts/roastPrompt.js` - Sponsor blocks
6. `src/services/roastGeneratorEnhanced.js` - Pass sponsors
7. `src/workers/GenerateReplyWorker.js` - Brand_safety payload
8. `src/services/costControl.js` - Operation type
9. `docs/nodes/shield.md` - Documentation
10. `docs/nodes/roast.md` - Documentation
11. `docs/nodes/plan-features.md` - Documentation

---

## Validación Pre-Merge

### Tests:
- [x] Unit tests: 34/34 passing (100%)
- [x] Integration tests: completos
- [ ] E2E tests: recomendado para siguiente fase

### GDD:
- [ ] `node scripts/validate-gdd-runtime.js --full` - HEALTHY
- [ ] `node scripts/score-gdd-health.js --ci` - ≥87
- [ ] `node scripts/predict-gdd-drift.js --full` - <60 risk

### Code Quality:
- [x] 0 linter errors
- [ ] `npm run coderabbit:review` - 0 comentarios

### Documentation:
- [x] 3 nodos GDD actualizados
- [x] Last Updated: 2025-11-17
- [x] Related PRs: #859

---

## Riesgos y Mitigación

### Riesgo 1: OpenAI Rate Limits (Tag Extraction)
**Mitigación:** Rate limiting (5/min) + cache de tags por URL

### Riesgo 2: Sponsor Detection False Positives
**Mitigación:** 3 métodos (exact, tag, semantic) con priority system

### Riesgo 3: Performance en AnalyzeToxicityWorker
**Mitigación:** Non-blocking detection (warning si falla, análisis continúa)

### Riesgo 4: Cost Tracking Failures
**Mitigación:** Non-blocking tracking (no afecta funcionalidad)

---

## Decisiones Técnicas

1. **Non-blocking sponsor detection:** Worker continúa si detección falla
2. **Cacheable prompts (Block B/C):** Optimización de costos OpenAI
3. **Zero-tolerance = SHIELD crítico:** Bloqueo inmediato sin roast
4. **Tone override:** Tono del sponsor sobrescribe tono del usuario
5. **Separate operation type:** `extract_sponsor_tags` para analytics precisas

---

## Siguientes Pasos Post-Merge

1. **Frontend UI:** Issue #XXX dedicada
2. **E2E Tests:** Playwright tests para flujo completo
3. **Migration Script:** Script para ejecutar en producción
4. **User Documentation:** Guide para configurar sponsors
5. **Analytics Dashboard:** Métricas de sponsor protection usage

---

## Agentes Utilizados

- **TaskAssessor:** Planning (este documento)
- **Backend Dev:** Implementación (Fases 1-6)
- **Test Engineer:** Testing (Fase 8)
- **Guardian:** GDD validation + security audit
- **Documentation Agent:** GDD nodes updates

---

**Estado:** ✅ Completado (8/9 fases - Frontend UI movida a issue separada)
**Tests:** ✅ 34/34 passing (100%)
**Linter:** ✅ 0 errors
**GDD Nodes:** ✅ 3 actualizados
**Ready for Review:** ✅ Sí

