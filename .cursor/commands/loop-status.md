---
description: "Ver estado y progreso de tareas del Loop Autónomo Supervisado"
tags: ["loop", "status", "progress", "monitoring"]
---

# Loop: Ver Estado

Ver estado completo de tareas ejecutadas con el Loop Autónomo Supervisado.

## Uso Básico

```bash
# Ver estado de una tarea específica
cat docs/autonomous-progress/<task-id>/progress.json | jq

# Listar todas las tareas
ls -la docs/autonomous-progress/
```

## Ver Progreso de Tarea

### Estado Completo

```bash
cat docs/autonomous-progress/task-001/progress.json | jq
```

**Output:**
```json
{
  "taskId": "task-001",
  "description": "Crear endpoint roast",
  "status": "completed",
  "createdAt": "2026-01-22T10:00:00Z",
  "completedAt": "2026-01-22T10:05:00Z",
  "validation": {
    "preTask": { "passed": true },
    "postTask": { "passed": true }
  },
  "metrics": {
    "executionTimeMs": 240000,
    "filesModified": 3,
    "violationsDetected": 0
  }
}
```

### Decisiones (Timeline)

```bash
cat docs/autonomous-progress/task-001/decisions.jsonl | jq -s
```

**Output:**
```json
[
  {
    "timestamp": "2026-01-22T10:01:05Z",
    "phase": "pre-task",
    "decision": "CONTINUE",
    "reason": "No violations detected"
  },
  {
    "timestamp": "2026-01-22T10:04:55Z",
    "phase": "post-task",
    "decision": "CONTINUE",
    "reason": "No violations detected"
  }
]
```

### Violaciones (Si las hay)

```bash
cat docs/autonomous-progress/task-001/violations.jsonl | jq -s
```

**Output (ejemplo con violaciones):**
```json
[
  {
    "timestamp": "2026-01-22T10:04:50Z",
    "phase": "post-task",
    "type": "LEGACY_IMPORT",
    "file": "test.js",
    "details": "Import from src/ detected",
    "suggestion": "Use apps/backend-v2/"
  }
]
```

## Ver Todas las Tareas

### Listar tareas

```bash
ls -1 docs/autonomous-progress/ | grep -v README
```

### Ver estado de todas las tareas

```bash
for dir in docs/autonomous-progress/*/; do
  task=$(basename "$dir")
  status=$(jq -r '.status' "$dir/progress.json" 2>/dev/null || echo "unknown")
  echo "$task: $status"
done
```

### Contar tareas por estado

```bash
echo "=== Resumen de Tareas ==="
echo "Completed: $(grep -r '"status": "completed"' docs/autonomous-progress/ | wc -l)"
echo "Blocked: $(grep -r '"status": "blocked"' docs/autonomous-progress/ | wc -l)"
echo "Rolled-back: $(grep -r '"status": "rolled-back"' docs/autonomous-progress/ | wc -l)"
```

## Estados de Tarea

| Estado | Descripción |
|--------|-------------|
| `pending` | Creada, no iniciada |
| `validating-pre` | Validando pre-task |
| `in-progress` | Ejecutando |
| `validating-post` | Validando post-task |
| `completed` | ✅ Completada exitosamente |
| `blocked` | ❌ Bloqueada por violaciones |
| `rolled-back` | 🔄 Rollback aplicado |

## Fases de Decisión

| Fase | Descripción |
|------|-------------|
| `pre-task` | Validación ANTES de ejecutar |
| `execution` | Durante ejecución |
| `post-task` | Validación DESPUÉS de ejecutar |
| `completion` | Finalización de tarea |

## Tipos de Decisión

| Decisión | Significado |
|----------|-------------|
| `CONTINUE` | ✅ Continuar (sin violaciones) |
| `BLOCK` | ❌ Detener + rollback |
| `ESCALATE` | ⚠️ Requiere intervención humana |
| `COMPLETED` | ✅ Tarea completada |
| `ROLLED_BACK` | 🔄 Rollback aplicado |

## Ver Artefactos

```bash
# Ver estado de rollback (si se aplicó)
cat docs/autonomous-progress/task-001/artifacts/rollback-state.json | jq

# Ver log de rollback
cat docs/autonomous-progress/task-001/artifacts/rollback-log.txt

# Ver reporte pre-task
cat docs/autonomous-progress/task-001/artifacts/pre-task-report.json | jq

# Ver reporte post-task
cat docs/autonomous-progress/task-001/artifacts/post-task-report.json | jq
```

## Dashboard en Terminal

Script helper para ver estado completo:

```bash
#!/bin/bash
# save as: scripts/loop-status.sh

echo "════════════════════════════════════════════════════════"
echo "   LOOP AUTÓNOMO SUPERVISADO - DASHBOARD"
echo "════════════════════════════════════════════════════════"
echo ""

TOTAL=$(find docs/autonomous-progress/ -name "progress.json" | wc -l)
COMPLETED=$(grep -r '"status": "completed"' docs/autonomous-progress/ 2>/dev/null | wc -l)
BLOCKED=$(grep -r '"status": "blocked"' docs/autonomous-progress/ 2>/dev/null | wc -l)
ROLLEDBACK=$(grep -r '"status": "rolled-back"' docs/autonomous-progress/ 2>/dev/null | wc -l)

echo "📊 RESUMEN"
echo "  Total tareas: $TOTAL"
echo "  ✅ Completed: $COMPLETED"
echo "  ❌ Blocked: $BLOCKED"
echo "  🔄 Rolled-back: $ROLLEDBACK"
echo ""

echo "📋 TAREAS RECIENTES (últimas 5)"
echo ""

for dir in $(ls -t docs/autonomous-progress/ | grep -v README | head -5); do
  if [ -f "docs/autonomous-progress/$dir/progress.json" ]; then
    task=$(basename "$dir")
    status=$(jq -r '.status' "docs/autonomous-progress/$dir/progress.json")
    desc=$(jq -r '.description' "docs/autonomous-progress/$dir/progress.json")
    time=$(jq -r '.createdAt' "docs/autonomous-progress/$dir/progress.json")
    
    echo "  🔹 $task"
    echo "     Status: $status"
    echo "     Desc: $desc"
    echo "     Created: $time"
    echo ""
  fi
done

echo "════════════════════════════════════════════════════════"
```

**Usar:**
```bash
chmod +x scripts/loop-status.sh
./scripts/loop-status.sh
```

## Limpiar Tareas Antiguas

```bash
# Backup primero
tar -czf autonomous-progress-backup-$(date +%Y%m%d).tar.gz docs/autonomous-progress/

# Eliminar tareas completed de hace más de 7 días
# Constraints: -maxdepth 2 (solo task dirs), -mindepth 2 (no root), -name 'task-*' (solo task dirs)
find docs/autonomous-progress/ -mindepth 1 -maxdepth 1 -type d -name 'task-*' -mtime +7 -delete

# Eliminar tareas específicas
rm -rf docs/autonomous-progress/task-001
```

## Referencias

- **Progress Tracking:** `docs/autonomous-progress/README.md`
- **Arquitectura:** `docs/loop/ARCHITECTURE.md`
- **Guía completa:** `docs/loop/README.md`

---

**Versión:** 1.0  
**Estado:** ✅ Operacional
