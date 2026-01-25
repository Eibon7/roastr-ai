# Autonomous Progress Tracking

Este directorio contiene el tracking de progreso del **Loop Autónomo Supervisado**.

## 📁 Estructura

Cada tarea del Loop tiene su propio directorio:

```text
docs/autonomous-progress/
├── task-001/
│   ├── progress.json           # Estado actual de la tarea
│   ├── decisions.jsonl         # Log de decisiones (append-only)
│   ├── violations.jsonl        # Log de violaciones (si las hay)
│   └── artifacts/              # Archivos generados
│       ├── pre-task-report.json
│       ├── post-task-report.json
│       ├── rollback-state.json
│       └── rollback-log.txt
├── task-002/
│   └── ...
└── README.md                   # Este archivo
```

## 📊 progress.json

Estado completo de la tarea:

```json
{
  "taskId": "task-001",
  "description": "Crear endpoint /api/v2/roast",
  "prdPath": "docs/prd/feature-roast-v2.md",
  "status": "in-progress",
  "createdAt": "2026-01-22T10:00:00Z",
  "startedAt": "2026-01-22T10:01:00Z",
  "completedAt": null,
  "validation": {
    "preTask": {
      "passed": true,
      "timestamp": "2026-01-22T10:01:05Z",
      "violations": []
    },
    "postTask": {
      "passed": null,
      "timestamp": null,
      "violations": []
    }
  },
  "metrics": {
    "executionTimeMs": 45000,
    "filesModified": 3,
    "filesCreated": 1,
    "testsAdded": 2,
    "violationsDetected": 0,
    "rollbacksApplied": 0
  },
  "currentPhase": "execution",
  "lastUpdate": "2026-01-22T10:02:00Z"
}
```

### Estados posibles

| Estado | Descripción |
|--------|-------------|
| `pending` | Tarea creada pero no iniciada |
| `validating-pre` | Ejecutando pre-task gate |
| `in-progress` | Ejecución en curso |
| `validating-post` | Ejecutando post-task gate |
| `completed` | Completada exitosamente |
| `blocked` | Bloqueada por violaciones |
| `rolled-back` | Rollback aplicado |
| `escalated` | Requiere intervención humana |

### Fases posibles

- `pending` - Inicial
- `pre-task-validation` - Validando antes de ejecutar
- `pre-task-validation-failed` - Pre-task BLOCK
- `execution` - Ejecutando tarea
- `post-task-validation` - Validando después de ejecutar
- `post-task-validation-failed` - Post-task BLOCK
- `rollback` - Aplicando rollback
- `completed` - Finalizada exitosamente
- `rolled-back` - Rollback completado
- `error` - Error fatal

## 📝 decisions.jsonl

Log append-only de decisiones del Loop (formato JSONL):

```jsonl
{"timestamp":"2026-01-22T10:01:05Z","phase":"pre-task","decision":"CONTINUE","reason":"No violations detected","v2Only":{"passed":true}}
{"timestamp":"2026-01-22T10:05:30Z","phase":"execution","decision":"CONTINUE","reason":"File created: apps/backend-v2/src/routes/roast.ts","artifact":"apps/backend-v2/src/routes/roast.ts"}
{"timestamp":"2026-01-22T10:10:00Z","phase":"post-task","decision":"CONTINUE","reason":"No violations detected","v2Only":{"passed":true}}
{"timestamp":"2026-01-22T10:10:05Z","phase":"completion","decision":"COMPLETED","reason":"Task completed successfully","metrics":{"filesModified":3,"testsAdded":2}}
```

### Decisiones posibles

| Decisión | Descripción |
|----------|-------------|
| `CONTINUE` | Continuar con siguiente paso |
| `BLOCK` | Detener por violaciones |
| `ESCALATE` | Requiere decisión humana |
| `COMPLETED` | Tarea completada |
| `ROLLED_BACK` | Rollback aplicado |

## 🚨 violations.jsonl

