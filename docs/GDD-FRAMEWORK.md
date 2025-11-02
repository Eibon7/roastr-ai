# Graph Driven Development (GDD) Framework

**Version:** 2.0
**Author:** Eibon (Roastr.ai)
**Last Updated:** 2025-11-02

---

## 🎯 Filosofía

El **GDD (Graph Driven Development)** es un framework para desarrollo con IA que optimiza el contexto cargado por agente mediante sincronización bidireccional de documentación.

### Problema que Resuelve

- **spec.md completo** = 100k+ tokens → desperdicio de contexto
- **IA tiene límite de contexto** → no puede cargar todo
- **Cargar todo** = lento, costoso, ineficiente

### Solución

- **Fragmentar spec.md** en nodos especializados
- **Cargar solo nodos relevantes** para cada tarea
- **Sincronizar cambios bidireccionalmente** (nodos ↔ spec.md)
- **Diseñado para agentes orquestadores** (Claude, GPT, etc.)

---

## 🏗️ Arquitectura

### Componentes Principales

#### 1. **spec.md** - Single Source of Truth

- Documento maestro completo
- Contiene toda la arquitectura del sistema
- Vista expandida del grafo de nodos
- Se actualiza desde nodos modificados (vía sync)
- **NO se edita directamente** (salvo mantenimiento global)

#### 2. **docs/nodes/*.md** - Nodos Especializados

- Fragmentos del spec.md con estructura 1:1
- Unidad atómica de contexto
- Se cargan individualmente según necesidad
- Contienen **frontmatter YAML** con metadatos:

```yaml
---
id: auth-system                    # Único, usado por el grafo
section: "## Authentication"       # Ancla en spec.md
depends_on:                        # Dependencias (otros nodos)
  - database-layer
  - api-layer
status: implemented                # Estado actual
coverage: 85%                      # Auto-generado desde coverage-summary.json
coverage_source: auto              # 'auto' (prohibido 'manual')
last_updated: 2025-11-02
related_prs:
  - 680
  - 628
---

# Authentication System

[Contenido que aparece en spec.md bajo ## Authentication]
```

#### 3. **Relación Jerárquica: spec.md ↔ nodos**

**Estructura:**

```
spec.md:
  # Roastr.ai - Sistema de Moderación

  ## Roast System                    ← docs/nodes/roast.md (nodo raíz)
    ### Shield Moderation            ← docs/nodes/roast-moderation.md (nodo hijo)
    ### Master Prompt                ← docs/nodes/roast-prompt.md (nodo hijo)

  ## Billing System                  ← docs/nodes/billing.md (nodo raíz)
    ### Cost Control                 ← docs/nodes/cost-control.md (nodo hijo)
    ### Subscription Tiers           ← docs/nodes/subscription-tiers.md (nodo hijo)
```

**Reglas:**
- Secciones principales (`##`) = nodos raíz
- Subsecciones (`###`, `####`) = nodos hijos
- spec.md actúa como **vista expandida del grafo**

#### 4. **Scripts GDD**

| Script | Función | Cuándo se ejecuta |
|--------|---------|-------------------|
| `resolve-graph.js` | Resuelve dependencias entre nodos | Pre-implementación (FASE 0) |
| `sync-gdd-nodes.js` | Sincroniza metadata de nodos (post-merge) | Post-merge automático |
| `sync-spec-md.js` | Sincroniza nodos → spec.md | Post-merge automático |
| `validate-gdd-runtime.js` | Valida estado del grafo | Pre-commit, CI/CD |
| `validate-gdd-cross.js` | Valida system-map.yaml | Post-sync |
| `auto-repair-gdd.js` | Repara inconsistencias | Manual, CI/CD |
| `score-gdd-health.js` | Calcula health score | CI/CD, pre-merge |
| `predict-gdd-drift.js` | Predice drift de nodos | Post-sync |
| `generate-sync-report.js` | Genera reporte de sincronización | Post-sync |

---

## 🎬 GDD Activation & Orchestration

**Principio crítico:** GDD funciona mejor cuanto mejor sincronizada esté la información entre nodos.

### Cuándo Activar GDD

**Decision Tree para Orchestrator:**

