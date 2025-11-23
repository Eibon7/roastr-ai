# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant toxicity detection and roast generation system for social media platforms. Built with Node.js, supporting multiple organizations with dedicated workers, cost control, and automated Shield moderation.

**Business Model:** Subscription tiers (Free, Starter €5/mo, Pro €15/mo, Plus €50/mo)

## 🎯 POLÍTICA OBLIGATORIA: Uso de GDD, Agentes, Skills y MCPs

**⚠️ CRÍTICO: Esta política es OBLIGATORIA para TODA tarea, sin excepciones.**

### Orchestrator: Responsabilidad de Selección

**FASE 0 - Assessment con GDD:**

- ✅ SIEMPRE resolver nodos GDD: `node scripts/resolve-graph.js <nodes>`
- ✅ SIEMPRE leer nodos resueltos (NO spec.md completo)
- ✅ SIEMPRE identificar dependencias

**Selección de Recursos:**

- ✅ Evaluar agentes (`agents/manifest.yaml`)
- ✅ Invocar con `Task` tool cuando triggers se cumplen
- ✅ Considerar skills (`.claude/skills/`)
- ✅ Usar MCPs apropiados (Playwright para UI)

**Invocación Obligatoria:**

- **Explore** - Research de codebase, arquitectura unclear
- **TaskAssessor** - AC ≥3, features complejas, P0/P1
- **TestEngineer** - Cambios en `src/`, `tests/`, nuevos features
- **FrontendDev** - Cambios UI (`*.jsx`, `*.tsx`, `*.css`)
- **Guardian** - Cambios sensibles (billing, auth, security, GDD)
- **general-purpose** - PR status, research complejo, multi-step

**Generación de Receipts:**

- ✅ SIEMPRE generar receipt en `docs/agents/receipts/<pr>-<Agent>.md`
- ✅ O generar SKIPPED receipt con justificación
- ✅ CI bloqueará merge si faltan receipts

### Workflow Estándar

**FASE 0:** Assessment → GDD → Leer nodos → Agentes → coderabbit-lessons.md
**FASE 1:** Planning → TaskAssessor (AC ≥3) → docs/plan/ → Explore
**FASE 2:** Implementation → Agentes → Skills/MCPs → Receipts
**FASE 3:** Validation → Tests + visual → Guardian → PR → 0 conflictos + 0 CodeRabbit
**FASE 4:** Commit & PR → Receipts → CI → Merge

🔗 **Referencias:**

- Manifest: `agents/manifest.yaml`
- Inventario: `docs/agents/INVENTORY.md`
- GDD Guide: `docs/GDD-ACTIVATION-GUIDE.md`

---

## Development Commands

```bash
# Start
npm start
npm run dev                      # Auto-reload
npm run start:api                # API only

# CLI & Testing
npm run roast "message"
npm test
npm run test:coverage

# CodeRabbit - Auto-executes on commit
npm run coderabbit:review        # Full (--plain)
npm run coderabbit:review:quick  # Quick (--prompt-only)

# Workers & Queue
npm run workers:start
npm run queue:status

# Demo Mode (Issue #420)
npm run demo:seed
npm run demo:validate

# GDD
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
node scripts/auto-repair-gdd.js --auto-fix
node scripts/guardian-gdd.js --full
```

🔗 **Complete guides:**

- Testing: `docs/TESTING-GUIDE.md`
- GDD: `docs/GDD-ACTIVATION-GUIDE.md`

## Multi-Tenant Project Structure

```
src/
├── index.js, cli.js, config/
├── services/            # costControl, queueService, shieldService
├── workers/             # Base, FetchComments, AnalyzeToxicity, GenerateReply, ShieldAction
├── integrations/        # twitter, youtube, instagram, facebook, discord, twitch, reddit, tiktok, bluesky
└── utils/logger.js

database/schema.sql      # Multi-tenant PostgreSQL
tests/                   # unit/, integration/, helpers/
```

## Environment Variables

**Categories:**

- Core (P0): Database, Redis, AI APIs, config
- Platforms (P1): Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit
- Optional: Custom keys, feature flags, Shield

🔗 **Setup:** `.env.example`, `docs/INTEGRATIONS.md`

**🛡️ Protección de .env (CRÍTICO):**

- Pre-commit hook verifica que `.env` existe antes de commits
- Backups automáticos con cada verificación (últimos 5 se mantienen)
- Si `.env` falta: `npm run verify:env:create` (auto-recrea desde `.env.example`)
- NUNCA commitear `.env` (protegido por `.gitignore`)

