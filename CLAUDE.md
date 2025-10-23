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

## 🎯 POLÍTICA OBLIGATORIA: Uso de GDD, Agentes, Skills y MCPs

**⚠️ CRÍTICO: Esta política es OBLIGATORIA para TODA tarea, sin excepciones.**

### Orchestrator: Responsabilidad de Selección

Como **Orchestrator** (Lead Agent), es MI RESPONSABILIDAD en CADA tarea:

1. **FASE 0 - Assessment con GDD:**
   - ✅ **SIEMPRE** resolver nodos GDD relevantes: `node scripts/resolve-graph.js <nodes>`
   - ✅ **SIEMPRE** leer nodos resueltos (NO spec.md completo)
   - ✅ **SIEMPRE** identificar dependencias y edges

2. **Selección de Recursos:**
   - ✅ **SIEMPRE** evaluar qué agentes se necesitan (ver `agents/manifest.yaml`)
   - ✅ **SIEMPRE** invocar agentes con `Task` tool cuando se cumplen triggers
   - ✅ **SIEMPRE** considerar skills disponibles (`.claude/skills/`)
   - ✅ **SIEMPRE** usar MCPs apropiados (Playwright para UI, etc.)

3. **Invocación Obligatoria:**
   - ✅ **Explore** - Para research de codebase, arquitectura unclear
   - ✅ **TaskAssessor** - Para AC ≥3, features complejas, P0/P1
   - ✅ **TestEngineer** - Para cambios en `src/`, `tests/`, nuevos features
   - ✅ **FrontendDev** - Para cambios UI (`*.jsx`, `*.tsx`, `*.css`)
   - ✅ **Guardian** - Para cambios sensibles (billing, auth, security, GDD nodes)
   - ✅ **general-purpose** - Para PR status, research complejo, multi-step tasks

4. **Generación de Receipts:**
   - ✅ **SIEMPRE** generar receipt en `docs/agents/receipts/<pr>-<Agent>.md`
   - ✅ **O** generar SKIPPED receipt con justificación detallada
   - ✅ CI bloqueará merge si faltan receipts

### Principios de Trabajo

**❌ NUNCA:**
- Trabajar sin resolver nodos GDD primero
- Implementar sin invocar agentes cuando triggers se cumplen
- Ignorar skills o MCPs disponibles
- Hacer research sin usar Explore agent
- Crear PR sin receipts de agentes

**✅ SIEMPRE:**
- GDD primero → Agentes apropiados → Skills/MCPs → Implementación
- Invocar con `Task` tool para ver tags: `<command-message>Agent loading...</command-message>`
- Documentar decisiones en receipts
- Seguir guardrails de cada agente (ver `agents/manifest.yaml`)

### Workflow Estándar

**FASE 0:** Assessment → Resolver nodos GDD → Leer nodos → Identificar agentes → Leer coderabbit-lessons.md
**FASE 1:** Planning → TaskAssessor (AC ≥3) → Plan en docs/plan/ → Explore (si unclear)
**FASE 2:** Implementation → Invocar agentes → Skills/MCPs → Generar receipts
**FASE 3:** Validation → Tests + evidencia visual → Guardian → PR status → 0 conflictos + 0 CodeRabbit comments
**FASE 4:** Commit & PR → Receipts completos → CI pasa → Merge

### Consecuencias de Violación

**Si NO sigo esta política:**
- ❌ CI fallará (receipts faltantes)
- ❌ PR no puede mergear
- ❌ Calidad comprometida
- ❌ No hay audit trail de decisiones

**Enforcement:** CI script `scripts/ci/require-agent-receipts.js` verifica receipts obligatorios.

🔗 **Referencias:**
- Manifest de agentes: `agents/manifest.yaml`
- Inventario de agentes: `docs/agents/INVENTORY.md`
- Skills disponibles: `.claude/skills/` (cuando existan)
- GDD Activation Guide: `docs/GDD-ACTIVATION-GUIDE.md`

---

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

# 📚 For complete testing guide: docs/TESTING-GUIDE.md
# Includes: test commands, env variables, fixtures, CI/CD config, benchmarks

# CodeRabbit CLI - Automated Code Review
npm run coderabbit:review        # Full detailed review (--plain mode)
npm run coderabbit:review:quick  # Quick token-efficient review (--prompt-only)
npm run coderabbit:auth          # Check authentication status
npm run coderabbit:login         # Authenticate with CodeRabbit
npm run coderabbit:logout        # Logout from CodeRabbit
# ⚡ Auto-executes on every commit via pre-commit hook

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