```
START: New work requested
  ↓
Is it a NEW ISSUE?
  ↓ YES
  Count AC in issue body
    ↓
    AC ≥3?
      ↓ YES → ✅ ACTIVATE /gdd {issue_number}
      ↓ NO
      Priority P0/P1?
        ↓ YES → ✅ ACTIVATE /gdd {issue_number}
        ↓ NO
        Has area:* labels?
          ↓ YES → ✅ ACTIVATE /gdd {issue_number}
          ↓ NO
          Multi-area keywords in title/body?
            ↓ YES → ✅ ACTIVATE /gdd {issue_number}
            ↓ NO → Inline assessment + direct file load

  ↓ NO (Continuation of work)
  Is it SCOPE EXPANSION?
    ↓ YES
    New areas affected?
      ↓ YES → ✅ RE-EXECUTE resolve-graph with new nodes
      ↓ NO → Continue with current context

  ↓ NO
  Is it CODERABBIT REVIEW?
    ↓ YES
    Mentions new area not loaded?
      ↓ YES → ✅ LOAD additional node
      ↓ NO → Fix with current context

  ↓ NO
  Is it CONTINUATION of current work?
    ↓ YES → ❌ NO GDD (already have context)

  ↓ NO
  Is it TRIVIAL task?
    ↓ YES (typo, docs, formatting)
    → ❌ NO GDD (direct fix)
```

### Activation Scenarios

#### ✅ ALWAYS Activate (Mandatory)

1. **New issue with AC ≥3**
   ```
   User: "Vamos con #750 - Implementar usage-based pricing"
   Orchestrator: /gdd 750
   → Assessment: ENHANCE (≥3 AC detected)
   → Nodes: billing, cost-control, subscription-tiers, database-layer
   → Patterns: Multi-tenant context, Cost control validation
   ```

2. **Priority P0/P1 issues**
   ```
   User: "Issue #755 es P0 - Bug crítico en autenticación"
   Orchestrator: /gdd 755
   → Assessment: FIX (P0 = critical)
   → Nodes: auth-system, database-layer, api-layer
   → Patterns: Security audit, Multi-tenant context
   ```

3. **Multi-area features**
   ```
   User: "Añadir OAuth Facebook + guardar en DB + notificar usuario"
   Orchestrator: /gdd {issue}
   → Nodes: integrations-layer, facebook-integration, database-layer, notification-system
   → Patterns: Integration workflow, Multi-tenant context
   ```

#### 🔶 CONDITIONAL Activate (Case by Case)

4. **Scope expansion mid-implementation**
   ```
   INITIAL:
   User: "Implementa generación de roasts"
   Orchestrator: /gdd XXX → Nodes: roast, openai-integration

   EXPANSION:
   User: "Ahora también guarda analytics en base de datos"
   Orchestrator: node scripts/resolve-graph.js roast database-layer analytics
   → Load additional nodes: database-layer, analytics
   ```

5. **CodeRabbit review mentions new area**
   ```
   CodeRabbit: "This change affects cost-control.js - verify tier limits"
   Orchestrator: Check if cost-control node loaded
     → If NO: node scripts/resolve-graph.js cost-control
     → If YES: Continue
   ```

#### ❌ NEVER Activate (Skip GDD)

6. **Trivial tasks**
   - Typos in documentation
   - Formatting/linting fixes
   - Dependency version updates
   - Simple config changes

7. **Continuation of current work**
   ```
   Already working on issue #750 with nodes loaded
   → Continue implementation
   → NO need to re-execute /gdd
   ```

### Activation Commands

**Manual activation:**
```bash
/gdd 750
```

**Programmatic activation (from orchestrator):**
```javascript
// In orchestrator logic
if (shouldActivateGDD(issue)) {
  await invokeSkill('gdd', { issueNumber: issue.number });
}

function shouldActivateGDD(issue) {
  const acCount = countAcceptanceCriteria(issue.body);
  const priority = extractPriority(issue.labels);
  const hasAreaLabel = issue.labels.some(l => l.startsWith('area:'));

  return acCount >= 3 ||
         ['P0', 'P1'].includes(priority) ||
         hasAreaLabel;
}
```

### Importance of Node Synchronization

**CRITICAL:** GDD effectiveness depends on node synchronization quality.

**Why synchronization matters:**

1. **Stale nodes = Wrong decisions**
   ```
   Node says: "Status: planned"
   Reality: "Status: implemented"
   → Orchestrator makes wrong assessment
   ```

