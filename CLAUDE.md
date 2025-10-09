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

# Start in development mode with auto-reload
npm run dev

# Start API server
npm run start:api

# Use CLI tool
npm run roast "your message here"

# Run Twitter bot
npm run twitter

# Install dependencies
npm install

# Setup admin and test users for backoffice development (Issue #237)
npm run setup:test-users:dry      # Preview what will be created
npm run setup:test-users          # Execute the setup

# Multi-tenant worker system
npm run workers:start           # Start all workers
npm run workers:status          # Check worker status
npm run workers:status:watch    # Monitor workers in real-time

# Queue management
npm run queue:status            # Check queue status
npm run queue:manage            # Interactive queue management
npm run queue:monitor           # Real-time queue monitoring
npm run queue:clear-all         # Clear all queues
npm run queue:retry             # Retry failed jobs

# Testing
npm test                        # Run all tests
npm run test:coverage           # Run tests with coverage

# GDD Runtime Validation (Graph-Driven Development 2.0)
node scripts/validate-gdd-runtime.js --full    # Validate entire system
node scripts/validate-gdd-runtime.js --diff    # Validate only changed nodes
node scripts/validate-gdd-runtime.js --node=shield  # Validate specific node
node scripts/validate-gdd-runtime.js --report  # Generate report only
node scripts/validate-gdd-runtime.js --ci      # CI mode (exit 1 on errors)
node scripts/validate-gdd-runtime.js --drift   # Include drift prediction
node scripts/watch-gdd.js                      # Watch mode (development)

# GDD Drift Prediction (Phase 8)
node scripts/predict-gdd-drift.js --full       # Predict drift risk for all nodes
node scripts/predict-gdd-drift.js --node=shield  # Analyze specific node
node scripts/predict-gdd-drift.js --ci         # CI mode (exit 1 if high-risk)
node scripts/predict-gdd-drift.js --create-issues  # Create GitHub issues for high-risk nodes

# GDD Auto-Repair (Phase 10)
node scripts/auto-repair-gdd.js --dry-run      # Show what would be fixed
node scripts/auto-repair-gdd.js --auto-fix     # Apply fixes automatically
node scripts/auto-repair-gdd.js --ci           # CI mode (exit 1 on errors)

# GDD Health Scoring (Phase 7)
node scripts/score-gdd-health.js --ci          # Score all nodes
node scripts/compute-gdd-health.js --threshold=95  # Check health threshold

# GDD Agent Interface (Phase 14)
node scripts/agents/agent-interface.js --simulate  # Test agent permissions
node scripts/agents/secure-write.js --test     # Test secure write protocol
node scripts/agents/telemetry-bus.js --listen  # Listen to telemetry events
node scripts/agents/telemetry-bus.js --test    # Test telemetry bus

# GDD Watch with Agents (Phase 14.1)
node scripts/watch-gdd.js --agents-active      # Watch with autonomous agents
node scripts/watch-gdd.js --telemetry          # Watch with telemetry display
node scripts/watch-gdd.js --agents-active --telemetry  # Full agent integration
```

## Multi-Tenant Project Structure

```
src/
├── index.js                          # Main API server
├── cli.js                            # CLI tool for testing
├── server.js                         # Alternative server entry point
├── config/
│   └── index.js                      # Configuration management
├── services/
│   ├── costControl.js                # Usage tracking & billing
│   ├── queueService.js               # Unified Redis/DB queue system
│   ├── shieldService.js              # Automated moderation
│   ├── roastPromptTemplate.js        # Master prompt template system (v1)
│   ├── roastGeneratorEnhanced.js     # Enhanced roast generation with RQC
│   ├── csvRoastService.js            # CSV-based reference roast system
│   ├── openai.js                     # OpenAI integration
│   ├── perspective.js                # Perspective API
│   └── twitter.js                    # Legacy Twitter bot
├── workers/
│   ├── BaseWorker.js                 # Base worker class
│   ├── FetchCommentsWorker.js        # Comment fetching
│   ├── AnalyzeToxicityWorker.js      # Toxicity analysis
│   ├── GenerateReplyWorker.js        # Roast generation
│   ├── ShieldActionWorker.js         # Moderation actions
│   └── cli/
│       ├── start-workers.js          # Worker management
│       ├── worker-status.js          # Status monitoring  
│       └── queue-manager.js          # Queue management
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
└── utils/
    └── logger.js                     # Logging utility

database/
└── schema.sql                        # Multi-tenant PostgreSQL schema

tests/
├── unit/
│   ├── services/                     # Service unit tests
│   └── workers/                      # Worker unit tests
├── integration/
│   └── multiTenantWorkflow.test.js   # E2E workflow tests
└── helpers/
    └── testUtils.js                  # Test utilities
```

## Environment Variables

Set these environment variables for API integrations:

**Core Database & Queue:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key (for server operations)
- `SUPABASE_ANON_KEY` - Supabase anonymous key (for client operations)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL for serverless queues
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token
- `REDIS_URL` - Standard Redis URL (fallback)

**AI & Moderation APIs:**
- `OPENAI_API_KEY` - OpenAI API key for roast generation and content moderation
- `PERSPECTIVE_API_KEY` - Google Perspective API key for toxicity detection
- `NODE_ENV` - Set to 'production' to disable debug logging
- `DEBUG` - Set to 'true' to enable detailed logging

**Platform Integrations:**
- `TWITTER_BEARER_TOKEN` - Twitter Bearer Token for reading
- `TWITTER_APP_KEY` - Twitter Consumer Key
- `TWITTER_APP_SECRET` - Twitter Consumer Secret  
- `TWITTER_ACCESS_TOKEN` - Twitter Access Token for posting
- `TWITTER_ACCESS_SECRET` - Twitter Access Token Secret
- `YOUTUBE_API_KEY` - YouTube Data API v3 key
- `INSTAGRAM_ACCESS_TOKEN` - Instagram Basic Display API token
- `FACEBOOK_ACCESS_TOKEN` - Facebook Graph API token
- `DISCORD_BOT_TOKEN` - Discord bot token
- `TWITCH_CLIENT_ID` - Twitch API client ID
- `TWITCH_CLIENT_SECRET` - Twitch API client secret
- `REDDIT_CLIENT_ID` - Reddit API client ID
- `REDDIT_CLIENT_SECRET` - Reddit API client secret

**Optional Configuration:**
- `ROASTR_API_KEY` - Custom API key for /roast endpoint authentication
- `ROAST_API_URL` - URL of roast API (optional, defaults to production)
- `SHIELD_ENABLED` - Enable Shield automated moderation (default: true for Pro+ plans)

### Setting up OpenAI API for real roast generation:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env` file in the project root:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Run the CLI with real AI: `npm run roast "tu comentario aquí"`

