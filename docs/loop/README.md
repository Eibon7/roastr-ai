# Loop Autónomo Supervisado - Roastr.AI

**Sistema de desarrollo autónomo con supervisión y validación V2-only.**

## 📋 Overview

El Loop Autónomo Supervisado es un sistema que permite a Cursor ejecutar tareas de desarrollo de forma autónoma dentro de guardrails definidos, usando gates V2-only como prerequisito obligatorio para prevenir contaminación de código legacy.

**Estado:** ✅ v1 Operacional  
**Issue:** ROA-539  
**Fecha:** 2026-01-22

## 🎯 Características

### ✅ Implementado (v1)

- **Pre-task Gate:** Validación V2-only ANTES de ejecutar tarea
- **Post-task Gate:** Validación V2-only DESPUÉS de ejecutar tarea
- **Rollback Automático:** Revertir cambios si violaciones post-task
- **Progress Tracking:** Tracking completo de progreso en `docs/autonomous-progress/`
- **Decision Logging:** Log append-only de decisiones
- **Violation Logging:** Log append-only de violaciones (si las hay)
- **Git Safety:** Stash/commit/revert automático

### 🔮 Planeado (v2)

- Ejecución paralela de subtareas independientes
- Integración con PRDs (`docs/prd/`)
- Auto-fix de violaciones no críticas
- Integración con CodeRabbit
- Dashboard web para visualización

## 🏗️ Arquitectura

```text
┌─────────────────────────────────────────────────────────────┐
│                  LOOP AUTÓNOMO SUPERVISADO                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐      │
│  │ PRE-TASK   │────▶│ EXECUTION  │────▶│ POST-TASK  │      │
│  │ VALIDATION │     │   ENGINE   │     │ VALIDATION │      │
│  └────────────┘     └────────────┘     └────────────┘      │
│       │                    │                   │             │
│       ▼                    ▼                   ▼             │
│  ┌─────────────────────────────────────────────────┐        │
│  │         V2-ONLY GATE (ROA-538)                  │        │
│  │  ✓ Bloquea legacy V1                            │        │
│  │  ✓ Valida artefactos V2                         │        │
│  │  ✓ BLOCK inmediato si violación                 │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │         PROGRESS TRACKING                        │        │
│  │  • Task status (pending/in-progress/complete)    │        │
│  │  • Decision log (continue/block/escalate)        │        │
│  │  • Metrics (tiempo, violaciones, rollbacks)      │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Uso

### Instalación

No requiere instalación. Scripts están en `scripts/loop/`.

### Comandos

#### Dry-run (solo validar)

```bash
node scripts/loop/execute-task.js \
  --task-id="test" \
  --dry-run
```

#### Ejecutar tarea simple

```bash
node scripts/loop/execute-task.js \
  --task-id="task-001" \
  --description="Crear endpoint roast" \
  --instruction="touch apps/backend-v2/src/routes/roast.ts"
```

#### Ejecutar tarea compleja

```bash
node scripts/loop/execute-task.js \
  --task-id="task-002" \
  --description="Implementar lógica de roasting" \
  --instruction="cat > apps/backend-v2/src/services/roasting.ts <<EOF
export function generateRoast(comment: string): string {
  return 'roasted: ' + comment;
}
EOF"
```

#### Ejecutar desde PRD (v2, futuro)

```bash
node scripts/loop/execute-task.js \
  --task-id="roast-v2-ac1" \
  --prd="docs/prd/feature-roast-v2.md" \
  --instruction="..."
```

### Opciones

| Opción | Descripción | Requerido |
|--------|-------------|-----------|
| `--task-id=<id>` | ID único de la tarea | ✅ Sí |
| `--instruction=<cmd>` | Comando a ejecutar | ✅ Sí (excepto dry-run) |
| `--description=<text>` | Descripción legible | ❌ No |
| `--prd=<path>` | Path al PRD | ❌ No (v2) |
| `--dry-run` | Solo validar, no ejecutar | ❌ No |
| `--timeout=<ms>` | Timeout en ms (default: 600000) | ❌ No |

## 📊 Progress Tracking

Cada tarea tiene su directorio en `docs/autonomous-progress/<task-id>/`:

```
docs/autonomous-progress/
├── task-001/
│   ├── progress.json           # Estado actual
│   ├── decisions.jsonl         # Log de decisiones
│   ├── violations.jsonl        # Log de violaciones (si las hay)
│   └── artifacts/              # Archivos generados
│       ├── rollback-state.json
│       └── rollback-log.txt
└── README.md
```

### Ver progreso

```bash
# Ver estado de tarea
cat docs/autonomous-progress/task-001/progress.json | jq

# Ver decisiones
cat docs/autonomous-progress/task-001/decisions.jsonl

# Ver violaciones (si las hay)
cat docs/autonomous-progress/task-001/violations.jsonl

