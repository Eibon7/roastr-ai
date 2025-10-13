# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive multi-tenant toxicity detection and roast generation system for social media platforms. The project features a scalable architecture built with Node.js, supporting multiple organizations with dedicated workers, cost control, and automated moderation through the Shield system.

## Business Model

The platform operates on a subscription-based model with multiple tiers:

- **Free Plan**: Basic roast generation with limited features and platform access
- **Starter Plan**: €5/month - Enhanced features with increased limits and additional platforms
- **Pro Plan**: €15/month - Advanced features, custom styles, multiple platforms, analytics
- **Plus Plan**: €50/month - Premium tier with maximum capabilities, priority support, custom integrations

*Note: Enterprise plans are not currently available but may be considered for future releases.*

## Development Commands

```bash
# Start the application
npm start
npm run dev                      # Development mode with auto-reload
npm run start:api                # API server only

# CLI and Testing
npm run roast "your message"     # CLI tool
npm test                         # Run all tests
npm run test:coverage            # Tests with coverage

# Multi-tenant worker system
npm run workers:start            # Start all workers
npm run workers:status           # Check worker status
npm run workers:status:watch     # Monitor in real-time

# Queue management
npm run queue:status             # Check queue status
npm run queue:manage             # Interactive management
npm run queue:monitor            # Real-time monitoring
npm run queue:clear-all          # Clear all queues
npm run queue:retry              # Retry failed jobs

# Setup (Issue #237)
npm run setup:test-users:dry     # Preview test users
npm run setup:test-users         # Create test users

# Twitter bot
npm run twitter                  # Run Twitter bot
```

### GDD Command Reference

🔗 **Full GDD documentation**: `docs/GDD-ACTIVATION-GUIDE.md`

| Category | Command | Description |
|----------|---------|-------------|
| **Validation** | `node scripts/validate-gdd-runtime.js --full` | Validate entire system |
| | `node scripts/validate-gdd-runtime.js --diff` | Validate changed nodes only |
| | `node scripts/validate-gdd-runtime.js --node=<name>` | Validate specific node |
| | `node scripts/validate-gdd-runtime.js --ci` | CI mode (exit 1 on errors) |
| **Health & Scoring** | `node scripts/score-gdd-health.js --ci` | Score all nodes |
| | `node scripts/compute-gdd-health.js --threshold=95` | Check health threshold |
| **Drift Prediction** | `node scripts/predict-gdd-drift.js --full` | Predict drift for all nodes |
| | `node scripts/predict-gdd-drift.js --ci` | CI mode (exit 1 if high-risk) |
| | `node scripts/predict-gdd-drift.js --create-issues` | Create GitHub issues for drift |
| **Auto-Repair** | `node scripts/auto-repair-gdd.js --dry-run` | Show what would be fixed |
| | `node scripts/auto-repair-gdd.js --auto-fix` | Apply fixes automatically |
| **Cross-Validation** | `node scripts/validate-gdd-cross.js --full` | Cross-validate all nodes |
| | `node scripts/update-integration-status.js` | Update integration status |
| **Telemetry** | `node scripts/collect-gdd-telemetry.js` | Collect telemetry snapshot |
| | `node scripts/collect-gdd-telemetry.js --ci` | CI mode (silent) |
| **Watch Mode** | `node scripts/watch-gdd.js` | Watch mode (development) |
| | `node scripts/watch-gdd.js --agents-active` | With autonomous agents |
| | `node scripts/watch-gdd.js --telemetry` | With telemetry display |
| | `node scripts/watch-gdd.js --cross` | With cross-validation |
| **Guardian** | `node scripts/guardian-gdd.js --full` | Full governance scan |
| | `node scripts/guardian-gdd.js --ci` | CI mode (exit 0/1/2) |
| | `node scripts/collect-diff.js --verbose` | Generate structured diffs |

## Multi-Tenant Project Structure

