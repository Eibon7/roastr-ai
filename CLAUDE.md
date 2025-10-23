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

```
[FASE 0] Assessment
├── Resolver nodos GDD → node scripts/resolve-graph.js <nodes>
├── Leer nodos (docs/nodes/*.md)
├── Identificar agentes necesarios (agents/manifest.yaml)
└── Leer coderabbit-lessons.md (patrones conocidos)

[FASE 1] Planning
├── Invocar TaskAssessor si AC ≥3
├── Crear plan en docs/plan/<issue>.md si multi-área
└── Invocar Explore si codebase unclear

[FASE 2] Implementation
├── Invocar agentes especializados (FrontendDev, TestEngineer, etc.)
├── Usar skills apropiados (.claude/skills/)
├── Usar MCPs apropiados (Playwright, etc.)
└── Generar receipts para cada agente

[FASE 3] Validation
├── TestEngineer genera tests + evidencia visual
├── Guardian valida cambios sensibles
├── general-purpose inspecciona PR status
└── Verificar 0 conflictos, 0 CodeRabbit comments

[FASE 4] Commit & PR
├── Todos los receipts generados
├── CI pasa (scripts/ci/require-agent-receipts.js)
└── PR lista para merge
```

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
| **Metrics Sync** | `node scripts/sync-gdd-metrics.js --dry-run` | Preview metrics sync from JSON files |
| | `node scripts/sync-gdd-metrics.js --auto` | Auto-sync all metrics to docs |
| | `node scripts/sync-gdd-metrics.js --validate` | Validate metric consistency |
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

Comprehensive verification scripts for all configured APIs:

```bash
# Core P0 APIs (Required for MVP)
node scripts/verify-supabase-tables.js      # Database: core tables, RLS policies
node scripts/verify-openai-api.js           # AI: available GPT models, moderation
node scripts/verify-twitter-api.js          # Platform: OAuth 1.0a/2.0, @Roastr_ai
node scripts/verify-perspective-api.js      # Toxicity: analysis attributes, fallback

# Platform Integrations (P1)
node scripts/verify-youtube-api.js          # Video platform: search, comments

# Database deployment
node scripts/deploy-supabase-schema.js      # Deploy schema to Supabase
```

**Features:**
- ✅ Comprehensive error handling with troubleshooting guidance
- ✅ Rate limit detection and reporting
- ✅ Clear success/failure indicators
- ✅ Verification of all critical functionality
- ✅ Fallback system validation

**Status:** All P0 APIs verified and production-ready. See Issue #490 for full configuration checklist.

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

## Persona Setup System (Issue #595)

The Persona Setup feature allows users to define their identity, intolerances, and tolerances for personalized roast filtering and generation.

**Key Features:**
- 3 encrypted persona fields: identity (lo_que_me_define), intolerance (lo_que_no_tolero), tolerance (lo_que_me_da_igual)
- AES-256-GCM encryption for data at rest
- OpenAI embeddings (text-embedding-3-small, 1536 dimensions) for semantic matching
- Plan-based access control (Free blocked, Starter: 2 fields, Pro+: 3 fields)
- Full REST API with JWT authentication
- GDPR compliance (full deletion capability)

**Security Features:**
- Industry-standard AES-256-GCM encryption with unique IVs
- Authentication tags prevent tampering
- No plaintext logging of sensitive data
- Input sanitization (XSS, SQL injection prevention)
- Character limits (300 chars plaintext, 500 encrypted)

**API Endpoints:**
- `GET /api/persona` - Retrieve user's persona (decrypted)
- `POST /api/persona` - Create/update persona (encrypted storage)
- `DELETE /api/persona` - Delete persona (GDPR compliance)
- `GET /api/persona/health` - Service health check

**Database Schema:**
- 18 persona columns in `users` table (3 fields × 6 columns each)
- pgvector extension for embedding storage and similarity search
- Helper functions: `user_has_embeddings()`, `get_user_embeddings_metadata()`, `embeddings_need_regeneration()`

**Plan Access Matrix:**
- Free/Basic: No access (blocked)
- Starter: `lo_que_me_define`, `lo_que_no_tolero` (2 fields)
- Pro/Plus/Enterprise: All 3 fields including `lo_que_me_da_igual`

