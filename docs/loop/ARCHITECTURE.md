# Loop Autónomo Supervisado - Arquitectura Técnica

**Versión:** 1.0  
**Issue:** ROA-539  
**Fecha:** 2026-01-22

---

## 📐 Visión General

El Loop Autónomo Supervisado es un sistema de ejecución de tareas con validación automática V2-only y rollback automático. Construido sobre el blindaje V2-only (ROA-538), garantiza que TODO código nuevo use artefactos V2 ÚNICAMENTE.

---

## 🏗️ Componentes Principales

### 1. Execution Engine (`execute-task.js`)

**Responsabilidad:** Orquestar flujo completo de ejecución.

**Flujo:**

```text
┌─────────────────────────────────────────────────────────┐
│                   EXECUTION ENGINE                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Initialize Progress Tracking                        │
│     └─> Create docs/autonomous-progress/<task-id>/     │
│     └─> Create progress.json                            │
│     └─> Create decisions.jsonl                          │
│                                                          │
│  2. Pre-Task Validation (V2-only gate)                  │
│     └─> scripts/loop/pre-task.js                        │
│     └─> If BLOCK → STOP (log decision, exit 1)         │
│     └─> If PASS → CONTINUE                              │
│                                                          │
│  3. Execute with Rollback Protection                    │
│     └─> Stash cambios previos                           │
│     └─> Execute instruction                             │
│     └─> Create temp commit                              │
│                                                          │
│  4. Post-Task Validation (V2-only gate)                 │
│     └─> scripts/loop/post-task.js                       │
│     └─> If BLOCK → Rollback + STOP                      │
│     └─> If PASS → Finalize commit                       │
│                                                          │
│  5. Finalization                                         │
│     └─> Restore stash (if exists)                       │
│     └─> Update progress.json                            │
│     └─> Log final decision                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```text

**APIs:**

```javascript
async function executeTask(options) {
  // options: { taskId, description, instruction, prdPath, dryRun, timeout }
  // returns: { success, taskId, phase, status, reason, executionTimeMs }
}
```text

**Estados de tarea:**

- `pending` - Creada, no iniciada
- `validating-pre` - Validando pre-task
- `in-progress` - Ejecutando
- `validating-post` - Validando post-task
- `completed` - Completada exitosamente
- `blocked` - Bloqueada por violaciones
- `rolled-back` - Rollback aplicado

---

### 2. Rollback Manager (`lib/rollback.js`)

**Responsabilidad:** Manejar rollback automático ante violaciones.

**Estrategia:**

```text
┌─────────────────────────────────────────────────────────┐
│                   ROLLBACK STRATEGY                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  BEFORE TASK:                                            │
│  1. Capture original state (commit, branch)             │
│  2. Stash cambios previos (preserva working directory)  │
│                                                          │
│  DURING TASK:                                            │
│  3. Execute instruction                                  │
│  4. Create temp commit                                   │
│                                                          │
│  POST-TASK VALIDATION:                                   │
│  5a. If PASS:                                            │
│      - Amend temp commit (make permanent)               │
│      - Restore stash                                     │
│      - DONE                                              │
│                                                          │
│  5b. If BLOCK:                                           │
│      - Revert temp commit                                │
│      - Restore stash                                     │
│      - Log rollback                                      │
│      - EXIT with error                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```text

**APIs:**

```javascript
async function executeWithRollback(taskId, taskFn, postTaskValidationFn) {
  // returns: { success, executed, validated, rolledBack, rollbackReason }
}

async function rollback(taskId, state) {
  // returns: { success, commitReverted, stashRestored, errors, steps }
}
```text

**RollbackState:**

```javascript
{
  taskId: "task-001",
  originalCommit: "abc123...",
  originalBranch: "main",
  tempCommit: "def456...",
  stashCreated: true,
  timestamp: "2026-01-22T10:00:00Z"
}
```text

---

### 3. Git Utilities (`lib/git-utils.js`)

**Responsabilidad:** Operaciones git seguras y atómicas.

**Funciones principales:**