If the OpenAI API fails, the CLI automatically falls back to the mock generator.

### Setting up Twitter Integration:

1. Create a Twitter Developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create a new project and application
3. Configure app permissions to "Read and Write" 
4. Generate OAuth 1.0a tokens (for posting) and Bearer Token (for reading)
5. Add all credentials to `.env` file
6. Run `npm run twitter` to start the bot

## Multi-Tenant Architecture

The system is built on a comprehensive multi-tenant architecture designed for scale:

### Core Components

- **API Layer**: Express server with multi-tenant authentication and organization-scoped endpoints
- **Database Layer**: PostgreSQL with Row Level Security (RLS) for complete tenant isolation
- **Queue System**: Unified Redis/Upstash + Database queue management with priority support
- **Worker System**: Dedicated background workers for scalable comment processing
- **Cost Control**: Usage tracking, billing integration, and automatic limit enforcement
- **Shield System**: Automated content moderation with escalating actions

### Worker Architecture

1. **FetchCommentsWorker**: Fetches comments from 9 social media platforms
2. **AnalyzeToxicityWorker**: Analyzes content toxicity using Perspective API + OpenAI fallback
3. **GenerateReplyWorker**: Generates AI roast responses with cost control
4. **ShieldActionWorker**: Executes automated moderation actions (mute, block, report)

### Data Flow

```
Comment Detection → Queue (fetch_comments)
    ↓
Comment Fetching → Store in Database → Queue (analyze_toxicity)
    ↓
Toxicity Analysis → Update Database → Queue (generate_reply) + Shield Analysis
    ↓
Response Generation → Store Roast → Queue (post_response)
    ↓
Shield Actions (if needed) → Queue (shield_action) [Priority 1]
    ↓
Platform Actions → Moderation Complete
```

### Scaling Features

- **Horizontal scaling** via multiple worker instances
- **Priority-based job processing** (Shield actions get priority 1)
- **Automatic failover** from Redis to Database queues
- **Cost-based throttling** to prevent overages
- **Real-time monitoring** and alerting

## Master Prompt Template System (v1-roast-prompt)

The roast generation system has been enhanced with a comprehensive master prompt template that ensures consistency, quality, and personalization across all roast generations.

### Key Features

- **Dynamic Field Replacement**: Supports placeholders for original comment, category, references, and user tone
- **Comment Categorization**: Automatically categorizes comments (insults, body shaming, political, etc.)
- **Reference Integration**: Includes similar roasts from CSV database as examples
- **User Tone Mapping**: Personalizes responses based on user preferences and plan features
- **Version Control**: Template versioning for future improvements and A/B testing
- **🔒 Security Protection**: Robust input sanitization and prompt injection prevention

### Security Features (Issue #127)

- **Prompt Injection Protection**: Automatically sanitizes malicious template placeholders (`{{placeholder}}` patterns)
- **Input Validation**: Strict validation for `originalComment` (type, length, content)
- **Error Traceability**: Comprehensive logging with error context and version tracking
- **Length Limits**: 2000 character limit to prevent DoS attacks
- **Fallback System**: Graceful degradation when validation fails or errors occur

### GDPR Rate Limiting (Issue #115)

The system implements strict rate limiting for GDPR-sensitive endpoints to prevent DoS and brute force attacks:

- **Account Deletion**: 3 attempts per hour per IP/user (`DELETE /api/user/account`)
- **Data Export**: 5 attempts per hour per IP/user (`GET /api/user/data-export`)  
- **Data Download**: 10 attempts per hour per IP/token (`GET /api/user/data-export/download/:token`)
- **Deletion Cancellation**: 5 attempts per hour per IP/user (`POST /api/user/account/deletion/cancel`)
- **Global GDPR Limit**: 20 total GDPR requests per hour per IP across all endpoints

Rate limiters are automatically disabled in test environment and can be configured via feature flags.

### Template Structure

```
Tu tarea es generar una respuesta sarcástica e ingeniosa...

💬 COMENTARIO ORIGINAL: {{original_comment}}
🎭 CATEGORÍA DEL COMENTARIO: {{comment_category}}
📚 EJEMPLOS DE ROASTS: {{reference_roasts_from_CSV}}
👤 TONO PERSONAL: {{user_tone}}
```

### Integration Points

- **RoastGeneratorEnhanced**: Used in both basic moderation and advanced RQC modes
- **GenerateReplyWorker**: Integrated into the worker pipeline for queue processing
- **Platform Constraints**: Automatically adds platform-specific character limits and style guides
- **Plan Differentiation**: Free plans exclude references, Pro+ plans include full examples
- **Security Layer**: All inputs sanitized before template processing

### Usage Example

```javascript
const promptTemplate = new RoastPromptTemplate();
const prompt = await promptTemplate.buildPrompt({
  originalComment: "Esta aplicación es horrible",
  toxicityData: { score: 0.5, categories: ['TOXICITY'] },
  userConfig: { tone: 'sarcastic', humor_type: 'witty', intensity_level: 3 },
  includeReferences: true
});
```

## Twitter Bot Features

- **Mention Monitoring**: Automatically detects mentions to your Twitter account
- **Toxicity Filtering**: Uses stub (always true) with skeleton for Perspective API
- **Roast Generation**: Calls your deployed API to generate responses
- **Duplicate Prevention**: Tracks processed tweets in `data/processed_tweets.json`
- **Rate Limiting**: Adds delays between responses to respect API limits
- **Error Handling**: Graceful failure handling and detailed logging

## Orquestación y Reglas

### Función de Orquestador

- **Actuar como orquestador del resto de subagentes**: Coordinar y supervisar las tareas de todos los agentes especializados del sistema.
- **Mantener un archivo de contexto global spec.md actualizado**: Gestionar un documento central que refleje el estado actual de la especificación del sistema.
- **Cuando un subagente cree un *.md táctico** (ej: shield.md, ui.md...): debe añadir un bloque en spec.md dentro de la sección correspondiente para mantener la coherencia documental.
- **Invocar siempre al Test Engineer Agent** tras cambios en src/ o en documentos de diseño (ux.md, ui.md, ui-whimsy.md) para generar tests + evidencias visuales con Playwright.

### Configuración MCP Playwright