**Implementation Files:**
- Service: `src/services/PersonaService.js`
- Routes: `src/routes/persona.js`
- Encryption: `src/utils/encryption.js`
- Migration: `database/migrations/001_add_persona_fields.sql`
- Tests: `tests/unit/services/PersonaService.test.js`, `tests/integration/persona-api.test.js`

**Environment Variable:**
- `PERSONA_ENCRYPTION_KEY` - 64-character hex key (generate with `node scripts/generate-persona-key.js`)
- ⚠️ CRITICAL: Never change this key after data is encrypted or all personas will be lost

**Test Coverage:** 97% (149/154 tests passing)

🔗 **Full documentation**: `docs/plan/issue-595.md`, `docs/test-evidence/issue-595/SUMMARY.md`

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

### Example 1: Simple Backend Fix

```bash
PR #700: Fix billing calculation bug
Changed: src/services/billing.js, tests/unit/services/billing.test.js
Labels: area:backend, priority:P1

Required agents:
- TestEngineer (diff: tests/)
- Guardian (diff: billing.js - sensitive)

Receipts generated:
- docs/agents/receipts/700-TestEngineer.md ✅
- docs/agents/receipts/700-Guardian.md ✅ (exit 0, no violations)
```

### Example 2: Frontend Feature with Branding

```bash
PR #701: New dashboard UI with microcopy
Changed: frontend/components/Dashboard.jsx, frontend/styles/dashboard.css
Labels: area:frontend, area:ui, branding

Required agents:
- FrontendDev (diff: *.jsx, *.css)
- UIDesigner (label: area:ui)
- WhimsyInjector (label: branding)
- TestEngineer (AC: Must have E2E tests)

Receipts generated:
- docs/agents/receipts/701-FrontendDev.md ✅
- docs/agents/receipts/701-UIDesigner-SKIPPED.md (Design pre-approved in #695)
- docs/agents/receipts/701-WhimsyInjector.md ✅
- docs/agents/receipts/701-TestEngineer.md ✅
```

### Example 3: Docs-Only Change

```bash
PR #702: Update integration guide
Changed: docs/INTEGRATIONS.md
Labels: docs

Required agents: NONE (no triggers match)

Receipts: None needed
CI: Passes with 0 required agents
```

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

### 🛡️ Completion Validation (MANDATORY BEFORE MERGE)

**NEVER merge a PR without 100% completion validation.**

The Guardian agent has been extended with automated completion validation to ensure NO PR is merged incomplete.

**Automated Validation Checks:**

1. **Acceptance Criteria**: All AC from issue body marked as complete
2. **Test Coverage**: ≥90% coverage (or specified threshold)
3. **Tests Passing**: npm test exits with code 0 (zero failures)
4. **Agent Receipts**: All required agents have receipts (normal or SKIPPED)
5. **Documentation**: GDD nodes updated, test evidence generated
6. **CodeRabbit**: 0 comments pending (absolutely zero)
7. **CI/CD Status**: All checks passing, no failures or pending jobs

**Workflow:**

```bash
# Before marking PR as "ready to merge"
npm run validate:completion -- --pr=628

# Expected output if complete (exit 0):
# ✅ PR IS 100% COMPLETE AND READY TO MERGE

# If incomplete (exit 1):
# ⚠️  PR IS INCOMPLETE - CONTINUE IMPLEMENTATION
# (Shows pending items with actionable next steps)

# If critical issues (exit 2):
# 🚨 CRITICAL ISSUES DETECTED - DO NOT MERGE
# (Failing tests or CI - must fix immediately)
```

**Integration Points:**

- **Manual trigger**: Developer runs before requesting merge
- **CI automation**: `.github/workflows/pre-merge-validation.yml`
- **Guardian agent**: Invoked via completion_script in manifest.yaml
- **Quality gate**: Cannot merge if exit code ≠ 0

**Exit Codes:**

- `0`: 100% complete, ready to merge
- `1`: Incomplete, continue implementation
- `2`: Critical blockers (failing tests/CI), do NOT merge

**Violations:**

- ❌ Merging incomplete PR = immediate PR rejection + re-work
- ❌ Bypassing validation = violation of "hacer las cosas bien" principle
- ❌ Ignoring critical exit code (2) = unacceptable technical debt

**Why This Matters:**

- Prevents half-finished features from reaching main
- Ensures systematic completion (no "90% done" PRs)
- Enforces documentation and test requirements
- Maintains high-quality standards for monetizable product
- Reduces re-work and technical debt