2. **Missing dependencies = Incomplete context**
   ```
   auth-system depends_on: [database-layer]
   But database-layer schema changed
   → Load auth-system without updated database context
   → Risk of incompatible implementation
   ```

3. **Coverage drift = False health score**
   ```
   Node says: "Coverage: 85% (manual)"
   Reality: "Coverage: 65% (tests removed)"
   → False confidence in test quality
   ```

**Synchronization checkpoints:**

- ✅ **Post-merge:** Automatic via `.github/workflows/post-merge-doc-sync.yml`
- ✅ **Pre-commit:** Validate with `node scripts/validate-gdd-runtime.js --full`
- ✅ **Pre-merge:** Check health score `node scripts/score-gdd-health.js --ci`
- ✅ **Weekly:** Review drift predictions `node scripts/predict-gdd-drift.js --full`

**Preventing drift:**

```bash
# Before starting work (FASE 0)
node scripts/validate-gdd-runtime.js --full
# Expected: 🟢 HEALTHY

# After implementation (FASE 4)
node scripts/auto-repair-gdd.js --auto-fix
node scripts/validate-gdd-runtime.js --full
# Expected: 🟢 HEALTHY, all nodes synced
```

### Re-Activation During Development

**When to re-load nodes:**

1. **Scope expands to new area:**
   ```bash
   # Initially loaded: roast, openai-integration
   # Scope expands to include: database-layer, analytics

   node scripts/resolve-graph.js roast database-layer analytics
   # Load additional nodes without losing current context
   ```

2. **Dependencies change:**
   ```bash
   # Working on auth-system
   # Someone merges PR changing database-layer schema

   # Re-load database-layer to get latest
   Read: docs/nodes/database-layer.md  # Fresh version
   ```

3. **CodeRabbit identifies missing area:**
   ```bash
   # CodeRabbit: "This affects shield-system"
   # Currently loaded: roast, openai-integration

   node scripts/resolve-graph.js shield-system
   Read: docs/nodes/shield-system.md
   ```

---

## 🔄 Flujo Bidireccional

### spec.md → nodos (Extracción Inicial)

**Cuándo:** Solo al crear nodos nuevos o refactorizar arquitectura.

**Proceso:**
1. Identificar sección en spec.md que merece ser nodo
2. Crear `docs/nodes/<nombre>.md`
3. Copiar contenido de sección
4. Añadir frontmatter YAML con metadatos
5. Actualizar `system-map.yaml` con nuevo nodo
6. Validar: `node scripts/validate-gdd-runtime.js --full`

### nodos → spec.md (Sincronización Post-Cambios)

**Cuándo:** Automáticamente al mergear PR a `main`.

**Proceso (automático vía GitHub Actions):**
1. Detectar archivos cambiados en PR mergeado
2. Mapear archivos → nodos GDD afectados
3. Ejecutar `sync-gdd-nodes.js`:
   - Actualizar metadata (Last Updated, Related PRs)
   - Sincronizar coverage desde `coverage-summary.json`
   - Actualizar cross-references
4. Ejecutar `sync-spec-md.js`:
   - Insertar changelog entry en spec.md
   - Actualizar secciones afectadas
5. Validar `system-map.yaml`
6. Predecir drift
7. Generar reporte: `docs/sync-reports/pr-{número}-sync.md`
8. **Crear PR automático**: `docs/sync-pr-{número}`
9. Asignar al autor original para review

**Workflow:** `.github/workflows/post-merge-doc-sync.yml`

**Resultado:** PR automático con documentación sincronizada que requiere merge manual.

---

## 📋 Workflow Estándar

### FASE 0: Cargar Contexto (Pre-Implementación)

**Objetivo:** Cargar SOLO los nodos relevantes para el issue.

**Pasos:**
1. **Identificar nodos relevantes**:
   - Desde labels del issue (`area:*`)
   - Desde keywords en título/body
   - Uso del skill: `/gdd {issue_number}`

2. **Resolver dependencias**:
   ```bash
   node scripts/resolve-graph.js auth-system billing
   # Output: auth-system, billing, database-layer, api-layer
   ```