- **Para cualquier cambio de frontend**, el orquestador debe:
  - Ejecutar Playwright MCP para validación visual automatizada
  - Capturar screenshots de las páginas afectadas en múltiples viewports
  - Revisar consola del navegador y logs de red para detectar errores
  - Guardar un reporte completo en `docs/ui-review.md` con evidencias visuales
  - Verificar que la implementación coincide con las especificaciones de diseño
- **Comando de verificación MCP**: `/mcp list` para confirmar que Playwright está operativo
- **Ejecución de validación**: `/mcp exec playwright` para realizar capturas y análisis visual

### Reglas de PR

- **Cada feature/tarea nueva = nueva PR**: No mezclar funcionalidades diferentes en una misma Pull Request.
- **No mezclar en PRs ya abiertas salvo fix de review**: Mantener el scope limitado de cada PR una vez abierta.
- **Si detectas commits fuera de scope → detener y abrir nueva PR**: Evitar la deriva del alcance durante el desarrollo.
- **Documentar estas reglas también en la plantilla de PR**: Asegurar que todos los colaboradores conozcan las normas.

### ⭐ Quality Standards (CRÍTICO)

**Ver docs/QUALITY-STANDARDS.md para detalles completos.**

**Requisitos NO NEGOCIABLES para mergear PR:**
1. ✅ Sin conflictos con main
2. ✅ CI/CD passing (todos los jobs verdes)
3. ✅ **0 comentarios de CodeRabbit** (CERO, no "casi cero")

**Pre-Flight Checklist OBLIGATORIO antes de `gh pr create`:**
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

**Mentalidad:** Producto monetizable, no proyecto de instituto. Calidad > Velocidad.

### Reglas de Commits y Tests

- **Commit sin tests no permitido**: Todo código nuevo debe incluir pruebas correspondientes.
- **Si se detecta código nuevo sin tests asociados → coordinar con Test Engineer** para generar los tests antes de cerrar la tarea.
- **Cambios en UI/frontend deben incluir evidencias visuales**: capturas + report.md en docs/test-evidence/ para validar la implementación visual.

### Task Assessment (FASE 0 - OBLIGATORIA)

**IMPORTANTE**: Antes de cualquier planning o implementación, SIEMPRE evalúa el estado actual de la tarea.

#### Criterio de Decisión: ¿Assessment Simple o Completo?

- **Assessment Simple** (Orquestador inline):
  - Tareas con ≤ 2 criterios de aceptación
  - Issues de tipo: docs, config simple, fix pequeño
  - Ejecución: Orquestador hace búsqueda inline y ejecuta tests si existen

- **Assessment Completo** (Task Assessor Agent):
  - Tareas con ≥ 3 criterios de aceptación
  - Issues P0/P1 críticas
  - Features complejas, integraciones, refactors
  - Ejecución: Invocar Task Assessor Agent

#### Workflow de Assessment

1. **Identificar Tipo de Assessment**:
   - Leer issue/tarea completa
   - Contar criterios de aceptación
   - Determinar complejidad

2. **Assessment Simple** (Orquestador):
   ```bash
   # Buscar archivos relacionados
   find tests/ src/ docs/ -name "*<keyword>*"

   # Si hay tests, ejecutarlos
   npm test -- <keyword>

   # Determinar recomendación inline:
   # - Si tests pasan + AC cumplidos → CLOSE
   # - Si tests fallan → FIX
   # - Si implementación parcial → ENHANCE
   # - Si no existe nada → CREATE
   ```

   Documentar decisión en el plan directamente.

3. **Assessment Completo** (Task Assessor Agent):
   ```
   Invocar: Task Assessor Agent con issue number
   Output: docs/assessment/<issue>.md
   Resultado: Recomendación CREATE | FIX | ENHANCE | CLOSE
   ```

4. **Actuar según Recomendación**:
   - **CLOSE**: Cerrar issue con evidencia, no proceder a planning
   - **FIX**: Planning enfocado en arreglar lo que falla
   - **ENHANCE**: Planning para mejorar lo existente
   - **CREATE**: Planning para implementar desde cero

#### Ejemplos de Assessment

**Ejemplo 1 - Assessment Simple (Orquestador inline):**
```
Issue #450: "Actualizar README con nuevos comandos"
- AC: 1 (añadir comandos al README)
- Tipo: docs
→ Orquestador inline: find README.md, revisar contenido
→ Recomendación: ENHANCE (README existe, añadir sección)
→ Procede a planning simple
```

**Ejemplo 2 - Assessment Completo (Task Assessor Agent):**
```
Issue #408: "Shield integration tests"
- AC: 5 (acciones, registro, no respuestas, escalamiento, logs)
- Tipo: test integration P0
→ Invocar Task Assessor Agent
→ Agent encuentra: tests/integration/shield-issue-408.test.js
→ Agent ejecuta: 11 tests failing
→ Recomendación: FIX (tests existen pero fallan)
→ Procede a planning para FIX
```

### Planning Mode

- **Antes de implementar cualquier feature/tarea, genera siempre un plan en modo texto (planning mode)**.
- **El plan debe incluir sección "Estado Actual"** basada en el assessment realizado.
- **El plan debe describir**: pasos de diseño, subagentes a usar, archivos afectados, criterios de validación.
- **Guarda el plan en `docs/plan/<issue>.md`**.
- **⚠️ CRÍTICO: Después de guardar el plan, CONTINÚA AUTOMÁTICAMENTE con la implementación**.
  - **NO esperes confirmación** del usuario
  - **NO preguntes** "¿procedemos?" o "¿continuamos?"
  - El plan es para **documentar**, no para **pedir permiso**
  - **EJECUTA el plan inmediatamente** después de guardarlo
  - Solo te detienes si encuentras un **bloqueador técnico real** (API down, credenciales faltantes, etc.)

### Gestión de Agentes Relevantes (GDD Phase 4)

- **Cada nodo en `docs/nodes/*.md` debe mantener actualizada la sección "## Agentes Relevantes"**.
- **Reglas de sincronización**:
  - Si durante una tarea invocas a un agente que **no está listado** en "Agentes Relevantes" del nodo → **añádelo automáticamente**.
  - Si detectas que un agente listado **ya no aplica** al nodo → **elimínalo**.
  - Mantén la lista ordenada alfabéticamente para facilitar la lectura.