🔗 **Política completa:** `docs/policies/env-file-protection.md`

**OpenAI setup:**

1. Get key: [OpenAI Platform](https://platform.openai.com/api-keys)
2. `.env`: `OPENAI_API_KEY=your_key_here`
3. Test: `npm run roast "tu comentario"`

**API Verification:** `scripts/verify-*.js` (Issue #490)

## Architecture

**Core:** Express + PostgreSQL (RLS) + Redis/Upstash + Workers + Cost Control + Shield

**Flow:** Detection → Fetch → Analyze + Shield → Reply → Moderation

🔗 **Details:** `docs/nodes/` (roast.md, shield.md, queue.md)

## Master Prompt & Persona

**Prompt Template (v1):**

- Dynamic fields: comment, category, references, tone
- Security: Injection protection, 2000 char limit
- Plan-based access

**Persona (Issue #595):**

- AES-256-GCM encryption + OpenAI embeddings
- API: `/api/persona` (GET/POST/DELETE)
- Env: `PERSONA_ENCRYPTION_KEY`

🔗 **Docs:** Issue #127, #115, #595, `docs/plan/issue-595.md`

---

## Orquestación y Reglas

### Función de Orquestador

- Coordinar agentes especializados
- Mantener spec.md actualizado
- Invocar Test Engineer tras cambios src/
- Añadir bloques en spec.md para coherencia

### 🎯 Lead Orchestrator Rules (ENFORCEMENT)

**📋 Full definitions:** `agents/manifest.yaml` | **📊 Quick ref:** `docs/agents/INVENTORY.md`

**CRITICAL: Every PR must follow:**

#### 1. Pre-Implementation (FASE 0)

- ✅ Resolve GDD nodes: `node scripts/resolve-graph.js <nodes>`
- ✅ Use Explore agent for research (NEVER load spec.md)
- ✅ Read `docs/patterns/coderabbit-lessons.md`
- ✅ If AC ≥3: Create mini-plan in `docs/plan/<issue>.md`

#### 2. Agent Identification

**By labels:**

- `area:frontend`, `area:ui` → FrontendDev, UIDesigner
- `area:ui` + `branding` → WhimsyInjector
- `test:*`, `qa` → TestEngineer
- `priority:P0/P1` + AC ≥3 → TaskAssessor
- `critical`, `security`, `billing` → Guardian

**By diff:**

- `*.jsx`, `*.tsx`, `*.css` → FrontendDev
- `src/`, `tests/` → TestEngineer
- `costControl.js`, `schema.sql`, `docs/nodes/` → Guardian

**By conditions:**

- AC ≥3 → TaskAssessor
- Complex tasks → general-purpose
- UI changes → UIDesigner
- Branding → WhimsyInjector (NEVER /legal, /billing, /admin)

#### 3. Agent Invocation & Receipts

##### Option A: Invoke

1. Use `Task` tool or execute script (Guardian)
2. Record decisions, artifacts, guardrails
3. Generate: `docs/agents/receipts/<pr>-<Agent>.md`

##### Option B: Skip

1. Document why + assess risks
2. Get approval if needed (Product Owner for CRITICAL)
3. Generate SKIPPED: `docs/agents/receipts/<pr>-<Agent>-SKIPPED.md`

#### 4. Guardrails (NEVER VIOLATE)

- ❌ NEVER load spec.md completely
- ❌ NEVER expose secrets, API keys, .env names
- ❌ NEVER skip FASE 0
- ❌ NEVER proceed without receipts
- ✅ ALWAYS generate receipts (normal/SKIPPED)
- ✅ ALWAYS update "Agentes Relevantes" in GDD nodes
- ✅ ALWAYS validate: `node scripts/resolve-graph.js --validate`

#### 5. CI Enforcement

**Script:** `scripts/ci/require-agent-receipts.js`

**PR cannot merge without:**

- ✅ All required agents have receipts
- ✅ Receipts follow template
- ✅ Guardrails verified

#### 6. Examples & Violations

**Examples:**

- Backend fix → TestEngineer + Guardian
- Frontend feature → FrontendDev + UIDesigner + WhimsyInjector + TestEngineer
- Docs-only → No agents if no triggers

**If violations:**

- Missing receipts → CI fails (exit 1)
- Guardrails violated → Code review rejects
- Secrets exposed → 🚨 CRITICAL - PR close + rotation

**Enforcement:** ✅ Active | **Updated:** 2025-10-19

### Configuración MCP Playwright

**Para frontend:**

- Ejecutar Playwright MCP para validación visual
- Capturar screenshots (múltiples viewports)
- Revisar consola + logs de red
- Guardar: `docs/ui-review.md`

**Comandos:** `/mcp list`, `/mcp exec playwright`

### Reglas de PR

- Cada feature = nueva PR (no mezclar)
- No mezclar en PRs abiertas (salvo fix review)
- Si commits fuera de scope → detener + nueva PR

### ⭐ Quality Standards (CRÍTICO)

🔗 **Ver:** `docs/QUALITY-STANDARDS.md`

**Requisitos NO NEGOCIABLES:**

1. ✅ Sin conflictos con main
2. ✅ CI/CD passing
3. ✅ **0 comentarios CodeRabbit** (CERO)

**Pre-Flight Checklist:**

- Tests pasando
- Docs actualizada (CLAUDE.md, spec.md, nodos GDD)
- Code quality (sin console.logs, TODOs)
- Self-review exhaustivo

**Ciclo Review (OBLIGATORIO):**

1. Arreglar TODAS las issues CodeRabbit
2. Inspeccionar PR con general-purpose agent
3. Si issues/jobs failing → volver a paso 1
4. Solo cuando todo verde → informar "PR lista"

**Mentalidad:** Producto monetizable. **Calidad > Velocidad.**

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

- Commit sin tests NO permitido
- Código nuevo sin tests → coordinar con Test Engineer
- UI/frontend → evidencias visuales (capturas + report.md en docs/test-evidence/)

### Integration Workflow & Error Prevention

**⚠️ CRITICAL: Before ANY platform integration:**

#### Phase 1: Pre-Implementation

1. Read: `docs/INTEGRATIONS.md`, `docs/nodes/social-platforms.md`
2. Verify naming: `<platform>Service.js`, PascalCase class, `<PLATFORM>_<PROPERTY>`
3. Check existing: `grep -r "class <Platform>Service" src/integrations/`

#### Phase 2: Checklist

- [ ] Implements interface: authenticate, fetchComments, postReply, blockUser
- [ ] Platform routing in FetchCommentsWorker.js
- [ ] Integration tests
- [ ] NO hardcoded credentials
- [ ] NO env var examples in docs
- [ ] Rate limit handling
- [ ] Uses utils/logger.js

#### Phase 3: Post-Implementation

- [ ] Update `docs/INTEGRATIONS.md`
- [ ] Update `docs/nodes/social-platforms.md`
- [ ] Add to `scripts/update-integration-status.js`

🔗 **Full checklist:** `docs/patterns/coderabbit-lessons.md`

### Task Assessment (FASE 0 - OBLIGATORIA)

**Criterio:**

- **Simple** (inline): ≤2 AC, docs, config, fix pequeño
- **Completo** (Agent): ≥3 AC, P0/P1, features complejas

**Workflow:**

1. Identificar tipo
2. Leer `docs/patterns/coderabbit-lessons.md`
3. Ejecutar assessment
4. Actuar según recomendación: CREATE | FIX | ENHANCE | CLOSE

### CodeRabbit Lessons

**OBLIGATORIO: Leer `docs/patterns/coderabbit-lessons.md` en FASE 0.**

**Workflow:**

- Antes: Leer patrones, aplicar checklist
- Durante: Evitar patrones conocidos
- Después: Identificar nuevos (≥2) → Actualizar → Commit

**Meta:** Reducir repetición <10%

### Planning Mode

- Generar plan: `docs/plan/<issue>.md` (Estado Actual, pasos, agentes, archivos, validación)
- **⚠️ CRÍTICO:** Después de guardar, CONTINUAR inmediatamente (NO pedir permiso)

### Gestión de Agentes Relevantes (GDD Phase 4)

**Cada nodo `docs/nodes/*.md` debe mantener "## Agentes Relevantes"**

**Reglas:**

- Agente invocado no listado → añádelo
- Agente listado ya no aplica → elimínalo
- Mantener ordenado alfabéticamente

**Validación:** `node scripts/resolve-graph.js --validate` antes de cerrar PR

**Checklist:**

- [ ] Leí spec.md y nodo afectado
- [ ] "Agentes Relevantes" refleja agentes usados
- [ ] Añadí faltantes, eliminé irrelevantes
- [ ] Ejecuté validación sin errores
- [ ] Tabla global sincronizada
- [ ] Generé reporte con `--report`

**Tabla global:** Ver "Node-Agent Matrix" en spec.md

### Coverage Authenticity (GDD Phase 15.1)

**CRITICAL: NEVER modify coverage manually.**

- All nodes: `Coverage Source: auto` (from coverage-summary.json)
- Workflow: `npm test --coverage` → `auto-repair-gdd.js --auto` → commit
- Manual discouraged (-20 health points)
- Mismatch >3% = CI failure

### 🎓 GDD Health Score Management

**⚠️ NUNCA ajustar thresholds sin investigación.**

**Workflow CI falla:**

1. Ver: `score-gdd-health.js --ci`
2. Actualizar nodos con valores reales
3. Solo entonces ajustar threshold con justificación

**Principios:**

- ❌ NO shortcuts
- ✅ Arreglar tests ANTES
- ✅ Documentar con `note` + `temporary_until`

🔗 **Guide:** `docs/lessons/gdd-threshold-management.md`

### GDD Activation - When & How

**CRÍTICO: GDD funciona mejor cuanto mejor sincronizada esté la información entre nodos.**

**Cuándo activar GDD (Orchestrator decision tree):**

✅ **SIEMPRE activar:**

- Nueva issue con AC ≥3
- Priority P0/P1
- Multi-area features (labels `area:*` o keywords multi-área)

🔶 **CONDICIONAL (evaluar):**

- Scope expansion (nuevas áreas → re-ejecutar resolve-graph)
- CodeRabbit menciona área no cargada (cargar nodo adicional)

❌ **NUNCA activar:**

- Tareas triviales (typos, formatting, deps update)
- Continuación de trabajo actual (ya tienes contexto)

**Workflow completo:**

1. Fetch: `gh issue view <#> --json labels,title,body`
2. Evaluar: AC count + priority + labels
3. **SI activar:** `/gdd {issue_number}` (skill automática)
4. Map labels → nodes
5. Resolve: `node scripts/resolve-graph.js <nodes>`
6. Load SOLO resolved nodes (NUNCA spec.md completo)

**Durante desarrollo:**

- ✅ Update nodes + "Agentes Relevantes"
- ✅ Validate antes de commits: `node scripts/validate-gdd-runtime.js --full`
- ✅ Check health score antes de merge: `node scripts/score-gdd-health.js --ci`
- ❌ NEVER load entire spec.md
- ❌ NEVER edit spec.md directly (sync automático post-merge)

**Sincronización (crítica para éxito):**

- Post-merge: Automático via `.github/workflows/post-merge-doc-sync.yml`
- Pre-commit: `validate-gdd-runtime.js --full`
- Pre-merge: `score-gdd-health.js --ci` (≥87 required)
- Weekly: `predict-gdd-drift.js --full` (<60 risk)

🔗 **Full documentation:**

- Framework: `docs/GDD-FRAMEWORK.md`
- Activation guide: `docs/GDD-ACTIVATION-GUIDE.md`
- Skills: `.claude/skills/gdd/` (FASE 0), `.claude/skills/gdd-sync.md` (FASE 4)

## GDD 2.0 - Quick Reference

| Phase            | Command                                  | Threshold             |
| ---------------- | ---------------------------------------- | --------------------- |
| **Validation**   | `validate-gdd-runtime.js --full`         | 🟢 HEALTHY            |
| **Health**       | `score-gdd-health.js --ci`               | ≥87 (temp→2025-10-31) |
| **Drift**        | `predict-gdd-drift.js --full`            | <60 risk              |
| **Repair**       | `auto-repair-gdd.js --auto-fix`          | N/A                   |
| **Telemetry**    | `collect-gdd-telemetry.js`               | N/A                   |
| **Auto-Monitor** | `.github/workflows/gdd-auto-monitor.yml` | Every 3 days          |

**Before PR:** Health ≥87, Drift <60, Tests 100%, Coverage: auto

**Status:** 🟢 HEALTHY (80-100) | 🟡 DEGRADED (50-79) | 🔴 CRITICAL (<50)

⚠️ **CRITICAL (Phase 17.1):** Auto-monitoring cannot be disabled without equivalent replacement. This ensures continuous health tracking of GDD system. If you need to disable auto-monitor, you MUST provide an alternative monitoring solution and get Product Owner approval. Unauthorized disabling = PR rejection.

🔗 **Full docs:** `docs/GDD-ACTIVATION-GUIDE.md`, `docs/GDD-TELEMETRY.md`, `docs/GDD-PHASE-15.md`

---

## Documentation Integrity (Phase 15.3)

**Size limits:**

- Index (GDD-IMPLEMENTATION-SUMMARY.md): 350 lines max
- Phase docs (GDD-PHASE-\*.md): 1,000 lines max

**When adding phase:** Create file, update index, update `.gddindex.json`, verify size.

🔗 **Policy:** `docs/GDD-PHASE-15.3-MODULARIZATION.md`

---

## Tareas al Cerrar

**🚨 VERIFICACIÓN OBLIGATORIA:**

1. **Tests DEBEN PASAR al 100%:**

   ```bash
   npm test -- <relevant-tests>
   ```

   - ✅ 0 tests fallando
   - ❌ NUNCA marcar completa con tests failing
   - Si fallan → arreglar ANTES

2. **Pre-Flight Checklist:**
   - [ ] Tests pasando
   - [ ] Docs actualizada
   - [ ] Code quality verificado
   - [ ] Self-review completado

3. **Documentación:**
   - spec.md reflejando cambios
   - Nodos GDD con status actualizado
   - Mapa de cobertura + evidencias visuales
   - Changelog en PR

**⚠️ Si tests failing:**

- NO continúes
- NO marques completa
- Arregla AHORA
- Re-ejecuta
- Solo entonces procede

### 🔐 Rama protegida / Candado por issue

- Antes de cualquier acción: leer `.issue_lock` y comparar con la rama actual (`git rev-parse --abbrev-ref HEAD`).
- Si no coincide: DETENER y reportar. No hacer commits ni push.
- Hooks activos: `pre-commit`, `commit-msg`, `pre-push`.
- Flujo recomendado por issue:
  1. Crear rama: `git checkout -b feature/issue-<id>`
  2. Fijar candado: `echo "feature/issue-<id>" > .issue_lock`
  3. Trabajar normalmente. Los hooks impiden desvíos.
  4. Al cerrar la issue: borrar o actualizar `.issue_lock`.

### 🧠 Memory Hints (Roastr)

- Este proyecto usa subagentes especializados por tarea (ver Task Routing Map).
- Cada issue se ejecuta en su propia rama (ver política Branch Guard).
- Commit sin tests → prohibido.
- Siempre ejecutar /new-pr antes de feature nueva.
- Actualizar spec.md + docs/test-evidence/ al finalizar issue.
- Asignaciones rápidas:
  • UX analysis → @ux-researcher
  • UI generation → @ui-designer
  • Animations → @whimsy-injector
  • Implementation (frontend) → @frontend-dev
  • Implementation (backend) → @back-end-dev
  • Testing → @test-engineer
  • PR & compliance → @github-monitor
  • Task assessment → @task-assessor
- No tocar rama distinta a la fijada en .issue_lock.

---

## 🧩 Claude Skills Integradas

Las skills son rutinas internas que Claude invoca automáticamente según el contexto de trabajo.
Permiten aplicar procedimientos estandarizados sin necesidad de prompts adicionales ni subagentes separados.

---

### 🧱 Lista de Skills Activas

**1️⃣ test-generation-skill**

- **Función**: Genera tests unitarios, de integración y E2E según cambios detectados.
- **Invocación**: Cada vez que se detecta código nuevo o cambios sin tests.
- **Usado por**: front-end-dev, back-end-dev, test-engineer.
- **Output**: Tests + `docs/test-evidence/issue-{id}/summary.md`

**2️⃣ security-audit-skill**

- **Función**: Audita seguridad, exposición de secretos y políticas RLS.
- **Invocación**: En commits o archivos que afecten auth, DB o config.
- **Usado por**: github-guardian, back-end-dev.
- **Output**: `docs/audit/security-report-{id}.md`

**3️⃣ code-review-skill**

- **Función**: Revisión automatizada de calidad y feedback de CodeRabbit.
- **Invocación**: En revisiones de PR o fases previas a merge.
- **Usado por**: github-guardian, orchestrator.
- **Output**: `docs/review/issue-{id}.md`

**4️⃣ visual-validation-skill**

- **Función**: Ejecuta validación visual con Playwright MCP (screenshots + accesibilidad).
- **Invocación**: Ante cambios en UI o componentes visuales.
- **Usado por**: ui-designer, front-end-dev, test-engineer.
- **Output**: `docs/test-evidence/issue-{id}/screenshots/` + `ui-report.md`

**5️⃣ gdd-sync-skill**

- **Función**: Sincroniza nodos GDD, cobertura y health tras cambios en código o arquitectura.
- **Invocación**: Cuando se modifica un nodo o se valida GDD.
- **Usado por**: orchestrator, test-engineer.
- **Output**: `docs/gdd/validation-report-{id}.md`

**6️⃣ spec-update-skill**

- **Función**: Actualiza spec.md y changelogs tras features, merges o refactors.
- **Invocación**: En cierres de issue o PR mergeadas.
- **Usado por**: orchestrator, documentation-agent.
- **Output**: spec.md actualizado + `docs/changelog/issue-{id}.md`

**7️⃣ systematic-debugging-skill** _(Nueva - superpowers-skills)_

- **Función**: Framework de 4 fases para debugging sistemático (root cause → pattern → hypothesis → fix).
- **Invocación**: Cualquier bug, test failure o comportamiento inesperado.
- **Usado por**: test-engineer, back-end-dev, front-end-dev, github-monitor.
- **Output**: Root cause identificado + failing test + fix en fuente

**8️⃣ root-cause-tracing-skill** _(Nueva - superpowers-skills)_

- **Función**: Traza errores hacia atrás en call stack para encontrar trigger original.
- **Invocación**: Errores profundos, invalid data, wrong values.
- **Usado por**: systematic-debugging-skill, test-engineer, back-end-dev.
- **Output**: Original trigger + trace completo + defense-in-depth

**9️⃣ test-driven-development-skill** _(Nueva - superpowers-skills)_

- **Función**: RED→GREEN→REFACTOR - Enforcea escribir tests antes que código.
- **Invocación**: Cualquier feature o bugfix, antes de código de producción.
- **Usado por**: test-engineer, back-end-dev, front-end-dev.
- **Output**: Tests que verifican comportamiento + código minimal

**🔟 verification-before-completion-skill** _(Nueva - superpowers-skills)_

- **Función**: Evidence antes de claims - requiere ejecutar comandos de verificación.
- **Invocación**: Antes de "complete", "done", "passing", "ready".
- **Usado por**: todos los agentes.
- **Output**: Claims basados en evidencia con verificación real

**1️⃣1️⃣ dispatching-parallel-agents-skill** _(Nueva - superpowers-skills)_

- **Función**: Despacha múltiples agentes en paralelo para problemas independientes.
- **Invocación**: 3+ fallos independientes sin shared state.
- **Usado por**: test-engineer, orchestrator.
- **Output**: Problemas resueltos en paralelo + summary por agente

**1️⃣2️⃣ using-git-worktrees-skill** _(Nueva - superpowers-skills)_

- **Función**: Crea workspaces aislados con verificación .gitignore y setup automático.
- **Invocación**: Feature work que necesita aislamiento, antes de implementation plans.
- **Usado por**: orchestrator, writing-plans-skill, executing-plans-skill.
- **Output**: Worktree aislado con tests pasando

**1️⃣3️⃣ finishing-a-development-branch-skill** _(Nueva - superpowers-skills)_

- **Función**: Cierra branches limpiamente presentando 4 opciones estructuradas.
- **Invocación**: Implementation complete, todos los tests pasando.
- **Usado por**: executing-plans-skill, orchestrator.
- **Output**: Work integrado según elección (Merge/PR/Keep/Discard)

**1️⃣4️⃣ writing-plans-skill + executing-plans-skill** _(Nueva - superpowers-skills)_

- **Función**: Crea plans detallados con exact paths, code examples, verification steps.
- **Invocación**: Design completo, need implementation tasks.
- **Usado por**: orchestrator, task-assessor.
- **Output**: Plan completo en docs/plans/ + execution handoff

**1️⃣5️⃣ requesting-code-review-skill + receiving-code-review-skill** _(Nueva - superpowers-skills)_

- **Función**: Estándar para pedir/aplicar review con rigor técnico, no agreement performativo.
- **Invocación**: After each task, major feature, before merge.
- **Usado por**: orchestrator, all-agents.
- **Output**: Review feedback estructurado + implementation con verification

---

### ⚙️ Reglas de Uso

- Claude invoca automáticamente las skills según contexto, sin intervención manual.
- Los subagentes pueden delegar tareas a las skills cuando se requiera precisión o consistencia.
- Cada skill deja trazabilidad en su output asociado.
- El orchestrator valida y sincroniza resultados entre skills y nodos GDD.

**📁 Ubicación de Skills:** `.claude/skills/`  
**📄 Configuración:** `.claude/settings.local.json` → `setting_sources: ["project", "user"]`

---

## Agents Configuration

<!-- import: .claude/AGENTS.md -->