Log append-only de violaciones detectadas (formato JSONL):

```jsonl
{"timestamp":"2026-01-22T10:15:00Z","phase":"post-task","type":"LEGACY_IMPORT","file":"apps/backend-v2/src/routes/roast.ts","details":"Import from src/ (V1) detected","suggestion":"Use apps/backend-v2/ modules"}
{"timestamp":"2026-01-22T10:15:05Z","phase":"rollback","action":"REVERT","commit":"abc123","reason":"Post-task violations detected"}
```

### Tipos de violaciones

- `LEGACY_FILE_MODIFICATION` - Modificación de archivo legacy
- `LEGACY_IMPORT` - Import desde módulo legacy
- `LEGACY_ID_REFERENCE` - Referencia a ID legacy
- `LEGACY_WORKER` - Uso de worker legacy
- `LEGACY_SERVICE` - Uso de servicio legacy
- `LEGACY_TOKEN` - Token legacy en código (`v1`, `legacy`, `old`)

## 🗂️ artifacts/

Directorio con archivos generados por el Loop:

### pre-task-report.json

Reporte de validación pre-task (copia del output de `pre-task.js`).

### post-task-report.json

Reporte de validación post-task (copia del output de `post-task.js`).

### rollback-state.json

Estado del rollback (para poder restaurar):

```json
{
  "taskId": "task-001",
  "originalCommit": "abc123...",
  "originalBranch": "main",
  "tempCommit": "def456...",
  "stashCreated": true,
  "timestamp": "2026-01-22T10:15:00Z"
}
```

### rollback-log.txt

Log legible del rollback aplicado:

```
═══════════════════════════════════════════════════════════
ROLLBACK LOG - Task task-001
═══════════════════════════════════════════════════════════

Timestamp: 2026-01-22T10:15:05Z

VALIDATION RESULT:
- Status: BLOCK
- Passed: false
- Violations: 1

ROLLBACK RESULT:
- Success: true
- Commit Reverted: true
- Stash Restored: true
- Errors: 0

STEPS EXECUTED:
1. Commit reverted
2. Stash restored

═══════════════════════════════════════════════════════════
```

## 📖 Uso

### Crear nueva tarea

```bash
node scripts/loop/execute-task.js \
  --task-id="task-001" \
  --description="Crear endpoint roast" \
  --instruction="touch apps/backend-v2/src/routes/roast.ts"
```

### Ver progreso de tarea

```bash
# Ver progress.json
cat docs/autonomous-progress/task-001/progress.json | jq

# Ver decisiones
cat docs/autonomous-progress/task-001/decisions.jsonl

# Ver violaciones (si las hay)
cat docs/autonomous-progress/task-001/violations.jsonl
```

### Analizar métricas

```bash
# Métricas de una tarea
jq '.metrics' docs/autonomous-progress/task-001/progress.json

# Listar todas las tareas
ls -1 docs/autonomous-progress/ | grep -v README.md

# Tareas completadas
jq -r 'select(.status=="completed") | .taskId' docs/autonomous-progress/*/progress.json

# Tareas con violaciones
jq -r 'select(.metrics.violationsDetected>0) | .taskId' docs/autonomous-progress/*/progress.json
```

## 🔧 Limpieza

Para eliminar tareas antiguas:

```bash
# Eliminar tarea específica
rm -rf docs/autonomous-progress/task-001/

# Eliminar tareas completadas hace más de 30 días
find docs/autonomous-progress/ -type d -mtime +30 -exec rm -rf {} +
```

## 📚 Referencias

- **Loop Execution Engine:** `scripts/loop/execute-task.js`
- **Rollback Manager:** `scripts/loop/lib/rollback.js`
- **Git Utils:** `scripts/loop/lib/git-utils.js`
- **Documentation:** `docs/plan/issue-ROA-539.md`

---

**Issue:** ROA-539  
**Versión:** 1.0  
**Última actualización:** 2026-01-22