- **Validación automática**: Ejecuta `node scripts/resolve-graph.js --validate` antes de cerrar cualquier PR para verificar que todos los nodos tienen sección de agentes válida.
- **Checklist obligatorio al cerrar nodo/PR**:
  - [ ] Leí `spec.md` y el archivo `.md` del nodo afectado.
  - [ ] Revisé que `## Agentes Relevantes` refleja los agentes efectivamente usados en esta tarea.
  - [ ] Añadí agentes que invocamos y no estaban listados.
  - [ ] Eliminé agentes que ya no son relevantes para este nodo.
  - [ ] Ejecuté `node scripts/resolve-graph.js --validate` y no hay errores.
  - [ ] Confirmé que `spec.md` tiene la tabla global de nodos-agentes sincronizada.
  - [ ] Generé reporte de validación con `node scripts/resolve-graph.js --report`.

**Tabla global de nodos-agentes**: Ver sección "Node-Agent Matrix" en `spec.md` para referencia rápida.

### Coverage Authenticity Rules (GDD Phase 15.1)

**NEVER modify `**Coverage:**` values manually. Coverage data must always be derived from automated reports.**

- **Coverage Source**: All GDD nodes must have `**Coverage Source:** auto` field immediately after `**Coverage:**` field
- **Automated Enforcement**: Validation and Auto-Repair scripts enforce coverage authenticity automatically
- **Manual modifications are considered integrity violations** and will trigger CI failure
- **Coverage data sources**:
  - Primary: `coverage/coverage-summary.json`
  - Secondary: `lcov.info`
- **Tolerance**: 3% difference allowed between declared and actual coverage
- **Violations**: Any mismatch >3% triggers critical integrity violation

**Validation Commands:**
```bash
# Validate coverage authenticity
node scripts/validate-gdd-runtime.js --full

# Auto-repair coverage mismatches
node scripts/auto-repair-gdd.js --auto-fix
```

**Coverage Update Workflow:**
1. Run tests: `npm test -- --coverage`
2. Coverage report auto-generated in `coverage/coverage-summary.json`
3. Run auto-repair: `node scripts/auto-repair-gdd.js --auto`
4. Auto-repair reads actual coverage and updates node docs
5. Commit updated node docs with accurate coverage

**Manual Override (discouraged):**
- If coverage data is unavailable, use `**Coverage Source:** manual`
- This triggers a warning (not an error)
- Must be justified in PR description
- Switch back to `auto` when coverage becomes available

**Integrity Score:**
- Coverage authenticity contributes 10% to node health score
- Manual coverage source: -20 points
- Missing coverage source: -10 points
- Coverage mismatch: penalty based on diff (up to -50 points)

**CI/CD Integration:**
- CI checks coverage authenticity before merge
- Blocks merge if coverage integrity violations detected
- Auto-creates issues for manual review if needed

### GDD Activation - Issue Analysis & Context Loading (October 3, 2025)

**IMPORTANTE:** A partir de ahora, el Orchestrator debe usar Graph Driven Development (GDD) para **todas las issues**, cargando solo los nodos relevantes en lugar de spec.md completo.

#### 1. Issue Analysis (Automático)

**Cuando el usuario menciona un número de issue** (ej: "Trabajemos en Issue #408"):

1. **Fetch issue metadata:**
   ```bash
   gh issue view 408 --json labels,title,body
   ```

2. **Map labels → nodes** usando esta tabla:

   | Label | Nodos Afectados | Comando |
   |-------|----------------|---------|
   | `area:shield` | shield, multi-tenant | `node scripts/resolve-graph.js shield` |
   | `area:billing` | cost-control, plan-features, multi-tenant | `node scripts/resolve-graph.js cost-control` |
   | `area:platforms` | social-platforms, platform-constraints | `node scripts/resolve-graph.js social-platforms` |
   | `area:workers` | queue-system, multi-tenant | `node scripts/resolve-graph.js queue-system` |
   | `area:ui` | roast, persona, tone | `node scripts/resolve-graph.js roast` |
   | `area:demo` | roast, shield, queue-system | `node scripts/resolve-graph.js roast` |
   | `area:multitenant` | multi-tenant | `node scripts/resolve-graph.js multi-tenant` |
   | `area:publisher` | queue-system, social-platforms | `node scripts/resolve-graph.js queue-system` |
   | `area:observability` | ALL nodes | `cat docs/nodes/*.md` |
   | `area:reliability` | queue-system, shield, multi-tenant | `node scripts/resolve-graph.js queue-system` |
   | `test:e2e` | ALL nodes (pipeline completo) | `cat docs/nodes/*.md` |
   | `test:integration` | depende de otros labels | Ver arriba |
   | `test:unit` | nodo específico del título | Parsear keywords |

3. **Keyword fallback** (si no hay label `area:*`), buscar en título/body:

   | Keywords | Nodo Principal |
   |----------|----------------|
   | "shield", "moderación", "ofensor" | shield |
   | "billing", "stripe", "plan", "entitlements" | cost-control |
   | "worker", "queue", "redis", "job" | queue-system |
   | "roast", "generación", "prompt", "variante" | roast |
   | "multi-tenant", "RLS", "organization" | multi-tenant |
   | "platform", "twitter", "discord", "integration" | social-platforms |
   | "persona", "tone", "style", "humor" | persona |
   | "demo mode", "fixtures", "seeds" | roast |
   | "publisher", "publicación", "post" | queue-system |

4. **Resolve dependencies:**
   ```bash
   node scripts/resolve-graph.js <nodes>
   ```

5. **Load ONLY resolved nodes** (NO spec.md)

6. **Announce context loaded:**
   ```
   🔍 Analyzing Issue #408...

   📊 GDD Node Mapping:
   - Primary node: shield
   - Dependencies: multi-tenant, plan-features, cost-control

   📖 Loading context (2,050 lines):
     ✓ docs/nodes/shield.md (680 lines)
     ✓ docs/nodes/multi-tenant.md (707 lines)
     ✓ docs/nodes/plan-features.md (194 lines)
     ✓ docs/nodes/cost-control.md (470 lines)

   💾 Context reduction: 71% (7,034 → 2,050 lines)
   ⚡ Token savings: ~14,500 tokens

   🚀 Ready to work on Shield integration tests!
   ```

#### 2. During Development

**ALWAYS:**
- ✅ Read nodes, NOT spec.md (unless `test:e2e` or `area:observability`)
- ✅ Update affected nodes when code changes
- ✅ Add agents to "Agentes Relevantes" if invoked but not listed
- ✅ Run `node scripts/resolve-graph.js --validate` before commits
- ✅ Keep node docs synchronized with code

**NEVER:**
- ❌ Load entire spec.md (unless explicitly required)
- ❌ Skip node updates after code changes
- ❌ Forget to add new agents to "Agentes Relevantes"
- ❌ Commit without validation passing

#### 3. Before Closing PR