```
src/
├── index.js                          # Main API server
├── cli.js                            # CLI tool
├── config/index.js                   # Configuration
├── services/
│   ├── costControl.js                # Usage tracking & billing
│   ├── queueService.js               # Unified Redis/DB queue
│   ├── shieldService.js              # Automated moderation
│   ├── roastPromptTemplate.js        # Master prompt template (v1)
│   ├── roastGeneratorEnhanced.js     # Enhanced roast generation with RQC
│   ├── csvRoastService.js            # CSV-based reference roasts
│   ├── openai.js                     # OpenAI integration
│   └── perspective.js                # Perspective API
├── workers/
│   ├── BaseWorker.js                 # Base worker class
│   ├── FetchCommentsWorker.js        # Comment fetching
│   ├── AnalyzeToxicityWorker.js      # Toxicity analysis
│   ├── GenerateReplyWorker.js        # Roast generation
│   └── ShieldActionWorker.js         # Moderation actions
├── integrations/
│   ├── twitter/twitterService.js     # Twitter API v2
│   ├── youtube/youtubeService.js     # YouTube Data API
│   ├── instagram/instagramService.js # Instagram Basic API
│   ├── facebook/facebookService.js   # Facebook Graph API
│   ├── discord/discordService.js     # Discord Bot API
│   ├── twitch/twitchService.js       # Twitch API
│   ├── reddit/redditService.js       # Reddit API
│   ├── tiktok/tiktokService.js       # TikTok Business API
│   └── bluesky/blueskyService.js     # Bluesky AT Protocol
└── utils/logger.js                   # Logging utility

database/
└── schema.sql                        # Multi-tenant PostgreSQL schema

tests/
├── unit/                             # Service and worker unit tests
├── integration/                      # E2E workflow tests
└── helpers/testUtils.js              # Test utilities
```

## Environment Variables

**Core Database & Queue:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` - Supabase configuration
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis for serverless queues
- `REDIS_URL` - Standard Redis URL (fallback)

**AI & Moderation APIs:**
- `OPENAI_API_KEY` - OpenAI API for roast generation and moderation
- `PERSPECTIVE_API_KEY` - Google Perspective API for toxicity detection
- `NODE_ENV` - Set to 'production' to disable debug logging
- `DEBUG` - Set to 'true' to enable detailed logging

**Platform Integrations:**
- Twitter: `TWITTER_BEARER_TOKEN`, `TWITTER_APP_KEY`, `TWITTER_APP_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- YouTube: `YOUTUBE_API_KEY`
- Instagram: `INSTAGRAM_ACCESS_TOKEN`
- Facebook: `FACEBOOK_ACCESS_TOKEN`
- Discord: `DISCORD_BOT_TOKEN`
- Twitch: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`

**Optional:**
- `ROASTR_API_KEY` - Custom API key for /roast endpoint
- `ROAST_API_URL` - URL of roast API (defaults to production)
- `SHIELD_ENABLED` - Enable Shield moderation (default: true for Pro+ plans)

### Setting up OpenAI API

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create `.env` file: `OPENAI_API_KEY=your_key_here`
3. Run: `npm run roast "tu comentario aquí"`

### Setting up Twitter Integration

1. Create Twitter Developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create project and application
3. Configure permissions to "Read and Write"
4. Generate OAuth 1.0a tokens + Bearer Token
5. Add credentials to `.env`
6. Run: `npm run twitter`

## Multi-Tenant Architecture

The system is built on a comprehensive multi-tenant architecture designed for scale:

**Core Components:**
- **API Layer**: Express server with multi-tenant authentication and organization-scoped endpoints
- **Database Layer**: PostgreSQL with Row Level Security (RLS) for complete tenant isolation
- **Queue System**: Unified Redis/Upstash + Database queue management with priority support
- **Worker System**: Dedicated background workers for scalable comment processing
- **Cost Control**: Usage tracking, billing integration, and automatic limit enforcement
- **Shield System**: Automated content moderation with escalating actions

**Worker Architecture:**
1. **FetchCommentsWorker**: Fetches comments from 9 social media platforms
2. **AnalyzeToxicityWorker**: Analyzes content toxicity using Perspective API + OpenAI fallback
3. **GenerateReplyWorker**: Generates AI roast responses with cost control
4. **ShieldActionWorker**: Executes automated moderation actions (mute, block, report)

**Data Flow:**
```
Comment Detection → fetch_comments queue
  ↓
Comment Fetching → Database → analyze_toxicity queue
  ↓
Toxicity Analysis → generate_reply queue + Shield Analysis
  ↓