# Demo Mode (Issue #420)
npm run demo:seed                # Seed demo data (orgs, users, comments)
npm run demo:seed:dry            # Preview what would be seeded
npm run demo:seed:force          # Force reseed (delete + recreate)
npm run demo:validate            # Validate fixture files
npm run demo:reset               # Clear all demo data
npm run demo:reset:dry           # Preview what would be deleted
```

### GDD Command Reference

🔗 **Full GDD documentation**: `docs/GDD-ACTIVATION-GUIDE.md`

**Most used commands:**
- `node scripts/validate-gdd-runtime.js --full` - Validate system
- `node scripts/score-gdd-health.js --ci` - Check health score
- `node scripts/auto-repair-gdd.js --auto-fix` - Auto-fix issues
- `node scripts/guardian-gdd.js --full` - Governance scan

See `docs/GDD-ACTIVATION-GUIDE.md` for complete command reference.

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

**Core (P0):**
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
- Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` (fallback)
- AI: `OPENAI_API_KEY`, `PERSPECTIVE_API_KEY`
- Config: `NODE_ENV`, `DEBUG`

**Platform Integrations (P1):** Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit

**Optional:** `ROASTR_API_KEY`, `ROAST_API_URL`, `SHIELD_ENABLED`, `PERSONA_ENCRYPTION_KEY`

🔗 **Full list + setup**: `docs/INTEGRATIONS.md`, `.env.example`

### Setting up Integrations

**Platform integrations** (Twitter, YouTube, Instagram, etc.):
- 🔗 **Full details**: `docs/INTEGRATIONS.md`
- Setup instructions for all 9 supported platforms
- API credentials, rate limits, and architecture

**OpenAI API setup:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to `.env`: `OPENAI_API_KEY=your_key_here`
3. Test: `npm run roast "tu comentario aquí"`

### API Verification Scripts (Issue #490)

**P0 scripts:** `verify-supabase-tables.js`, `verify-openai-api.js`, `verify-twitter-api.js`, `verify-perspective-api.js`
**P1 scripts:** `verify-youtube-api.js`
**Deployment:** `deploy-supabase-schema.js`

**Features:** Error handling, rate limit detection, fallback validation

🔗 **Full checklist**: Issue #490

## Multi-Tenant Architecture

**Core:** Express + PostgreSQL (RLS) + Redis/Upstash queues + Background workers + Cost control + Shield moderation

**Workers:** FetchComments → AnalyzeToxicity → GenerateReply → ShieldAction

**Data flow:** Detection → Fetch → Analyze + Shield → Reply → Moderation (priority queue)

**Scaling:** Horizontal workers, priority queues, Redis/DB failover, cost throttling, monitoring

🔗 **Full architecture**: `docs/nodes/` (roast.md, shield.md, queue.md)

## Master Prompt Template System (v1-roast-prompt)

**Essentials:**
- Dynamic field replacement: comment, category, references, tone
- 🔒 Security: Prompt injection protection, 2000 char limit, input validation
- GDPR rate limiting: 3-10 requests/hour (disabled in test env)
- Plan differentiation: Free (no refs), Pro+ (full examples)

🔗 **Security details**: Issue #127, Issue #115

## Persona Setup System (Issue #595)

Encrypted persona fields for personalized roast filtering: identity, intolerances, tolerances.

**Essentials:**
- AES-256-GCM encryption + OpenAI embeddings (1536-dim)
- Plan-based access: Free (blocked), Starter (2 fields), Pro+ (3 fields)
- API: `/api/persona` (GET/POST/DELETE + health check)
- Env var: `PERSONA_ENCRYPTION_KEY` (⚠️ NEVER change after encryption)

🔗 **Full documentation**: `docs/plan/issue-595.md`

## Orquestación y Reglas

### Función de Orquestador

- **Actuar como orquestador del resto de subagentes**: Coordinar y supervisar tareas de agentes especializados
- **Mantener spec.md actualizado**: Gestionar documento central del sistema
- **Cuando un subagente cree un *.md táctico**: añadir bloque en spec.md para coherencia
- **Invocar Test Engineer Agent**: tras cambios en src/ o docs de diseño para tests + evidencias visuales con Playwright

### 🎯 Lead Orchestrator Rules (ENFORCEMENT)

**📋 Full agent definitions:** `agents/manifest.yaml`
**📊 Quick reference:** `docs/agents/INVENTORY.md`

**CRITICAL: Every PR must follow this protocol:**

#### 1. Pre-Implementation (FASE 0)

