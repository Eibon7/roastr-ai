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