**🔗 Full documentation**: `docs/policies/completion-validation.md`

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

**Common Past Mistakes (Learn from CodeRabbit):**

❌ **Mistake 1: Duplicated naming**
- Issue: Created `twitterIntegration.js` when `twitterService.js` existed
- Fix: Always search codebase first, follow naming convention

❌ **Mistake 2: Forgotten service registration**
- Issue: Created service but forgot to register in FetchCommentsWorker
- Fix: Follow checklist, grep for platform name in worker files

❌ **Mistake 3: Token leakage in docs**
- Issue: Added `YOUTUBE_API_KEY=your_key_here` to public docs
- Fix: NEVER include env var examples in docs/INTEGRATIONS.md

❌ **Mistake 4: Inconsistent error handling**
- Issue: Each integration handled rate limits differently
- Fix: Follow existing patterns in other services, use shared utilities

❌ **Mistake 5: Missing tests**
- Issue: Integration deployed without integration tests
- Fix: Checklist item mandatory, tests must exist before PR

❌ **Mistake 6: Outdated documentation**
- Issue: Implemented integration but forgot to update docs/INTEGRATIONS.md
- Fix: Phase 3 checklist mandatory, no PR without doc updates

**Enforcement:**

- ✅ This checklist is part of Pre-Flight Checklist
- ✅ CodeRabbit will flag violations
- ✅ 0 comments rule applies (fix ALL suggestions)
- ✅ GDD validation includes integration documentation check

**Principle:** "Hacer las cosas bien y escalables" - Take time to do it right the first time. Self-document, follow conventions, maintain consistency.

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

**OBLIGATORIO: Leer antes de TODA implementación (FASE 0 o FASE 2)**

**Antes de implementar:**
1. **Leer:** `docs/patterns/coderabbit-lessons.md`
2. **Consultar:** Patrones conocidos (ESLint, testing, GDD, security)
3. **Aplicar:** Checklist pre-implementación del documento

**Durante implementación:**
- Seguir reglas documentadas
- Evitar patrones conocidos (semicolons, const/let, console.log, etc.)
- Aplicar fixes preventivos

**Después de review CodeRabbit:**
1. **Identificar nuevos patrones** (≥2 ocurrencias del mismo error)
2. **Actualizar:** `docs/patterns/coderabbit-lessons.md`
   - Añadir sección ❌ Mistake / ✅ Fix
   - Actualizar estadísticas
3. **Generar SUMMARY:** Usar `docs/templates/SUMMARY-template.md`
   - Enfoque en patrones, NO cronología
   - Máximo 50 líneas (vs 300+ antes)
   - Extraer root causes y acciones correctivas
4. **Commit:** `docs(patterns): Add CodeRabbit lesson - <patrón>`

**Objetivo:** Reducir tasa de repetición <10% en todos los patrones

**Beneficio:** Menos idas y venidas con CodeRabbit = menos tokens + faster reviews

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

### 🎓 GDD Health Score Management - Principios Fundamentales

**⚠️ NUNCA ajustar thresholds sin investigación exhaustiva.**

**Workflow cuando CI GDD falla:**

1. **Ver score real:** `node scripts/score-gdd-health.js --ci`
2. **Mapear cambios:** test files → source files → GDD nodes
3. **Calcular coverage real:** `npm test -- --coverage` → revisar `coverage-summary.json`
4. **Actualizar nodos:** Editar `docs/nodes/*.md` con valores reales
5. **Regenerar score:** Verificar si threshold es alcanzable matemáticamente
6. **Solo entonces ajustar threshold** con justificación técnica detallada en `.gddrc.json`

**Principios:**
- ❌ NO shortcuts: No bajar números solo para pasar CI
- ❌ NO exponer keys: NUNCA incluir API keys, tokens, passwords en código o docs públicas
- ✅ Tests fallidos = oportunidades: Arreglar ANTES de continuar
- ✅ Documentar decisiones: Incluir `note` + `temporary_until` en `.gddrc.json`
- ✅ **Hacer las cosas bien y escalables:** Investigar root cause, no parches rápidos

**Mentalidad:** GDD threshold es indicador de salud del sistema, no obstáculo burocrático.

**Security:** Todas las credenciales en env vars. Docs públicas: usar "🔐 Requires environment variables"

🔗 **Lección completa con ejemplo:** `docs/lessons/gdd-threshold-management.md`

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