**Before any implementation:**
- ✅ **Resolve GDD nodes needed** using `node scripts/resolve-graph.js <nodes>`
- ✅ **Use Explore agent for research** (NEVER load spec.md completely)
- ✅ **Read `docs/patterns/coderabbit-lessons.md`** to avoid known mistakes
- ✅ **If AC ≥3 or multi-area changes:** Create mini-plan in `docs/plan/<issue>.md`

#### 2. Agent Identification

**For each PR, identify required agents by:**

**Labels:**
- `area:frontend`, `area:ui` → **FrontendDev**, **UIDesigner**
- `area:ui` + `branding`, `copy` → **WhimsyInjector**
- `test:*`, `qa`, `validation` → **TestEngineer**
- `priority:P0`, `priority:P1` + AC ≥3 → **TaskAssessor**
- `critical`, `security`, `billing` → **Guardian**

**Diff patterns:**
- `*.jsx`, `*.tsx`, `*.css` → **FrontendDev**
- `src/`, `tests/`, `*.test.js` → **TestEngineer**
- `src/services/costControl.js`, `database/schema.sql`, `docs/nodes/*.md` → **Guardian**
- Research needed, unclear structure → **Explore**

**Conditions:**
- AC ≥3 → **TaskAssessor**
- Complex multi-step tasks → **general-purpose**
- UI/UX changes → **UIDesigner** (may skip if already designed)
- Branding/microcopy → **WhimsyInjector** (NEVER in /legal, /billing, /admin)

#### 3. Agent Invocation & Receipts

**For each required agent:**

### Option A: Invoke the agent

1. Invoke via `Task` tool (Claude Code agents) or execute script (Guardian)
2. Record decisions, artifacts, guardrails verified
3. Generate receipt: `docs/agents/receipts/<pr>-<AgentName>.md`
4. Use template: `docs/agents/receipts/_TEMPLATE.md`

### Option B: Skip with justification

1. Document why agent not needed despite trigger match
2. Assess risks of skipping
3. Get approval if required (Product Owner for CRITICAL Guardian skips)
4. Generate SKIPPED receipt: `docs/agents/receipts/<pr>-<AgentName>-SKIPPED.md`
5. Use template: `docs/agents/receipts/_TEMPLATE-SKIPPED.md`

#### 4. Guardrails (NEVER VIOLATE)

**Orchestrator-specific:**
- ❌ NEVER load spec.md completely (use resolved nodes via `resolve-graph.js`)
- ❌ NEVER expose secrets, API keys, or .env variable names in receipts/docs
- ❌ NEVER skip FASE 0 assessment
- ❌ NEVER proceed without receipts for required agents
- ✅ ALWAYS generate receipts (normal or SKIPPED) for triggered agents
- ✅ ALWAYS update "Agentes Relevantes" in affected GDD nodes
- ✅ ALWAYS validate GDD before commit: `node scripts/resolve-graph.js --validate`

**Agent-specific guardrails:** See `agents/manifest.yaml` for each agent

#### 5. CI Enforcement

**Script:** `scripts/ci/require-agent-receipts.js`

**What it does:**
1. Reads `agents/manifest.yaml`
2. Discovers changed files and labels
3. Matches against agent triggers
4. Verifies receipt exists (normal OR skipped) for each required agent
5. **Fails build (exit 1) if receipts missing**

**PR cannot merge without:**
- ✅ All required agents have receipts
- ✅ Receipts follow template format
- ✅ Guardrails verified in receipts

#### 6. Planning Thresholds

**When to create mini-plan in `docs/plan/<issue>.md`:**
- AC ≥3 (3 or more acceptance criteria)
- Changes span multiple areas (e.g., frontend + backend + tests)
- Complex integrations or refactors
- Multiple agents required

**Mini-plan must include:**
- Estado Actual (current state assessment)
- Agents to be invoked and why
- Files affected per agent
- Validation criteria
- Risk assessment

#### 7. Examples

- **Backend fix** (billing.js, tests/) → TestEngineer + Guardian receipts
- **Frontend feature** (*.jsx, *.css, branding label) → FrontendDev + UIDesigner + WhimsyInjector + TestEngineer
- **Docs-only** → No agents required if no triggers match

#### 8. Violations & Consequences

**If receipts missing:**
- ❌ CI fails with exit 1
- ❌ PR cannot merge
- ❌ Must generate missing receipts and re-push

**If guardrails violated:**
- ❌ Code review rejects PR
- ❌ Must fix violations before re-review
- ❌ Guardian CRITICAL violations require Product Owner approval

**If secrets exposed:**
- 🚨 CRITICAL SECURITY VIOLATION
- 🚨 Immediate PR close and secret rotation
- 🚨 Incident report required

#### 9. Receipt Review Checklist