Response Generation → post_response queue
  ↓
Shield Actions (if needed) → shield_action queue [Priority 1]
  ↓
Platform Actions → Moderation Complete
```

**Scaling Features:**
- Horizontal scaling via multiple worker instances
- Priority-based job processing (Shield actions get priority 1)
- Automatic failover from Redis to Database queues
- Cost-based throttling to prevent overages
- Real-time monitoring and alerting

## Master Prompt Template System (v1-roast-prompt)

The roast generation system uses a comprehensive master prompt template for consistency, quality, and personalization.

**Key Features:**
- Dynamic field replacement (comment, category, references, tone)
- Automatic comment categorization (insults, body shaming, political, etc.)
- Reference integration from CSV database
- User tone mapping based on preferences and plan features
- Version control for future improvements
- 🔒 Security: Prompt injection protection, input validation, error traceability, length limits

**Security Features (Issue #127):**
- Sanitizes malicious template placeholders
- Strict validation for inputs (type, length, content)
- 2000 character limit to prevent DoS
- Graceful fallback system

**GDPR Rate Limiting (Issue #115):**
- Account Deletion: 3/hour (`DELETE /api/user/account`)
- Data Export: 5/hour (`GET /api/user/data-export`)
- Data Download: 10/hour (`GET /api/user/data-export/download/:token`)
- Deletion Cancellation: 5/hour (`POST /api/user/account/deletion/cancel`)
- Global GDPR Limit: 20/hour across all endpoints

Rate limiters disabled in test environment.

**Template Structure:**
```
Tu tarea es generar una respuesta sarcástica e ingeniosa...
💬 COMENTARIO ORIGINAL: {{original_comment}}
🎭 CATEGORÍA: {{comment_category}}
📚 EJEMPLOS: {{reference_roasts_from_CSV}}
👤 TONO: {{user_tone}}
```

**Integration Points:**
- RoastGeneratorEnhanced (basic moderation + advanced RQC modes)
- GenerateReplyWorker (queue processing)
- Platform-specific constraints (character limits, style guides)
- Plan differentiation (Free excludes references, Pro+ includes full examples)

## Twitter Bot Features

- Mention monitoring, toxicity filtering, roast generation
- Duplicate prevention via `data/processed_tweets.json`
- Rate limiting and error handling

## Orquestación y Reglas

### Función de Orquestador

- **Actuar como orquestador del resto de subagentes**: Coordinar y supervisar tareas de agentes especializados
- **Mantener spec.md actualizado**: Gestionar documento central del sistema
- **Cuando un subagente cree un *.md táctico**: añadir bloque en spec.md para coherencia
- **Invocar Test Engineer Agent**: tras cambios en src/ o docs de diseño para tests + evidencias visuales con Playwright

### Configuración MCP Playwright

**Para cambios de frontend:**
- Ejecutar Playwright MCP para validación visual automatizada
- Capturar screenshots en múltiples viewports
- Revisar consola del navegador y logs de red
- Guardar reporte en `docs/ui-review.md` con evidencias
- Verificar coincidencia con especificaciones de diseño

**Comandos:**
- `/mcp list` - Confirmar Playwright operativo
- `/mcp exec playwright` - Realizar capturas y análisis

### Reglas de PR

- **Cada feature/tarea nueva = nueva PR**: No mezclar funcionalidades
- **No mezclar en PRs ya abiertas salvo fix de review**: Scope limitado
- **Si detectas commits fuera de scope → detener y abrir nueva PR**
- **Documentar reglas en plantilla de PR**

### ⭐ Quality Standards (CRÍTICO)

🔗 **Ver**: `docs/QUALITY-STANDARDS.md`

**Requisitos NO NEGOCIABLES para mergear:**
1. ✅ Sin conflictos con main
2. ✅ CI/CD passing (todos los jobs verdes)
3. ✅ **0 comentarios de CodeRabbit** (CERO, no "casi cero")

**Pre-Flight Checklist OBLIGATORIO:**
- Tests completos y pasando
- Documentación actualizada (CLAUDE.md, spec.md, nodos GDD)
- Code quality (sin console.logs, TODOs, código muerto)
- Self-review exhaustivo (como si fueras CodeRabbit)

**Si CodeRabbit comenta:**
- NO pedir merge
- Implementar TODAS las sugerencias
- Push de correcciones
- Esperar nueva review
- Repetir hasta 0 comentarios

**Mentalidad:** Producto monetizable, no proyecto de instituto. **Calidad > Velocidad.**

### Reglas de Commits y Tests

- **Commit sin tests no permitido**: Todo código nuevo debe incluir pruebas
- **Si código nuevo sin tests → coordinar con Test Engineer** antes de cerrar
- **Cambios en UI/frontend deben incluir evidencias visuales**: capturas + report.md en docs/test-evidence/

### Task Assessment (FASE 0 - OBLIGATORIA)

**IMPORTANTE**: Antes de cualquier planning o implementación, SIEMPRE evalúa el estado actual de la tarea.

**Criterio de Decisión:**

- **Assessment Simple** (Orquestador inline):
  - Tareas con ≤ 2 criterios de aceptación
  - Issues tipo: docs, config simple, fix pequeño
  - Ejecución: búsqueda inline + ejecutar tests si existen

- **Assessment Completo** (Task Assessor Agent):
  - Tareas con ≥ 3 criterios de aceptación
  - Issues P0/P1 críticas
  - Features complejas, integraciones, refactors
  - Ejecución: Invocar Task Assessor Agent → `docs/assessment/<issue>.md`

**Workflow:**
1. Identificar tipo (contar AC, determinar complejidad)
2. Ejecutar assessment (inline o agent)
3. Recibir recomendación: CREATE | FIX | ENHANCE | CLOSE
4. Actuar según recomendación

🔗 **Ejemplos detallados**: Ver sección completa en líneas 448-468 del archivo original

### Planning Mode

- **Antes de implementar, genera siempre un plan en modo texto**
- **El plan debe incluir "Estado Actual"** basado en assessment
- **Describir**: pasos, subagentes, archivos afectados, criterios de validación
- **Guardar en**: `docs/plan/<issue>.md`
- **⚠️ CRÍTICO: Después de guardar, CONTINÚA AUTOMÁTICAMENTE con implementación**
  - NO esperes confirmación del usuario
  - NO preguntes "¿procedemos?"
  - El plan es para documentar, no pedir permiso
  - EJECUTA inmediatamente
  - Solo detenerse por bloqueador técnico real

### Gestión de Agentes Relevantes (GDD Phase 4)

- **Cada nodo en `docs/nodes/*.md` debe mantener actualizada "## Agentes Relevantes"**
- **Reglas de sincronización**:
  - Agente invocado no listado → añádelo automáticamente
  - Agente listado ya no aplica → elimínalo
  - Mantener ordenado alfabéticamente
- **Validación**: `node scripts/resolve-graph.js --validate` antes de cerrar PR
- **Checklist obligatorio al cerrar**:
  - [ ] Leí spec.md y el .md del nodo afectado
  - [ ] Revisé "Agentes Relevantes" refleja agentes usados
  - [ ] Añadí agentes faltantes
  - [ ] Eliminé agentes irrelevantes
  - [ ] Ejecuté validación sin errores
  - [ ] Confirmé tabla global nodos-agentes en spec.md sincronizada
  - [ ] Generé reporte con `--report`

**Tabla global**: Ver "Node-Agent Matrix" en spec.md

### Coverage Authenticity Rules (GDD Phase 15.1)

**NEVER modify `**Coverage:**` values manually. Coverage must be derived from automated reports.**

- **Coverage Source**: All nodes must have `**Coverage Source:** auto`
- **Automated Enforcement**: Validation and Auto-Repair enforce authenticity
- **Manual modifications = integrity violations** → CI failure
- **Data sources**: Primary: `coverage/coverage-summary.json`, Secondary: `lcov.info`
- **Tolerance**: 3% difference allowed
- **Violations**: Mismatch >3% triggers critical violation

**Validation:**
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/auto-repair-gdd.js --auto-fix
```

**Coverage Update Workflow:**
1. `npm test -- --coverage`
2. Coverage report auto-generated
3. `node scripts/auto-repair-gdd.js --auto`
4. Auto-repair reads actual coverage and updates nodes
5. Commit updated nodes

**Manual Override (discouraged):**
- Use `**Coverage Source:** manual` only if data unavailable
- Triggers warning (not error)
- Must justify in PR description
- Switch back to `auto` when available

**Integrity Score:**
- Coverage authenticity = 10% of node health score
- Manual source: -20 points
- Missing source: -10 points
- Mismatch: penalty up to -50 points

**CI/CD**: Blocks merge if coverage integrity violations detected

### 🎓 GDD Health Score Management - Critical Lessons Learned

**⚠️ NUNCA ajustar thresholds sin investigación exhaustiva. Esto es BÁSICO y FUNDAMENTAL para GDD.**

**Workflow OBLIGATORIO cuando CI GDD falla:**

1. **NUNCA hacer shortcuts**:
   - ❌ NO ajustar `.gddrc.json` threshold sin más
   - ❌ NO bajar números solo para pasar CI
   - ❌ NO asumir que el problema es solo el threshold
   - ✅ SÍ investigar root cause primero

2. **Proceso correcto (metodología GDD fundamental):**
   ```bash
   # Paso 1: Ver health score REAL
   node scripts/score-gdd-health.js --ci

   # Paso 2: Identificar qué nodos corresponden a tests nuevos
   # - Mapear test files → source files → GDD nodes
   # - Ejemplo: tierValidation.test.js → src/middleware/tierValidation.js → node "plan-features"

   # Paso 3: Calcular coverage REAL desde tests
   npm test -- --coverage
   # Revisar coverage/coverage-summary.json para valores exactos

   # Paso 4: Actualizar nodos con coverage real
   # Editar docs/nodes/*.md con valores de coverage-summary.json

   # Paso 5: Regenerar health score
   node scripts/score-gdd-health.js --ci

   # Paso 6: Verificar si se alcanza threshold
   # Si NO se alcanza después de actualización correcta:
   # - Analizar matemáticamente si es posible (gap, puntos necesarios)
   # - Solo entonces ajustar threshold con justificación TÉCNICA detallada
   ```

3. **Tests fallidos son oportunidades**:
   - ✅ Arreglar tests fallidos ANTES de continuar
   - ✅ Bugs encontrados en producción → arreglar ahora
   - ✅ False positives → arreglar lógica de validación
   - ✅ Contribuye a health score y calidad general

4. **Coverage Integrity Violations**:
   - Si hay critical violations, verificar `coverage-summary.json`
   - Puede estar desactualizado si solo corriste tests específicos
   - Opciones:
     - A) Correr full test suite: `npm test -- --coverage`
     - B) Sincronizar valores con realidad actual
     - C) Ajustar `fail_on_coverage_integrity: false` si violations son reales

5. **Documentar decisiones**:
   - Threshold adjustments deben tener `note` detallado en `.gddrc.json`
   - Incluir: razón técnica, estado actual, plan de recuperación
   - Establecer `temporary_until` date para recordar restaurar

6. **Actualizar CI workflow si es necesario**:
   - El workflow debe respetar configuración de `.gddrc.json`
   - Verificar que flags como `fail_on_coverage_integrity` se lean correctamente
   - Testear cambios localmente antes de push

**Ejemplo Real (Issue #540 - 2025-10-13):**

❌ **Primer intento (incorrecto):**
- CI falla con health 87.9 < threshold 90
- Cambié threshold de 90 → 89 sin investigar
- Usuario preguntó: "has cambiado el número sin más?"
- **Lección:** Shortcuts violan principios fundamentales de GDD

✅ **Segundo intento (correcto):**
- Ejecuté `node scripts/score-gdd-health.js --ci` → 88.2 real
- Identifiqué tests → nodos: tierValidation → plan-features
- Actualicé coverage con datos de `coverage-summary.json`
- Arreglé 4 tests fallidos (encontrados bugs reales en `inputValidation.js`)
- Regeneré score → 88.7/100
- Analicé matemáticamente: imposible llegar a 90 sin más tests
- Ajusté threshold a 88 con justificación técnica completa
- Actualicé workflow para respetar `fail_on_coverage_integrity: false`

**Resultado:** CI desbloqueado correctamente, siguiendo metodología GDD adecuada

**Mentalidad:** El threshold GDD no es un obstáculo burocrático, es un indicador de salud del sistema. Bajarlo sin entender por qué es como ignorar el check engine light de un auto.

### GDD Activation - Issue Analysis & Context Loading

🔗 **Full details**: `docs/GDD-ACTIVATION-GUIDE.md`

**IMPORTANTE**: El Orchestrator debe usar GDD para **todas las issues**, cargando solo nodos relevantes (NO spec.md completo).

**When user mentions issue number** (e.g., "Issue #408"):

1. **Fetch metadata**: `gh issue view 408 --json labels,title,body`
2. **Map labels → nodes** (ver tabla completa en líneas 561-577)
3. **Keyword fallback** si no hay label `area:*` (ver tabla líneas 579-591)
4. **Resolve dependencies**: `node scripts/resolve-graph.js <nodes>`
5. **Load ONLY resolved nodes** (NO spec.md)
6. **Announce context loaded** (ver ejemplo líneas 601-618)

**During Development:**
- ✅ Read nodes, NOT spec.md (unless `test:e2e` or `area:observability`)
- ✅ Update affected nodes when code changes
- ✅ Add agents to "Agentes Relevantes" if invoked but not listed
- ✅ Run validation before commits
- ❌ NEVER load entire spec.md unless explicitly required
- ❌ NEVER skip node updates
- ❌ NEVER commit without validation

**Before Closing PR:**
- [ ] Verified "Agentes Relevantes" reflects agents used
- [ ] Added missing agents, removed irrelevant
- [ ] Ran `node scripts/resolve-graph.js --validate` → no errors
- [ ] Generated report with `--report`
- [ ] Included GDD summary in PR description

**Fallback**: Si no puedes determinar nodos → preguntar al usuario área de feature

## GDD 2.0 Reference

### Runtime Validation Workflow

🔗 **Full details**: `docs/GDD-ACTIVATION-GUIDE.md#runtime-validation`

GDD Runtime Validator monitors coherence between `system-map.yaml`, `docs/nodes/**`, `spec.md`, and `src/**`.

**Key Commands:**
```bash
node scripts/validate-gdd-runtime.js --full    # Validate entire system
node scripts/validate-gdd-runtime.js --ci      # CI mode (exit 1 on errors)
node scripts/watch-gdd.js                      # Watch mode (development)
```

**Status Levels:** 🟢 HEALTHY | 🟡 WARNING | 🔴 CRITICAL

**Before PR Merge:** Run full validation, ensure 🟢 HEALTHY or acceptable 🟡 WARNING

---

### Node Health Scoring System (Phase 7)

🔗 **Full details**: `docs/GDD-ACTIVATION-GUIDE.md#health-scoring`

Quantitative metrics (0-100) based on weighted factors: Sync Accuracy (30%), Update Freshness (20%), Dependency Integrity (20%), Coverage Evidence (20%), Agent Relevance (10%).

**Commands:**
```bash
node scripts/score-gdd-health.js              # Standalone scoring
node scripts/validate-gdd-runtime.js --score  # Combined validation + scoring
```

**Status:** 🟢 HEALTHY (80-100) | 🟡 DEGRADED (50-79) | 🔴 CRITICAL (<50)

**Before PR:** Average score > 75, no critical nodes

---

### Predictive Drift Detection (Phase 8)

🔗 **Full details**: `docs/GDD-ACTIVATION-GUIDE.md#drift-prediction`

Calculates **Drift Risk Score (0-100)** based on: last updated, active warnings, test coverage, health score, recent activity.

**Commands:**
```bash
node scripts/predict-gdd-drift.js --full         # Run drift prediction
node scripts/predict-gdd-drift.js --ci           # CI mode (exit 1 if high-risk)
node scripts/predict-gdd-drift.js --create-issues # Create issues for high-risk nodes
```

**Risk Levels:** 🟢 Healthy (0-30) | 🟡 At Risk (31-60) | 🔴 Likely Drift (61-100)

**Before PR:** Check drift risk, address nodes with risk > 60

---

### CI/CD GDD Automation (Phase 12)

🔗 **Full details**: `docs/GDD-ACTIVATION-GUIDE.md#cicd-automation`

**Configuration:** `.gddrc.json` (min_health_score: 95, auto_fix: true, block_merge_below_health: 95)

**Workflows:**
1. **GDD Validation** (`.github/workflows/gdd-validate.yml`) - Validates on PR, blocks merge if health < 95
2. **GDD Auto-Repair** (`.github/workflows/gdd-repair.yml`) - Auto-fixes missing sections, broken links

**Before PR:**
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/predict-gdd-drift.js --full
node scripts/compute-gdd-health.js --threshold=95
node scripts/auto-repair-gdd.js --auto-fix  # If needed
```

**Success Criteria:** Health ≥ 95, no critical nodes, drift < 60

---

### Telemetry & Analytics Layer (Phase 13)

🔗 **Full details**: `docs/GDD-TELEMETRY.md`

Historical telemetry tracks system evolution over time.

**Key Metrics:** Health Score (≥95), Drift Risk (<25), Stability Index (≥90), Auto-Fix Success (≥90%), Momentum (>0)

**Commands:** See `docs/GDD-TELEMETRY.md` for complete reference

---

### Cross-Validation & Extended Health Metrics (Phase 15)

🔗 **Full details**: `docs/GDD-PHASE-15.md`

**System Health Intelligence Layer** with cross-validation and connectivity metrics.

**Three Enhancements:**
1. **Cross-Validation Engine**: Validates consistency between node metadata and runtime data
2. **Integration Status Tracking**: Monitors 9 external platform integrations
3. **Unified Health Intelligence**: Composite health score combining doc health, cross-validation, connectivity

**Commands:** See `docs/GDD-PHASE-15.md` for complete reference

**Performance Targets:**
- Cross-validate 13 nodes: <1s (~800ms) ✅
- Update integration status: <2s (~1.2s) ✅
- Extended health scoring: <1s (~600ms) ✅

---

## Documentation Integrity Policy (Phase 15.3)

### GDD Implementation Summary Governance

**Effective:** October 8, 2025

The GDD Implementation Summary has been modularized to prevent token limit errors.

**Size Limits:**
- **GDD Implementation Summary Index** (`docs/GDD-IMPLEMENTATION-SUMMARY.md`): 350 lines max (~5,000 tokens)
- **Phase Documentation** (`docs/implementation/GDD-PHASE-*.md`): 1,000 lines max per file

**Mandatory Structure:** All phase docs must include header with back-link, content sections (objective, implementation, results, testing, files), footer with navigation.

**Update Requirements:** When adding new phase, MUST update:
1. ✅ Create phase file: `docs/implementation/GDD-PHASE-<number>.md`
2. ✅ Update index: `docs/GDD-IMPLEMENTATION-SUMMARY.md`
3. ✅ Update metadata: `docs/.gddindex.json`
4. ✅ Verify size: Ensure index <350 lines

**Enforcement:**
- CI/CD validation checks index size
- Auto-Repair can fix missing references
- Health scoring monitors doc size
- Manual edits require Orchestrator approval

**Rationale:** Previous monolithic file (3,069 lines) caused token limit errors. Phase 15.3 reduced index to 249 lines (93% reduction), eliminated errors, improved read time from 800ms+ to <50ms.

🔗 **Full details**: `docs/GDD-PHASE-15.3-MODULARIZATION.md`

---

## Tareas al Cerrar

**🚨 VERIFICACIÓN OBLIGATORIA antes de marcar tarea completa:**

1. **Tests DEBEN PASAR al 100%**:
   ```bash
   npm test -- <relevant-tests>
   npm test <test-file>.test.js
   ```
   - ✅ **0 tests fallando** - Si hay 1 solo test rojo, tarea NO completa
   - ❌ **NUNCA marcar completa con tests failing**
   - Si tests fallan → arreglar ANTES de continuar

2. **Pre-Flight Checklist ejecutado**:
   - [ ] Tests pasando
   - [ ] Documentación actualizada
   - [ ] Code quality verificado
   - [ ] Self-review completado

3. **Documentación actualizada**:
   - spec.md reflejando cambios
   - Nodos GDD con status actualizado
   - Mapa de cobertura de tests + evidencias visuales
   - Changelog detallado en PR

**⚠️ Si encuentras tests failing:**
- NO continúes con siguiente tarea
- NO marques como completa
- Arregla los tests AHORA
- Re-ejecuta para verificar
- Solo entonces procede