```javascript
// State
isWorkingDirectoryClean()
getCurrentCommit()
getCurrentBranch()
getModifiedFiles()
getStagedFiles()

// Stash
stashChanges(taskId)
popStash(taskId)
dropStash(taskId)

// Commit
createTempCommit(taskId, phase)
amendCommit(taskId, newMessage)
revertCommit(commitSha)
resetToCommit(commitSha)

// Rollback completo
rollbackTask(taskId, commitSha)
```text

**Garantías:**

- ✅ Operaciones atómicas (o todo o nada)
- ✅ Error handling robusto
- ✅ No deja residuos en working directory
- ✅ Stash messages con taskId para identificación

---

### 4. Decision Engine (`lib/decision-engine.js`)

**Responsabilidad:** Determinar decisión basada en violaciones.

**Decisiones:**

```javascript
const DECISION = {
  CONTINUE: 'CONTINUE',     // Continuar
  BLOCK: 'BLOCK',           // Detener + rollback
  ESCALATE: 'ESCALATE',     // Requiere humano
  COMPLETED: 'COMPLETED',   // Tarea completa
  ROLLED_BACK: 'ROLLED_BACK', // Rollback aplicado
};
```text

**Severidades:**

```javascript
const VIOLATION_SEVERITY = {
  CRITICAL: 'critical',  // BLOCK inmediato
  HIGH: 'high',          // BLOCK o ESCALATE
  MEDIUM: 'medium',      // ESCALATE
  LOW: 'low',            // Warning, CONTINUE
};
```text

**Tipos de violación por severidad:**

| Severidad | Tipos |
|-----------|-------|
| CRITICAL  | `LEGACY_FILE_MODIFICATION`, `LEGACY_IMPORT`, `LEGACY_WORKER`, `LEGACY_SERVICE` |
| HIGH      | `LEGACY_ID_REFERENCE`, `LEGACY_PLAN_ID`, `LEGACY_TOKEN` |
| MEDIUM    | `LEGACY_BILLING_PROVIDER`, `LEGACY_PLATFORM` |
| LOW       | Otros |

**Lógica de decisión:**

```javascript
function makeDecision(phase, validationResult, context) {
  // Pre-task: CONTINUE o BLOCK
  if (phase === 'pre-task') {
    return validationResult.passed ? CONTINUE : BLOCK;
  }
  
  // Post-task: CONTINUE, BLOCK o ESCALATE
  if (phase === 'post-task') {
    if (validationResult.passed) return CONTINUE;
    
    const severity = getSeverity(violations);
    
    if (severity === CRITICAL) return BLOCK;
    if (severity === HIGH) {
      return context.allowHighViolations ? ESCALATE : BLOCK;
    }
    return ESCALATE; // MEDIUM/LOW
  }
}
```text

---

### 5. Escalation Handler (`lib/escalation.js`)

**Responsabilidad:** Manejar escalación a humanos.

**Opciones de decisión:**

```javascript
const ESCALATION_OPTIONS = {
  APPROVE: 'approve',   // Aprobar (ignorar violaciones)
  REJECT: 'reject',     // Rechazar (rollback + reintento)
  MODIFY: 'modify',     // Modificar manualmente
  ABORT: 'abort',       // Abortar completamente
};
```text

**Modos de escalación:**

1. **Interactivo (stdin):** Prompt en terminal
2. **Archivo:** Espera archivo `escalation-decision.json`
3. **Timeout:** Aborta automáticamente si no hay decisión

**Flujo:**

```text
┌─────────────────────────────────────────────────────────┐
│                ESCALATION WORKFLOW                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Detectar necesidad de escalación                    │
│     └─> Post-task ESCALATE decision                     │
│                                                          │
│  2. Mostrar violaciones y opciones                      │
│     └─> APPROVE / REJECT / MODIFY / ABORT               │
│                                                          │
│  3. Esperar decisión humana                             │
│     └─> Interactive stdin (si tty)                      │
│     └─> Archivo JSON (si non-interactive)               │
│     └─> Timeout (5 min → ABORT por defecto)            │
│                                                          │
│  4. Aplicar decisión                                     │
│     └─> APPROVE → Commit final                          │
│     └─> REJECT → Rollback + exit                        │
│     └─> MODIFY → Pause (manual intervention)            │
│     └─> ABORT → Rollback + mark aborted                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```text