**For code reviewers:**
- [ ] All required agents identified correctly
- [ ] Receipts exist (normal or SKIPPED) for each required agent
- [ ] SKIPPED receipts have valid justification
- [ ] Guardrails verified in normal receipts
- [ ] No secrets or .env variables exposed
- [ ] Artifacts listed in receipts actually exist
- [ ] GDD nodes updated with agents in "Agentes Relevantes"

---

**Enforcement Status:** ✅ Active (scripts/ci/require-agent-receipts.js)
**Last Updated:** 2025-10-19

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

**Ciclo Completo de Review (OBLIGATORIO después de crear PR):**

1. **Arreglar TODAS las issues de CodeRabbit inmediatamente**
   - Leer cada comentario/sugerencia
   - Implementar TODAS (no "casi todas", TODAS)
   - Commit + push fixes

2. **Inspeccionar PR en GitHub con agente general-purpose**
   - Invocar `Task` tool: "Inspect PR #XXX - report mergeable, jobs, comments, checks"
   - Verificar:
     - ✅ 0 conflictos
     - ✅ Todos CI/CD jobs passing
     - ✅ 0 CodeRabbit comments
     - ✅ All required checks passing

3. **SI hay issues o jobs failing:**
   - Volver al paso 1
   - NO preguntar si continuar
   - NO pedir merge

4. **SOLO cuando todo verde:**
   - Informar: "PR lista para merge"
   - Usuario hace merge (solo usuario puede mergear)

**Mentalidad:** Producto monetizable, no proyecto de instituto. **Calidad > Velocidad.**

### Reglas de Commits y Tests

- **Commit sin tests no permitido**: Todo código nuevo debe incluir pruebas
- **Si código nuevo sin tests → coordinar con Test Engineer** antes de cerrar
- **Cambios en UI/frontend deben incluir evidencias visuales**: capturas + report.md en docs/test-evidence/

### Integration Workflow & Error Prevention

**⚠️ CRITICAL: Before implementing ANY platform integration, follow this protocol to prevent past mistakes.**

**Phase 1: Pre-Implementation (MANDATORY)**

1. **Read integration documentation FIRST:**
   ```bash
   # ALWAYS read before starting
   docs/INTEGRATIONS.md
   docs/nodes/social-platforms.md
   ```

2. **Verify naming conventions:**
   - Service file: `<platform>Service.js` (e.g., `twitterService.js`)
   - Class name: PascalCase (e.g., `TwitterService`)
   - Env vars: `<PLATFORM>_<PROPERTY>` (e.g., `TWITTER_API_KEY`)
   - Test file: `<platform>.test.js`

3. **Check for existing implementation:**
   ```bash
   grep -r "class <Platform>Service" src/integrations/
   ls src/integrations/<platform>/
   ```

**Phase 2: Implementation Checklist**

- [ ] Service implements required interface: `authenticate()`, `fetchComments()`, `postReply()`, `blockUser()`
- [ ] Added platform routing in `FetchCommentsWorker.js`
- [ ] Created integration tests in `tests/integration/<platform>.test.js`
- [ ] NO hardcoded credentials (use env vars only)
- [ ] NO env var examples in public docs (use "🔐 Requires environment variables" line)
- [ ] Error handling for rate limits implemented
- [ ] Logging uses `utils/logger.js` (not `console.log`)

**Phase 3: Post-Implementation (MANDATORY)**

1. **Update documentation:**
   - [ ] Added platform section to `docs/INTEGRATIONS.md` following established format
   - [ ] Updated `docs/nodes/social-platforms.md` with new platform entry
   - [ ] Added to integration status check in `scripts/update-integration-status.js`

2. **Validate naming consistency:**
   ```bash
   # Service file exists
   ls src/integrations/<platform>/<platform>Service.js

   # Worker routing added
   grep -i "<platform>" src/workers/FetchCommentsWorker.js

   # Tests exist
   ls tests/integration/<platform>.test.js
   ```

**Common Past Mistakes:**
- ❌ Duplicated naming (search first)
- ❌ Forgotten worker registration
- ❌ Token leakage in docs
- ❌ Missing tests before PR
- ❌ Outdated documentation

🔗 **Full checklist & lessons**: `docs/patterns/coderabbit-lessons.md`

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
2. **LEER `docs/patterns/coderabbit-lessons.md`** (patrones conocidos)
3. Ejecutar assessment (inline o agent)
4. Recibir recomendación: CREATE | FIX | ENHANCE | CLOSE
5. Actuar según recomendación

🔗 **Patrones aprendidos**: `docs/patterns/coderabbit-lessons.md`

### CodeRabbit Lessons - Workflow de Aprendizaje