# Ver métricas
jq '.metrics' docs/autonomous-progress/task-001/progress.json
```

## 🔒 V2-Only Enforcement

El Loop **NUNCA** permite acceso activo (modificación/import) a artefactos legacy V1.

### Fuentes Permitidas (V2 ONLY)

✅ `docs/SSOT-V2.md`, `docs/nodes-v2/`, `docs/system-map-v2.yaml`  
✅ `apps/backend-v2/`, `apps/frontend-v2/`, `apps/shared/`  
✅ `scripts/loop/`, `scripts/ci/`

### Fuentes Prohibidas (LEGACY V1)

❌ `docs/legacy/`, `docs/nodes/`, `spec.md`, `docs/system-map.yaml`  
❌ `src/` (Backend V1), `frontend/` (Frontend V1)  
❌ Workers legacy: `GenerateReplyWorker`, `PublisherWorker`, `BillingWorker`  
❌ IDs legacy: `roast`, `shield`, `free`, `basic`, `creator_plus`

**Lectura pasiva:** ✅ Permitida (inspección sin modificar)  
**Acceso activo:** ❌ Bloqueado (BLOCK inmediato)

Ver: `.cursor/rules/v2-only-strict.mdc`, `docs/plan/issue-ROA-538.md`

## 🛡️ Rollback Automático

Si el Loop detecta violaciones V2-only después de ejecutar tarea:

1. **Revert commit temporal** - Elimina cambios
2. **Restaurar stash original** - Vuelve al estado previo
3. **Log detallado** - Guarda en `artifacts/rollback-log.txt`

```bash
# Ver log de rollback
cat docs/autonomous-progress/task-001/artifacts/rollback-log.txt
```

## 📝 Ejemplos

### Ejemplo 1: Tarea exitosa (sin violaciones)

```bash
$ node scripts/loop/execute-task.js \
  --task-id="create-service" \
  --description="Crear roasting service" \
  --instruction="touch apps/backend-v2/src/services/roasting.ts"

✅ Pre-task validation PASSED
✅ Tarea ejecutada
✅ Post-task validation PASSED
✅ TAREA COMPLETADA EXITOSAMENTE
```

### Ejemplo 2: Tarea con violaciones (rollback aplicado)

```bash
$ node scripts/loop/execute-task.js \
  --task-id="violate-v2" \
  --description="Intentar usar legacy" \
  --instruction="touch docs/legacy/test.md"

✅ Pre-task validation PASSED
✅ Tarea ejecutada
❌ Post-task validation FAILED
🚨 Violaciones detectadas - Iniciando rollback...
✅ Rollback completado exitosamente
❌ TAREA FALLIDA (violaciones detectadas + rollback aplicado)
```

### Ejemplo 3: Dry-run

```bash
$ node scripts/loop/execute-task.js \
  --task-id="test" \
  --dry-run

✅ Pre-task validation PASSED
🏁 Dry-run completado (validación exitosa, no se ejecutó tarea)
```

## 🔧 Troubleshooting

### Error: "Pre-task validation FAILED"

**Causa:** Hay violaciones V2-only ANTES de ejecutar tarea.

**Solución:**

1. Ver violaciones: `cat docs/autonomous-progress/<task-id>/violations.jsonl`
2. Resolver violaciones manualmente
3. Re-ejecutar tarea

### Error: "Post-task validation FAILED + rollback"

**Causa:** La tarea introdujo violaciones V2-only.

**Solución:**

1. Ver violaciones: `cat docs/autonomous-progress/<task-id>/violations.jsonl`
2. Ajustar instrucción para NO usar artefactos legacy
3. Re-ejecutar tarea

### Error: "Rollback failed"

**Causa:** Git no pudo revertir cambios (conflictos, detached HEAD, etc.).

**Solución:**

1. Ver log de rollback: `cat docs/autonomous-progress/<task-id>/artifacts/rollback-log.txt`
2. Resolver manualmente:
   ```bash
   git status
   git reset --hard <original-commit>
   git stash pop
   ```

### Warning: "Stash left intact"

**Causa:** Conflictos al restaurar stash original.

**Solución:**

1. Resolver conflictos manualmente:
   ```bash
   git stash list
   git stash show stash@{0}
   git stash pop
   # Resolver conflictos
   git add -A
   ```

## 📚 Referencias

### Scripts

- **Execution Engine:** `scripts/loop/execute-task.js`
- **Pre-task Gate:** `scripts/loop/pre-task.js`
- **Post-task Gate:** `scripts/loop/post-task.js`
- **Validador V2-only:** `scripts/loop/validators/v2-only.js`
- **Rollback Manager:** `scripts/loop/lib/rollback.js`
- **Git Utils:** `scripts/loop/lib/git-utils.js`

### Documentación

- **Plan de Issue:** `docs/plan/issue-ROA-539.md`
- **Blindaje V2-only:** `docs/plan/issue-ROA-538.md`
- **Progress Tracking:** `docs/autonomous-progress/README.md`
- **Cursor Rules:** `.cursor/rules/v2-only-strict.mdc`

### Issues

- **ROA-538:** Blindaje V2-only (prerequisito) ✅
- **ROA-539:** Loop Autónomo Supervisado v1 🚧

## 🎯 Roadmap

### v1 ✅ Completado

- [x] Pre-task y post-task gates V2-only
- [x] Execution engine con rollback automático
- [x] Progress tracking completo
- [x] Decision y violation logging
- [x] Git safety (stash/commit/revert)

### v2 🔮 Planeado

- [ ] Integración con PRDs
- [ ] Parser y generador de subtareas desde ACs
- [ ] Ejecución paralela de subtareas
- [ ] Auto-fix de violaciones no críticas
- [ ] Dashboard web para visualización
- [ ] Integración con Linear (auto-actualizar issues)
- [ ] Integración con CodeRabbit (auto-fix)

### v3 🚀 Futuro

- [ ] Deployment automático a staging
- [ ] Auto-merge de PRs si criterios se cumplen
- [ ] Generación automática completa (sin supervisión)
- [ ] AI-powered code review

---

**Issue:** ROA-539  
**Versión:** 1.0  
**Estado:** ✅ v1 Operacional  
**Última actualización:** 2026-01-22