**Archivos generados:**

- `escalation.json` - Estado de escalación
- `ESCALATION-INSTRUCTIONS.txt` - Instrucciones para humano
- `escalation-decision.json` - Decisión del humano

---

### 6. PRD Parser (`lib/prd-parser.js`)

**Responsabilidad:** Parsear PRDs y generar subtareas.

**Estructura de PRD:**

```markdown
# PRD: Feature X

## Objetivos
- Objetivo 1
- Objetivo 2

## Acceptance Criteria

### AC1: Título del AC
- [ ] Checklist item 1
- [ ] Checklist item 2

### AC2: Otro AC
- [ ] Checklist item

## Out of Scope
- Item fuera de scope

## Technical Notes
- Nota técnica
```text

**Parser output:**

```javascript
{
  path: "/path/to/prd.md",
  title: "Feature X",
  objectives: ["Objetivo 1", "Objetivo 2"],
  acceptanceCriteria: [
    {
      id: "AC1",
      title: "Título del AC",
      checklist: [
        { item: "Checklist item 1", completed: false },
        { item: "Checklist item 2", completed: false }
      ]
    }
  ],
  outOfScope: ["Item fuera de scope"],
  technicalNotes: ["Nota técnica"],
  subtasks: [
    {
      id: "subtask-ac1",
      acId: "AC1",
      title: "Título del AC",
      description: "Implementar Título del AC",
      checklist: [...],
      status: "pending",
      completed: false
    }
  ]
}
```text

**Funciones:**

```javascript
parsePRD(prdPath)
isInScope(prd, taskDescription)
findSubtaskByAC(prd, acId)
updateACProgress(prdPath, acId, itemIndex)
markACComplete(prdPath, acId)
```text

---

## 🔒 Integración con V2-Only Gate (ROA-538)

### Pre-Task Gate (`scripts/loop/pre-task.js`)

**Propósito:** Validar ANTES de ejecutar tarea.

**Ejecución:**

```bash
node scripts/loop/pre-task.js
# Exit code 0: PASS (CONTINUE)
# Exit code 1: BLOCK (violaciones detectadas)
```text

**Output JSON:**

```json
{
  "phase": "pre-task",
  "timestamp": "2026-01-22T10:00:00Z",
  "status": "CONTINUE",
  "v2Only": {
    "passed": true,
    "violations": [],
    "exitCode": 0
  },
  "message": "✅ Pre-task validation PASSED"
}
```text

### Post-Task Gate (`scripts/loop/post-task.js`)

**Propósito:** Validar DESPUÉS de ejecutar tarea.

**Ejecución:**

```bash
node scripts/loop/post-task.js
# Exit code 0: PASS (CONTINUE)
# Exit code 1: BLOCK (violaciones detectadas)
```text

**Output JSON:** (mismo formato que pre-task)

### V2-Only Validator (`scripts/loop/validators/v2-only.js`)

**Detecta:**

- Modificación de archivos legacy
- Imports desde módulos legacy
- Referencias a IDs legacy
- Uso de workers/servicios legacy
- Tokens legacy en código (`v1`, `legacy`, `old`)

**Fuentes Permitidas (V2 ONLY):**

- `docs/SSOT-V2.md`, `docs/nodes-v2/`, `docs/system-map-v2.yaml`
- `apps/backend-v2/`, `apps/frontend-v2/`, `apps/shared/`
- `scripts/loop/`, `scripts/ci/`

**Fuentes Prohibidas (LEGACY V1):**

- `docs/legacy/`, `docs/nodes/`, `spec.md`, `docs/system-map.yaml`
- `src/` (Backend V1), `frontend/` (Frontend V1)
- Workers/servicios legacy según `system-map-v2.yaml`

---

## 📊 Progress Tracking

### Estructura de Directorios

