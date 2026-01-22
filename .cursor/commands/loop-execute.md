---
description: "Ejecuta una tarea usando el Loop Autónomo Supervisado con validación V2-only y rollback automático"
tags: ["loop", "autonomous", "v2-only", "execution"]
---

# Loop: Ejecutar Tarea

Ejecuta una tarea usando el Loop Autónomo Supervisado v1 con:
- ✅ Validación V2-only (pre-task y post-task)
- ✅ Rollback automático si violaciones detectadas
- ✅ Progress tracking completo
- ✅ Git safety (stash + commit)

## Uso Básico

```bash
node scripts/loop/execute-task.js \
  --task-id="task-001" \
  --description="Descripción de la tarea" \
  --instruction="comando a ejecutar"
```

## Opciones

| Opción | Descripción | Requerido |
|--------|-------------|-----------|
| `--task-id` | ID único de la tarea | ✅ |
| `--description` | Descripción de la tarea | ✅ |
| `--instruction` | Comando shell a ejecutar | ✅ |
| `--prd` | Path al PRD (opcional) | ❌ |
| `--dry-run` | Solo validar, no ejecutar | ❌ |
| `--timeout` | Timeout en ms (default: 600000) | ❌ |

## Ejemplos

### Dry-run (Solo validar)

```bash
node scripts/loop/execute-task.js \
  --task-id="test-validation" \
  --dry-run
```

### Crear archivo V2

```bash
node scripts/loop/execute-task.js \
  --task-id="create-roast-endpoint" \
  --description="Crear endpoint POST /api/v2/roast" \
  --instruction="touch apps/backend-v2/src/routes/roast.ts"
```

### Con PRD

```bash
node scripts/loop/execute-task.js \
  --task-id="roast-v2-ac1" \
  --description="Implementar AC1 del PRD Roast V2" \
  --prd="docs/prd/example-roast-v2-endpoint.md" \
  --instruction="mkdir -p apps/backend-v2/src/routes && touch apps/backend-v2/src/routes/roast.ts"
```

### Ejecutar script

```bash
node scripts/loop/execute-task.js \
  --task-id="generate-tests" \
  --description="Generar tests para roast endpoint" \
  --instruction="node scripts/generate-tests.js --file=apps/backend-v2/src/routes/roast.ts"
```

## Flujo de Ejecución

```
1. Pre-Task Validation (V2-only gate)
   └─> Si BLOCK → STOP (no ejecuta)
   └─> Si PASS → Continuar

2. Stash cambios previos (preservar working directory)

3. Ejecutar instrucción

4. Crear commit temporal

5. Post-Task Validation (V2-only gate)
   └─> Si BLOCK → Rollback automático
   └─> Si PASS → Commit final

6. Restaurar stash

7. Actualizar progress tracking
```

## Progress Tracking

Después de ejecutar, ver progreso:

```bash
# Ver estado completo
cat docs/autonomous-progress/<task-id>/progress.json | jq

# Ver decisiones
cat docs/autonomous-progress/<task-id>/decisions.jsonl | jq -s

# Ver violaciones (si las hay)
cat docs/autonomous-progress/<task-id>/violations.jsonl | jq -s
```

## Garantías

✅ **V2-Only Enforcement** - Bloquea cualquier acceso a legacy V1  
✅ **Rollback Automático** - Si violaciones, cambios se revierten  
✅ **Git Safety** - Working directory siempre limpio  
✅ **Progress Tracking** - Todas las decisiones registradas  
✅ **No Residuos** - Stash + commit manejados automáticamente

## Troubleshooting

### "Pre-task validation FAILED"

**Causa:** Violaciones V2-only detectadas ANTES de ejecutar.

**Solución:** 
1. Ver violaciones: `cat docs/autonomous-progress/<task-id>/violations.jsonl`
2. Arreglar violaciones (remover archivos legacy modificados)
3. Re-ejecutar

### "Post-task validation FAILED - Rollback aplicado"

**Causa:** La tarea creó/modificó archivos legacy V1.

**Solución:**
1. Ver violaciones: `cat docs/autonomous-progress/<task-id>/violations.jsonl`
2. Modificar instrucción para usar artefactos V2
3. Re-ejecutar

### "Working directory not clean"

**Causa:** Cambios no commiteados antes de ejecutar Loop.

**Solución:**
```bash
git status
git add .
git commit -m "WIP: Cambios previos"
# Re-ejecutar Loop
```

## Referencias

- **Arquitectura:** `docs/loop/ARCHITECTURE.md`
- **Guía completa:** `docs/loop/README.md`
- **Issue:** ROA-539

---

**Versión:** 1.0  
**Estado:** ✅ Operacional