3. **Cargar SOLO nodos resueltos**:
   ```bash
   # ✅ CORRECTO
   Read: docs/nodes/auth-system.md
   Read: docs/nodes/billing.md
   Read: docs/nodes/database-layer.md
   Read: docs/nodes/api-layer.md

   # ❌ INCORRECTO
   Read: spec.md  # NUNCA cargar completo
   ```

4. **Leer patrones conocidos**:
   ```bash
   Read: docs/patterns/coderabbit-lessons.md
   ```

**Resultado:** Contexto preciso (<15k tokens) en lugar de 100k+ tokens.

### FASE 1-3: Implementación

**Trabajo con contexto de nodos cargados:**
- Modificar código según arquitectura de nodos
- Actualizar nodos si cambia arquitectura
- Añadir agentes a "Agentes Relevantes" si se invocan
- NO tocar spec.md directamente

### FASE 4: Sincronización (Post-Implementación)

**Automático al mergear PR:**
- Workflow `post-merge-doc-sync.yml` se ejecuta
- Detecta nodos modificados
- Sincroniza metadata + coverage
- Actualiza spec.md con changelog
- Crea PR automático para review

**Manual (si falló automático):**
```bash
# Prompt al orquestador:
"Detecta nodos modificados, valida cambios, sincroniza nodos → spec.md,
verifica spec.md actualizado correctamente"
```

**Validación final:**
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
```

---

## 🚨 Reglas de Oro (Enforcement)

### ❌ NUNCA

1. **Editar spec.md directamente** (salvo mantenimiento global)
2. **Cargar spec.md completo** (excepto sincronización)
3. **Modificar Coverage manualmente** (debe ser `coverage_source: auto`)
4. **Proceder sin validar GDD** después de cambios
5. **Usar `coverage_source: manual`** (-20 health points)
6. **Mergear sin ejecutar validación GDD**

### ✅ SIEMPRE

1. **Resolver dependencias** antes de cargar nodos
2. **Cargar SOLO nodos relevantes** para el issue
3. **Actualizar "Agentes Relevantes"** cuando se invoca agente
4. **Ejecutar `validate-gdd-runtime.js --full`** antes de commit
5. **Ejecutar `score-gdd-health.js --ci`** antes de merge
6. **Confirmar que `auto-repair-gdd.js`** no aplicó parches sin revisión
7. **Todo nodo debe tener**:
   - `id:` único
   - `depends_on:` explícito (aunque sea `[]`)
   - `coverage_source: auto`

---

## 🛠️ Herramientas

### Skills

#### `gdd/SKILL.md` - Cargar Contexto GDD (FASE 0)

**Función:** Carga contexto GDD para un issue específico.

**Invocación:** `/gdd {issue_number}`

**Proceso:**
1. Fetch issue metadata (labels, body, AC count)
2. Assessment (inline si ≤2 AC, Task Assessor si ≥3 AC)
3. Lee `docs/patterns/coderabbit-lessons.md`
4. Mapea labels → nodos
5. Resuelve dependencias
6. Carga SOLO nodos resueltos
7. Anuncia contexto cargado

**Output:**
```markdown
✅ GDD Context Loaded for Issue #680

📋 **Issue**: Complete roast integration test fixes
🏷️  **Labels**: test:integration, area:roast, priority:P1
🎯 **Assessment**: FIX (Task Assessor invoked)

📦 **GDD Nodes Loaded**: (4 nodes)
   1. roast - Roast generation system [implemented]
   2. shield - Shield moderation [implemented]
   3. api-layer - API endpoints [implemented]
   4. test-infrastructure - Testing setup [implemented]

⚠️  **Known Patterns** (from coderabbit-lessons.md):
   • Jest integration tests - Module loading issues
   • Rate limiters break tests - Disable in NODE_ENV=test
   • Router mounting order - Specific before generic

🔧 **Pre-Implementation Checklist**:
   - [ ] Add defensive checks for module-level calls
   - [ ] Disable rate limiters in test environment
   - [ ] Check router mounting order