**Mandatory GDD Checklist (in addition to existing checklist):**
- [ ] Verified "Agentes Relevantes" reflects agents actually used
- [ ] Added missing agents, removed irrelevant agents
- [ ] Ran `node scripts/resolve-graph.js --validate` → no errors
- [ ] Generated report: `node scripts/resolve-graph.js --report`
- [ ] Included GDD summary in PR description:
  ```markdown
  ## 📊 GDD Summary

  **Nodes Updated:**
  - shield.md (added hide/block/report methods)
  - multi-tenant.md (RLS policies updated)

  **Context Used:** 2,050 lines (71% reduction vs spec.md)
  **Validation:** ✅ All checks passing
  **Agent Sync:** ✅ Up to date
  ```

#### 4. Fallback Strategy

**Si no puedes determinar nodos automáticamente:**
1. Preguntar al usuario: "I see Issue #XXX. Which feature area? (shield, billing, workers, etc.)"
2. Usuario responde → mapear a nodos
3. Si aún no está claro → cargar nodos comunes: `roast, shield, queue-system` (~2,000 líneas)
4. Explicar contexto cargado y pedir confirmación

**NUNCA cargar spec.md por defecto.**

#### 5. Examples

**Example 1: Shield Integration (Issue #408)**
```
USER: "Trabajemos en Issue #408"

ORCHESTRATOR:
1. gh issue view 408 --json labels,title,body
2. Labels: area:shield, test:integration, priority:P0
3. Map: area:shield → shield
4. node scripts/resolve-graph.js shield
5. Load: shield.md, multi-tenant.md, plan-features.md, cost-control.md
6. Announce: "Loading 2,050 lines (71% reduction)"
7. Work on issue using only those 4 nodes
8. Update shield.md when adding new code
9. Validate before commit
10. Include GDD summary in PR
```

**Example 2: Multi-tenant RLS (Issue #412)**
```
USER: "Issue #412 - multi-tenant RLS tests"

ORCHESTRATOR:
1. Labels: area:multitenant, test:integration, priority:P0
2. Map: area:multitenant → multi-tenant
3. node scripts/resolve-graph.js multi-tenant
4. Load: multi-tenant.md (leaf node, no deps = 707 lines)
5. Announce: "Loading 707 lines (90% reduction)"
6. Work on RLS tests using only multi-tenant.md
7. Update multi-tenant.md with new RLS policies
8. Validate and commit
```

**Full details:** See `docs/GDD-ACTIVATION-GUIDE.md` for complete mapping tables and workflows.

## Runtime Validation Workflow (GDD 2.0)

> **For full details, see:** `docs/GDD-ACTIVATION-GUIDE.md#runtime-validation`

The GDD Runtime Validator continuously monitors and validates the coherence between `system-map.yaml`, `docs/nodes/**`, `spec.md`, and source code (`src/**`).

**Key Commands:**
```bash
node scripts/validate-gdd-runtime.js --full    # Validate entire system
node scripts/validate-gdd-runtime.js --ci      # CI mode (exit 1 on errors)
node scripts/watch-gdd.js                      # Watch mode (development)
```

**Validation Rules:** Graph structure, documentation sync, link integrity, code integration

**Status Levels:** 🟢 HEALTHY | 🟡 WARNING | 🔴 CRITICAL

**Before PR Merge:** Run full validation, ensure 🟢 HEALTHY or acceptable 🟡 WARNING

---

## Node Health Scoring System (GDD 2.0 - Phase 7)

> **For full details, see:** `docs/GDD-ACTIVATION-GUIDE.md#health-scoring`

Provides quantitative metrics (0-100) for each GDD node based on 5 weighted factors: Sync Accuracy (30%), Update Freshness (20%), Dependency Integrity (20%), Coverage Evidence (20%), Agent Relevance (10%).

**Commands:**
```bash
node scripts/score-gdd-health.js              # Standalone scoring
node scripts/validate-gdd-runtime.js --score  # Combined validation + scoring
```

**Status Levels:** 🟢 HEALTHY (80-100) | 🟡 DEGRADED (50-79) | 🔴 CRITICAL (<50)

**Before PR Merge:** Average score > 75, no critical nodes

## Predictive Drift Detection (GDD 2.0 - Phase 8)

> **For full details, see:** `docs/GDD-ACTIVATION-GUIDE.md#drift-prediction`

Analyzes historical patterns to calculate a **Drift Risk Score (0-100)** for each node based on: last updated, active warnings, test coverage, health score, and recent activity.

**Commands:**
```bash
node scripts/predict-gdd-drift.js --full         # Run drift prediction
node scripts/predict-gdd-drift.js --ci           # CI mode (exit 1 if high-risk)
node scripts/predict-gdd-drift.js --create-issues # Create issues for high-risk nodes
```

**Risk Levels:** 🟢 Healthy (0-30) | 🟡 At Risk (31-60) | 🔴 Likely Drift (61-100)

**Before PR:** Check drift risk, address nodes with risk > 60

---

## CI/CD GDD Automation (Phase 12)

> **For full details, see:** `docs/GDD-ACTIVATION-GUIDE.md#cicd-automation`

The GDD system is fully integrated into the CI/CD pipeline with automated validation, repair, and issue management.

**Configuration:** `.gddrc.json` (min_health_score: 95, auto_fix: true, block_merge_below_health: 95)

**Workflows:**
1. **GDD Validation** (`.github/workflows/gdd-validate.yml`) - Runs on PR to main/develop, validates nodes, scores health, predicts drift, posts PR comment, blocks merge if health < 95
2. **GDD Auto-Repair** (`.github/workflows/gdd-repair.yml`) - Auto-fixes missing agent sections, broken links, missing node references

**Before PR:**
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/predict-gdd-drift.js --full
node scripts/compute-gdd-health.js --threshold=95
node scripts/auto-repair-gdd.js --auto-fix  # If needed
```

**Success Criteria:** Health ≥ 95, no critical nodes, drift < 60

**Auto-created Issues:** Validation failed, auto-repair failed, high drift risk, manual review required

---

## Telemetry & Analytics Layer (Phase 13)

> **For full details, see:** `docs/GDD-IMPLEMENTATION-SUMMARY.md#phase-13`

GDD 2.0 now includes historical telemetry and analytics to track system evolution over time.

### Telemetry Collection

**Script:** `scripts/collect-gdd-telemetry.js`

Automatically collects metrics from GDD subsystems every 24 hours:
- Health scores (overall + per-node)
- Drift risk trends
- Auto-repair success rates
- Validation results
- Coverage metrics

**Run manually:**
```bash
node scripts/collect-gdd-telemetry.js          # Full output
node scripts/collect-gdd-telemetry.js --ci     # CI mode (silent)
node scripts/collect-gdd-telemetry.js --verbose # Detailed output
```

### Key Metrics Tracked

| Metric | Target | Description |
|--------|--------|-------------|
| Health Score | ≥95 | Overall system health |
| Drift Risk | <25 | Average drift risk across nodes |
| Stability Index | ≥90 | Combined health + drift + repair |
| Auto-Fix Success | ≥90% | Successful auto-repairs |
| Momentum | >0 | Trend over time (improving/declining) |

### Outputs

**1. JSON Snapshot:** `telemetry/snapshots/gdd-metrics-history.json`
- Historical data (90 days retention)
- All metrics + timestamps
- Momentum calculations

**2. Markdown Reports:** `telemetry/reports/gdd-telemetry-YYYY-MM-DD.md`
- Daily summary reports
- Trend analysis
- Alert notifications

**3. Watch Integration:**
```bash
node scripts/watch-gdd.js  # Now includes telemetry section
```

Displays:
- 📈 Latest momentum (improving/declining/stable)
- 🔢 Stability index
- 📊 Total snapshots

### CI/CD Integration

**Workflow:** `.github/workflows/gdd-telemetry.yml`

**Schedule:** Daily at 00:00 UTC

**Actions:**
1. Run validation, health scoring, drift prediction
2. Collect telemetry snapshot
3. Auto-commit data to repo
4. Upload artifacts (30 days retention)
5. Create issues if status == CRITICAL

**Manual trigger:** Available via GitHub Actions UI

### Configuration

**File:** `telemetry-config.json`

```json
{
  "interval_hours": 24,
  "min_health_for_report": 95,
  "include_auto_fixes": true,
  "generate_markdown_report": true,
  "retention_days": 90,
  "alert_thresholds": {
    "health_below": 90,
    "drift_above": 40,
    "auto_fix_success_below": 80
  }
}
```

---

## Cross-Validation & Extended Health Metrics (GDD 2.0 - Phase 15)

> **Implementation Date:** October 9, 2025
> **Status:** Production Ready
> **For full details, see:** `docs/plan/gdd-phase-15-cross-validation.md`

GDD 2.0 Phase 15 extends the framework from a documentation coherence engine into a comprehensive **System Health Intelligence Layer** by adding cross-validation between documentation and runtime data, plus connectivity metrics for external integrations.

### Overview

Phase 15 introduces three major enhancements:

1. **Cross-Validation Engine**: Automatically validates consistency between GDD node metadata and real runtime data sources (coverage reports, git history, source code imports)
2. **Integration Status Tracking**: Monitors health and connectivity of 9 external platform integrations (Twitter, Discord, YouTube, etc.)
3. **Unified Health Intelligence**: Combines documentation health (Phase 7), cross-validation accuracy, and connectivity metrics into a composite system health score

### Cross-Validation Engine

The cross-validation engine (`scripts/validate-gdd-cross.js`) verifies three critical dimensions:

#### 1. Coverage Validation

Compares declared coverage values in node docs against actual test coverage from `coverage/coverage-summary.json`:

- Maps GDD nodes to source files using intelligent path resolution
- Calculates actual coverage by aggregating line coverage across related files
- Applies 3% tolerance for minor discrepancies
- Flags mismatches that exceed tolerance as violations

**Example:**
```yaml
# In docs/nodes/shield.md
**Coverage:** 70%
**Coverage Source:** auto

# Validator checks:
# - Reads coverage/coverage-summary.json
# - Maps shield → [src/services/shieldService.js, src/workers/ShieldActionWorker.js]
# - Calculates: (85% + 65%) / 2 = 75% actual coverage
# - Compares: |75% - 70%| = 5% > 3% tolerance → VIOLATION
```

#### 2. Timestamp Validation

Validates `**Last Updated:**` fields against actual git commit history:

- Executes `git log -1 --format=%ai --follow` for each node's source files
- Applies ±1 day tolerance to account for timezone and batch update differences
- Detects stale documentation (declared date >> actual last commit)
- Detects future dates (declared date in future)

**Example:**
```yaml
# In docs/nodes/roast.md
**Last Updated:** 2025-10-05

# Validator checks:
# - git log -1 --format=%ai src/services/roastGeneratorEnhanced.js
# - Latest commit: 2025-10-08T14:30:00Z
# - Difference: 3 days > 1 day tolerance → VIOLATION (stale)
```

#### 3. Dependency Validation

Compares declared dependencies against actual imports/requires in source code:

- Scans source files for `require()` and `import` statements
- Extracts dependency list from actual code
- Compares with `**Dependencies:**` declared in node docs
- Flags missing dependencies (declared but not imported)
- Flags phantom dependencies (imported but not declared)

**Example:**
```yaml
# In docs/nodes/roast.md
**Dependencies:**
- shield
- cost-control
- persona

# Validator scans src/services/roastGeneratorEnhanced.js:
# - Found: require('./shieldService') → shield ✓
# - Found: require('./personaService') → persona ✓
# - Missing: cost-control not imported → MISSING DEPENDENCY VIOLATION
```

### Commands & Usage

#### Basic Cross-Validation

```bash
# Validate all nodes (recommended)
node scripts/validate-gdd-cross.js --full

# Validate specific node
node scripts/validate-gdd-cross.js --node=shield

# Show summary only (no detailed violations)
node scripts/validate-gdd-cross.js --full --summary

# CI mode (exit 1 if warnings, exit 2 if errors)
node scripts/validate-gdd-cross.js --full --ci
```

#### Output Formats

**Markdown Report** (`docs/cross-validation-report.md`):
```markdown
# Cross-Validation Report

**Generated:** 2025-10-09T12:00:00Z
**Status:** 🟢 HEALTHY
**Overall Score:** 97.4/100

## Coverage Validation

**Status:** ⚠️ FAIL
- **Total Checked:** 13
- **Matched:** 11
- **Mismatched:** 2

### Violations

| Node | Declared | Actual | Diff | Reason |
|------|----------|--------|------|--------|
| shield | 70% | 75% | +5% | coverage_mismatch |
| roast | 100% | 95% | -5% | coverage_mismatch |
```

**JSON Report** (`gdd-cross.json`):
```json
{
  "nodes_validated": 13,
  "coverage_validation": {
    "total": 13,
    "matched": 11,
    "mismatched": 2,
    "violations": [
      {
        "node": "shield",
        "declared": 70,
        "actual": 75,
        "diff": 5,
        "reason": "coverage_mismatch"
      }
    ]
  },
  "timestamp_validation": { ... },
  "dependency_validation": { ... },
  "overall_score": 97.4,
  "status": "HEALTHY"
}
```

### Integration Status Tracking

The integration status system (`scripts/update-integration-status.js`, `integration-status.json`) monitors 9 external platform integrations:

**Monitored Platforms:**
- Twitter (X)
- Discord
- Twitch
- YouTube
- Instagram
- Facebook
- Reddit
- TikTok
- Bluesky

**Status Levels:**
- **active**: Adapter exists + credentials configured + recent successful API calls
- **inactive**: Adapter exists + credentials missing or API calls failing
- **not_connected**: No adapter implementation found

**Health Calculation:**
```javascript
// Per-platform health (0-100)
health = (adapter_exists ? 40 : 0) + (credentials_present ? 60 : 0)

// Overall connectivity health
overall_health = average(all_platform_health_scores)
```

**Update Integration Status:**
```bash
# Check all integrations
node scripts/update-integration-status.js

# Verbose output
node scripts/update-integration-status.js --verbose

# CI mode (silent)
node scripts/update-integration-status.js --ci
```

**Output** (`integration-status.json`):
```json
{
  "last_updated": "2025-10-09T12:00:00Z",
  "version": "1.0",
  "integrations": [
    {
      "name": "twitter",
      "status": "inactive",
      "health_score": 40,
      "credentials_present": false,
      "adapter_exists": true,
      "last_check": "2025-10-09T12:00:00Z",
      "related_nodes": ["social-platforms", "roast", "shield"]
    }
  ],
  "summary": {
    "total": 9,
    "active": 0,
    "inactive": 9,
    "not_connected": 0,
    "overall_health": 40
  }
}
```

### Extended Health Scoring

Phase 15 extends `scripts/score-gdd-health.js` with connectivity and cross-validation metrics.

**Enhanced Health Formula:**
```javascript
// Documentation Health (existing from Phase 7)
doc_health = weighted_avg([
  sync_accuracy * 0.25,
  update_freshness * 0.15,
  dependency_integrity * 0.20,
  coverage_evidence * 0.20,
  agent_relevance * 0.10,
  integrity_score * 0.10
])

// Connectivity Score (new in Phase 15)
connectivity_score = (active_integrations / total_integrations) * 100

// Cross-Validation Score (new in Phase 15)
cross_validation_score = gdd-cross.json overall_score

// Composite Health Score
composite_health = weighted_avg([
  doc_health * 0.40,
  cross_validation_score * 0.30,
  connectivity_score * 0.30
])
```

**Enhanced Commands:**
```bash
# Score with Phase 15 metrics
node scripts/score-gdd-health.js --ci

# Generate extended report
node scripts/score-gdd-health.js --format=markdown
```

**Extended Report Sections:**

1. **External Integrations Status** (new):
   - Connectivity score
   - Active/inactive/not_connected counts
   - Per-platform health breakdown

2. **Cross-Validation Summary** (new):
   - Overall cross-validation score
   - Coverage/timestamp/dependency violation counts
   - Top violators list

3. **System Health Intelligence Summary** (new):
   - Composite health score
   - Weighted breakdown by dimension
   - Status determination (HEALTHY/DEGRADED/CRITICAL)

### Watch Mode Integration

Phase 15 enhances `scripts/watch-gdd.js` with real-time cross-validation and connectivity monitoring.

**New Flags:**
```bash
# Enable cross-validation in watch mode
node scripts/watch-gdd.js --cross

# Enable connectivity monitoring
node scripts/watch-gdd.js --connectivity

# Enable both
node scripts/watch-gdd.js --cross --connectivity

# Enable all Phase 15 features
node scripts/watch-gdd.js --all
```

**Enhanced Dashboard Display:**
```text
╔═══════════════════════════════════════════════════════╗
║            GDD Runtime Validation Dashboard            ║
╠═══════════════════════════════════════════════════════╣
║ Cross-Validation Status                               ║
║ ├─ Overall Score: 97.4/100 [HEALTHY]                  ║
║ ├─ Coverage Violations: 2                             ║
║ ├─ Timestamp Violations: 0                            ║
║ └─ Dependency Violations: 1                           ║
║                                                        ║
║ Integration Connectivity                              ║
║ ├─ Overall Health: 40%                                ║
║ ├─ Active: 0/9                                        ║
║ ├─ Inactive: 9/9                                      ║
║ └─ Not Connected: 0/9                                 ║
╚═══════════════════════════════════════════════════════╝
```

### Workflow Integration

**Pre-Commit Workflow:**
```bash
# 1. Run tests with coverage
npm test -- --coverage

# 2. Update integration status
node scripts/update-integration-status.js --ci

# 3. Run cross-validation
node scripts/validate-gdd-cross.js --full --ci

# 4. Score health with Phase 15 metrics
node scripts/score-gdd-health.js --ci

# 5. Commit if all checks pass
git add .
git commit -m "feat: your feature description"
```

**CI/CD Integration:**

Cross-validation is automatically integrated into `.github/workflows/gdd-validate.yml`:

```yaml
- name: Run Cross-Validation
  run: node scripts/validate-gdd-cross.js --full --ci

- name: Update Integration Status
  run: node scripts/update-integration-status.js --ci

- name: Score Health with Phase 15
  run: node scripts/score-gdd-health.js --ci
```

**Exit Codes:**
- `0`: All validations passed
- `1`: Warnings detected (coverage mismatches within tolerance, minor issues)
- `2`: Critical errors detected (major violations, missing data sources)

### Performance Metrics

Phase 15 meets all performance targets:

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Cross-validate 13 nodes | <1s | ~800ms | ✅ PASS |
| Update integration status | <2s | ~1.2s | ✅ PASS |
| Extended health scoring | <1s | ~600ms | ✅ PASS |
| Watch mode refresh | <3s | ~2.1s | ✅ PASS |

### Troubleshooting

#### Issue: "No coverage data found"

```bash
# Solution: Run tests with coverage first
npm test -- --coverage
node scripts/validate-gdd-cross.js --full
```

#### Issue: "Git log failed for node X"

```bash
# Solution: Ensure source files exist and are tracked by git
git status
git add <missing-files>
```

#### Issue: "All integrations showing 'inactive'"

```bash
# Solution: Add platform credentials to .env
# See "Platform Integrations" section in this file for required env vars
```

#### Issue: "Coverage mismatch for node X"

```bash
# Solution: Either update node docs or improve test coverage
# Option 1: Update declared coverage (manual)
# Option 2: Use auto-repair (coming in Phase 15.1)
node scripts/auto-repair-gdd.js --auto-fix
```

#### Issue: "Cross-validation score lower than expected"

```bash
# Solution: Check detailed violations
node scripts/validate-gdd-cross.js --full
# Review docs/cross-validation-report.md for specifics
# Address violations one by one
```

### Files Added/Modified

**New Files:**
- `scripts/validate-gdd-cross.js` - Main cross-validation engine
- `scripts/gdd-cross-validator.js` - Helper class with validation utilities
- `scripts/update-integration-status.js` - Integration status updater
- `integration-status.json` - Integration status data store
- `gdd-cross.json` - Cross-validation results (JSON output)
- `docs/cross-validation-report.md` - Cross-validation results (markdown)
- `docs/plan/gdd-phase-15-cross-validation.md` - Implementation plan

**Modified Files:**
- `scripts/score-gdd-health.js` - Extended with Phase 15 metrics
- `scripts/watch-gdd.js` - Added --cross and --connectivity flags
- `CLAUDE.md` - This documentation section

### Success Criteria

Phase 15 is considered complete when:

- ✅ Cross-validation engine validates all 13 nodes in <1s
- ✅ Coverage, timestamp, and dependency checks implemented
- ✅ Both markdown and JSON reports generated
- ✅ Integration status tracking operational for 9 platforms
- ✅ Health scoring extended with connectivity and cross-validation metrics
- ✅ Composite health formula implemented (40/30/30 weighting)
- ✅ Watch mode enhanced with --cross and --connectivity flags
- ✅ CI/CD integration with proper exit codes (0/1/2)
- ✅ Performance targets met (<1s validation, <2s status update)
- ✅ Documentation complete (CLAUDE.md, implementation plan)

**Current Status:** All criteria met ✅

---

## Documentation Integrity Policy (Phase 15.3)

### GDD Implementation Summary Governance

**Effective:** October 8, 2025 (GDD 2.0 Phase 15.3)

The GDD Implementation Summary has been modularized to prevent token limit errors and improve performance. All future documentation must follow these rules:

#### Size Limits

- **GDD Implementation Summary Index** (`docs/GDD-IMPLEMENTATION-SUMMARY.md`)
  - **Maximum Size:** 350 lines (~5,000 tokens)
  - **Current Size:** 249 lines (~1,200 tokens)
  - **Purpose:** Lightweight index with links to detailed phase documentation

- **Phase Documentation** (`docs/implementation/GDD-PHASE-*.md`)
  - **Maximum Size:** 1,000 lines per phase file
  - **Purpose:** Detailed documentation for specific GDD phases
  - **Structure:** Must include header with back-link to index and footer with navigation

#### Mandatory Structure

All new phase documentation must include:

1. **Header**
   ```markdown
   # GDD 2.0 - Phase <number>

   [← Back to Index](../GDD-IMPLEMENTATION-SUMMARY.md)

   ---
   ```

2. **Content Sections**
   - Objective
   - Implementation details
   - Results & impact
   - Testing validation
   - Files modified

3. **Footer**
   ```markdown
   ---

   [← Back to Index](../GDD-IMPLEMENTATION-SUMMARY.md) | [View All Phases](./)
   ```

#### Source of Truth

- **Phase Metadata:** `docs/.gddindex.json` is the authoritative source for:
  - Total phases count
  - Latest phase number
  - Phase status (completed, in_progress, planned)
  - File locations and sizes
  - System health snapshot

- **Phase Content:** Individual phase files in `docs/implementation/` contain detailed documentation

#### Update Requirements

When adding a new GDD phase, you **MUST** update:

1. ✅ Create phase file: `docs/implementation/GDD-PHASE-<number>.md`
2. ✅ Update index: `docs/GDD-IMPLEMENTATION-SUMMARY.md` (add row to phase table)
3. ✅ Update metadata: `docs/.gddindex.json` (increment counters, add phase entry)
4. ✅ Verify size: Ensure index remains <350 lines

**Failure to update all three components will cause validation errors.**

#### Enforcement

- **CI/CD Validation:** `.github/workflows/gdd-validate.yml` checks index size
- **Auto-Repair:** `scripts/auto-repair-gdd.js` can fix missing phase references
- **Health Scoring:** Documentation size is monitored in health metrics
- **Manual Edits:** Require approval from Orchestrator Agent

#### Migration Path

If index exceeds size limits:

1. Identify sections that can be moved to phase files
2. Create summary tables instead of full descriptions
3. Archive historical data to appropriate phase files
4. Update links and references
5. Validate that all phase files have proper headers/footers

#### Rationale

**Why Modularization?**
- Previous monolithic file: 3,069 lines (~27,700 tokens)
- Token limit errors prevented file reads
- Performance degraded with file size
- Maintenance became difficult

**Phase 15.3 Results:**
- Index reduced to 249 lines (93% reduction)
- Token errors eliminated
- Read time improved from 800ms+ to <50ms
- Clear navigation with direct phase links

#### Documentation

For complete details on modularization architecture, see:
- [GDD Phase 15.3 Documentation](./docs/GDD-PHASE-15.3-MODULARIZATION.md)
- [GDD Index Metadata](./docs/.gddindex.json)
- [Modular Phase Files](./docs/implementation/)

---

### Tareas al Cerrar

**🚨 VERIFICACIÓN OBLIGATORIA antes de marcar tarea como completa:**

1. **Tests DEBEN PASAR al 100%**:
   ```bash
   npm test -- <relevant-tests>
   # O específico:
   npm test <test-file>.test.js
   ```
   - ✅ **0 tests fallando** - Si hay 1 solo test rojo, la tarea NO está completa
   - ❌ **NUNCA marcar completa con tests failing**
   - Si tests fallan → arreglar ANTES de continuar

2. **Pre-Flight Checklist ejecutado**:
   - [ ] Tests pasando (ver punto 1)
   - [ ] Documentación actualizada
   - [ ] Code quality verificado
   - [ ] Self-review completado

3. **Documentación actualizada**:
   - **spec.md** reflejando nuevos cambios
   - **Nodos GDD** con status actualizado
   - **Mapa de cobertura de tests** + evidencias visuales
   - **Changelog detallado** en la PR

**⚠️ Si encuentras tests failing:**
- NO continúes con siguiente tarea
- NO marques como completa
- Arregla los tests AHORA
- Re-ejecuta para verificar
- Solo entonces procede