**OBLIGATORIO: Leer `docs/patterns/coderabbit-lessons.md` en FASE 0.**

**Workflow:**
- **Antes:** Leer patrones conocidos, aplicar checklist
- **Durante:** Evitar patrones conocidos (semicolons, const/let, console.log)
- **Después:** Identificar nuevos (≥2 ocurrencias) → Actualizar lessons.md → Commit

**Meta:** Reducir repetición <10% = menos tokens + faster reviews

### Planning Mode

- Generar plan en `docs/plan/<issue>.md` con: Estado Actual, pasos, agentes, archivos, validación
- **⚠️ CRÍTICO:** Después de guardar, CONTINUAR inmediatamente con implementación (NO pedir permiso)

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

**CRITICAL: NEVER modify coverage values manually.**

- All nodes: `**Coverage Source:** auto` (from `coverage-summary.json`)
- Automated workflow: `npm test --coverage` → `auto-repair-gdd.js --auto` → commit
- Manual source discouraged (triggers warning, -20 health points)
- Mismatch >3% = CI failure

🔗 **Full rules**: GDD Phase 15.1 documentation

### 🎓 GDD Health Score Management

**⚠️ NUNCA ajustar thresholds sin investigación exhaustiva.**

**Workflow cuando CI falla:**
1. Ver score: `score-gdd-health.js --ci`
2. Actualizar nodos con valores reales
3. Solo entonces ajustar threshold con justificación en `.gddrc.json`

**Principios:**
- ❌ NO shortcuts (no bajar números para pasar CI)
- ✅ Arreglar tests ANTES de continuar
- ✅ Documentar con `note` + `temporary_until`

🔗 **Full guide**: `docs/lessons/gdd-threshold-management.md`

### GDD Activation - Issue Analysis & Context Loading

**CRÍTICO: Cargar SOLO nodos relevantes (NO spec.md completo).**

**Workflow:**
1. Fetch issue: `gh issue view <#> --json labels,title,body`
2. Map labels → nodes
3. Resolve: `node scripts/resolve-graph.js <nodes>`
4. Load resolved nodes only

**During development:**
- ✅ Update affected nodes + "Agentes Relevantes"
- ✅ Validate before commits
- ❌ NEVER load entire spec.md

🔗 **Full workflow + label mapping**: `docs/GDD-ACTIVATION-GUIDE.md`

## GDD 2.0 - Quick Reference

| Phase | Command | Threshold | Full Documentation |
|-------|---------|-----------|-------------------|
| **Validation** | `validate-gdd-runtime.js --full` | 🟢 HEALTHY | [GDD-ACTIVATION-GUIDE.md](docs/GDD-ACTIVATION-GUIDE.md#validation) |
| **Health Score** | `score-gdd-health.js --ci` | ≥87 (temp until 2025-10-31) | [GDD-ACTIVATION-GUIDE.md](docs/GDD-ACTIVATION-GUIDE.md#health) |
| **Drift Detection** | `predict-gdd-drift.js --full` | <60 risk | [GDD-ACTIVATION-GUIDE.md](docs/GDD-ACTIVATION-GUIDE.md#drift) |
| **Auto-Repair** | `auto-repair-gdd.js --auto-fix` | N/A | [GDD-ACTIVATION-GUIDE.md](docs/GDD-ACTIVATION-GUIDE.md#repair) |
| **CI/CD** | Automated workflows | Health ≥87 | [GDD-ACTIVATION-GUIDE.md](docs/GDD-ACTIVATION-GUIDE.md#cicd) |
| **Telemetry** | `collect-gdd-telemetry.js` | N/A | [GDD-TELEMETRY.md](docs/GDD-TELEMETRY.md) |
| **Cross-Val** | `validate-gdd-cross.js --full` | N/A | [GDD-PHASE-15.md](docs/GDD-PHASE-15.md) |

**Before PR:** `Health ≥87`, `Drift <60`, `Tests 100%`, `Coverage: auto`

**Status Levels:** 🟢 HEALTHY (80-100) | 🟡 DEGRADED (50-79) | 🔴 CRITICAL (<50)

---

## Documentation Integrity Policy (Phase 15.3)

**GDD Implementation Summary modularized to prevent token limits.**

**Size limits:**
- Index (`GDD-IMPLEMENTATION-SUMMARY.md`): 350 lines max
- Phase docs (`GDD-PHASE-*.md`): 1,000 lines max

**When adding phase:** Create file, update index, update `.gddindex.json`, verify size.

🔗 **Full policy**: `docs/GDD-PHASE-15.3-MODULARIZATION.md`

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