```

#### `gdd-sync-skill` - Sincronizar Cambios (FASE 4)

**Función:** Sincroniza nodos modificados → spec.md post-implementación.

**Invocación:** Automática (post-merge workflow) o manual.

**Proceso:**
1. Detecta nodos modificados (git diff o checksum)
2. Valida estructura YAML y metadatos
3. Merge semántico → actualizar secciones en spec.md
4. Valida consistencia: `validate-gdd-runtime.js --full`
5. Commit con etiqueta `[sync]`

**Output:** PR automático `docs/sync-pr-{número}` con reporte.

### Agentes

- **Orchestrator** - Coordina workflow GDD completo
- **Guardian** - Valida integridad del spec post-sync
- **Explore** - Ayuda a identificar nodos relevantes cuando unclear

---

## 📊 Validación y Health Score

### Validación Pre-Commit

```bash
# Validar estado completo
node scripts/validate-gdd-runtime.js --full

# Validar system-map.yaml
node scripts/validate-gdd-cross.js --full
```

**Exit codes:**
- `0` - Validación exitosa
- `1` - Warnings (continúa pero revisar)
- `2` - Errors críticos (bloquea commit)

### Health Score Pre-Merge

```bash
# Calcular health score
node scripts/score-gdd-health.js --ci

# Generar reporte
node scripts/score-gdd-health.js --report
```

**Thresholds:**
- **≥87** - 🟢 HEALTHY (pass)
- **50-86** - 🟡 DEGRADED (warnings)
- **<50** - 🔴 CRITICAL (block merge)

**Health Score incluye:**
- Coverage authenticity (`auto` vs `manual`)
- Node consistency (metadata válido)
- Drift risk (<60 risk acceptable)
- Cross-references integrity
- Test coverage (≥90% target)

### Auto-Repair

```bash
# Reparar automáticamente
node scripts/auto-repair-gdd.js --auto-fix

# Dry-run (ver qué se reparará)
node scripts/auto-repair-gdd.js --dry-run
```

**Repara:**
- Coverage desactualizado
- Metadatos faltantes
- Cross-references rotos
- Checksums inválidos

**⚠️ Revisar siempre los parches aplicados automáticamente.**

---

## 📚 Ejemplos Completos

### Ejemplo 1: Issue con Feature Nueva

**Issue #700:** Añadir OAuth 2.0 para Facebook

**Labels:** `area:auth`, `area:integrations`, `priority:P1`

**Workflow:**

```bash
# FASE 0: Cargar contexto
/gdd 700

# Resultado:
# ✅ GDD Context Loaded
# 📦 Nodes: auth-system, integrations-layer, facebook-integration
# ⚠️ Patterns: Integration Workflow, OAuth best practices

# FASE 1-3: Implementación
# - Modifica src/integrations/facebook/
# - Actualiza docs/nodes/facebook-integration.md
# - Añade tests
# - Añade "Guardian" a "Agentes Relevantes" en nodo

# FASE 4: Merge PR
# - Workflow post-merge-doc-sync.yml se ejecuta
# - Crea PR: docs/sync-pr-700
# - Asigna al autor para review
# - Mergear doc-sync PR manualmente

# Validación final
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
```

### Ejemplo 2: Bugfix sin Cambios de Arquitectura

**Issue #680:** Fix integration tests for roast endpoint

**Labels:** `test:integration`, `area:roast`

**Workflow:**

```bash
# FASE 0: Cargar contexto
/gdd 680

# Resultado:
# ✅ GDD Context Loaded
# 📦 Nodes: roast, test-infrastructure
# ⚠️ Patterns: Jest integration tests, rate limiters

# FASE 1-3: Implementación
# - Modifica tests/integration/roast.test.js
# - Modifica src/middleware/roastRateLimiter.js
# - NO modifica nodos (solo tests + middleware)

# FASE 4: Merge PR
# - Workflow detecta cambios en tests/
# - Sincroniza coverage en nodo "roast"
# - Crea doc-sync PR (solo coverage update)
# - Mergear doc-sync PR
```

### Ejemplo 3: Refactor de Arquitectura

**Issue #750:** Refactor billing system to support usage-based pricing

**Labels:** `area:billing`, `priority:P0`, `refactor`

**Workflow:**

```bash
# FASE 0: Cargar contexto + Assessment
/gdd 750

# Resultado:
# ✅ GDD Context Loaded
# 🎯 Assessment: ENHANCE (Task Assessor invoked)
# 📦 Nodes: billing, cost-control, subscription-tiers, database-layer
# ⚠️ Patterns: Multi-tenant context, Cost control validation