```text
docs/autonomous-progress/
├── task-001/
│   ├── progress.json           # Estado actual (overwrite)
│   ├── decisions.jsonl         # Log de decisiones (append-only)
│   ├── violations.jsonl        # Log de violaciones (append-only)
│   └── artifacts/              # Archivos generados
│       ├── pre-task-report.json
│       ├── post-task-report.json
│       ├── rollback-state.json
│       └── rollback-log.txt
└── README.md
```text

### progress.json

**Estado completo de tarea:**

```json
{
  "taskId": "task-001",
  "description": "Crear endpoint roast",
  "prdPath": "docs/prd/feature-roast-v2.md",
  "status": "completed",
  "createdAt": "2026-01-22T10:00:00Z",
  "startedAt": "2026-01-22T10:01:00Z",
  "completedAt": "2026-01-22T10:05:00Z",
  "validation": {
    "preTask": {
      "passed": true,
      "timestamp": "2026-01-22T10:01:05Z",
      "violations": []
    },
    "postTask": {
      "passed": true,
      "timestamp": "2026-01-22T10:04:55Z",
      "violations": []
    }
  },
  "metrics": {
    "executionTimeMs": 240000,
    "filesModified": 3,
    "filesCreated": 1,
    "testsAdded": 2,
    "violationsDetected": 0,
    "rollbacksApplied": 0
  },
  "currentPhase": "completed",
  "lastUpdate": "2026-01-22T10:05:00Z"
}
```text

### decisions.jsonl

**Log append-only de decisiones:**

```jsonl
{"timestamp":"2026-01-22T10:01:05Z","phase":"pre-task","decision":"CONTINUE","reason":"No violations detected"}
{"timestamp":"2026-01-22T10:04:55Z","phase":"post-task","decision":"CONTINUE","reason":"No violations detected"}
{"timestamp":"2026-01-22T10:05:00Z","phase":"completion","decision":"COMPLETED","reason":"Task completed successfully"}
```text

### violations.jsonl

**Log append-only de violaciones (si las hay):**

```jsonl
{"timestamp":"2026-01-22T10:04:50Z","phase":"post-task","type":"LEGACY_IMPORT","file":"test.js","details":"Import from src/ detected","suggestion":"Use apps/backend-v2/"}
```text

---

## 🧪 Testing

### Test Coverage

- **Decision Engine:** 21 tests ✅ PASS
- **PRD Parser:** 17 tests ✅ PASS
- **Execute Task:** 13 tests ✅ PASS
- **Escalation Handler:** 13 tests ✅ PASS
- **Rollback Manager:** 11 tests ✅ PASS
- **Git Utils:** 7 tests ✅ PASS

#### Total: 82 tests, 100% passing

### Ejecutar Tests

```bash
# Tests de decision engine
npm test -- tests/loop/decision-engine.test.js

# Tests de PRD parser
npm test -- tests/loop/prd-parser.test.js

# Todos los tests del Loop
npm test -- tests/loop/
```text

---

## 🔐 Garantías de Seguridad

1. **V2-Only Enforcement Absoluto**
   - Pre-task y post-task gates NO se pueden bypassear
   - BLOCK inmediato si violaciones críticas

2. **Rollback Automático**
   - Si post-task BLOCK → rollback garantizado
   - Estado original restaurado (commit + stash)

3. **No Residuos**
   - Working directory limpio después de rollback
   - Stash messages con taskId para identificación

4. **Logging Completo**
   - Todas las decisiones en `decisions.jsonl`
   - Todas las violaciones en `violations.jsonl`
   - Rollback detallado en `rollback-log.txt`

5. **Idempotencia**
   - Re-ejecutar tarea con mismo taskId sobreescribe progreso anterior
   - No crea duplicados

---

## 📚 Referencias

- **Plan de Issue:** `docs/plan/issue-ROA-539.md`
- **Prerequisito:** `docs/plan/issue-ROA-538.md` (V2-only)
- **Progress Tracking:** `docs/autonomous-progress/README.md`
- **Guía de Uso:** `docs/loop/README.md`

---

**Issue:** ROA-539  
**Versión:** 1.0  
**Última actualización:** 2026-01-22