# FASE 1: Planning
# - Crea docs/plan/issue-750.md
# - Diseña nueva arquitectura
# - Identifica nodos a modificar

# FASE 2-3: Implementación
# - Modifica src/services/billing.js
# - Actualiza docs/nodes/billing.md (nueva arquitectura)
# - Actualiza docs/nodes/cost-control.md (nueva lógica)
# - Crea nuevo nodo: docs/nodes/usage-tracking.md
# - Añade al system-map.yaml
# - Añade "Guardian" + "TestEngineer" a "Agentes Relevantes"

# FASE 4: Merge PR
# - Workflow detecta 3 nodos modificados + 1 nuevo
# - Sincroniza metadata
# - Actualiza spec.md con nueva sección "Usage Tracking"
# - Valida system-map.yaml
# - Predice drift (nuevo nodo = alto riesgo inicial)
# - Crea doc-sync PR con reporte completo
# - Review + merge doc-sync PR

# Validación final
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
# Expected: Health ≥87, Drift <60
```

---

## 🔧 Troubleshooting

### Problema: Sync automático no se ejecutó

**Diagnóstico:**
```bash
# Verificar si PR fue mergeado a main
git log --oneline main | head -5

# Verificar logs del workflow
gh run list --workflow=post-merge-doc-sync.yml --limit=5

# Verificar si PR necesitaba sync
grep -qE '(src/|tests/|docs/nodes/|system-map.yaml|spec.md)' changed-files.txt
```

**Solución:**
```bash
# Ejecutar sync manualmente
echo '{"nodes": ["auth-system", "billing"], "pr": 700, "branch": "fix/auth"}' > affected-nodes.json
node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json
node scripts/sync-spec-md.js --nodes affected-nodes.json
node scripts/validate-gdd-runtime.js --full
```

### Problema: Health score <87

**Diagnóstico:**
```bash
node scripts/score-gdd-health.js --ci --verbose
# Revisa qué nodos tienen issues
```

**Soluciones comunes:**
- **Coverage manual** → `node scripts/auto-repair-gdd.js --auto-fix`
- **Metadatos faltantes** → Añadir `id:`, `depends_on:` en frontmatter
- **Cross-references rotos** → Actualizar links en nodos
- **Tests failing** → Arreglar tests ANTES de ajustar thresholds

### Problema: Drift risk >60

**Diagnóstico:**
```bash
node scripts/predict-gdd-drift.js --full
cat gdd-drift.json | jq '.high_risk_nodes'
```

**Causas comunes:**
- Nodo sin tests (coverage 0%)
- Nodo sin PRs recientes (stale)
- Dependencias circulares

**Soluciones:**
- Añadir tests al nodo
- Actualizar documentación
- Revisar `depends_on:` para evitar ciclos

---

## 📖 Referencias

- **Docs principales:**
  - `docs/GDD-ACTIVATION-GUIDE.md` - Guía de activación completa
  - `docs/GDD-TELEMETRY.md` - Métricas y telemetría
  - `docs/GDD-PHASE-15.md` - Coverage authenticity
  - `docs/patterns/coderabbit-lessons.md` - Patrones conocidos

- **Skills:**
  - `.claude/skills/gdd/SKILL.md` - Skill de carga de contexto
  - `.claude/skills/gdd-sync-skill.md` - Skill de sincronización

- **Workflows:**
  - `.github/workflows/post-merge-doc-sync.yml` - Sync automático
  - `.github/workflows/gdd-validate.yml` - Validación CI
  - `.github/workflows/gdd-repair.yml` - Auto-repair CI

- **Scripts:**
  - `scripts/resolve-graph.js`
  - `scripts/sync-gdd-nodes.js`
  - `scripts/sync-spec-md.js`
  - `scripts/validate-gdd-runtime.js`
  - `scripts/score-gdd-health.js`

---

## 📝 Changelog

### v2.0 (2025-11-02)
- Documentación completa del framework GDD
- Clarificación de flujo bidireccional
- Ejemplos completos de workflows
- Troubleshooting guide
- Reglas de oro enforcement

### v1.0 (2025-09-01)
- Framework GDD inicial
- Scripts básicos de validación
- Workflow manual de sincronización

---

**Maintained by:** Orchestrator
**Review Frequency:** Quarterly or after major GDD changes
**Last Reviewed:** 2025-11-02
