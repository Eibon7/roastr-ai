# ⚡ EJECUTAR AHORA - PR 805

## 🚨 Problema con Shell Automático

El shell automático no está respondiendo. Necesitas ejecutar estos comandos **MANUALMENTE** en tu terminal.

## 📋 COMANDOS PARA EJECUTAR (Copy/Paste)

### ✅ PASO 1: Commitear Conflicto Resuelto

```bash
cd /Users/emiliopostigo/roastr-ai

git add tests/integration/cli/logCommands.test.js

git commit -m "fix: Resolve merge conflict in logCommands.test.js

- Merged changes from main
- Kept enhanced verification assertions from both versions
- Removed duplicate test cases
- Ensured comprehensive test coverage
- All expect statements preserved

Related: #774"
```

### ✅ PASO 2: Eliminar Archivos RLS (Issue #800)

```bash
git rm -f tests/integration/multi-tenant-rls-issue-800.test.js
git rm -f scripts/check-all-rls-tables.js
git rm -f scripts/check-missing-tables.js
git rm -f scripts/identify-untested-tables.js
git rm -f scripts/shared/rls-tables.js
git rm -rf docs/test-evidence/issue-800
```

### ✅ PASO 3: Commitear Limpieza

```bash
git commit -m "chore: Remove issue #800 content from issue #774 branch

Issue #800 has been merged to main. Removing RLS-related files that
do not belong to issue #774 scope.

Removed files:
- tests/integration/multi-tenant-rls-issue-800.test.js
- scripts/check-all-rls-tables.js
- scripts/check-missing-tables.js
- scripts/identify-untested-tables.js
- scripts/shared/rls-tables.js
- docs/test-evidence/issue-800/

Issue #774 scope (preserved):
- src/services/logBackupService.js
- tests/unit/services/logBackupService.test.js
- tests/unit/routes/admin-plan-limits.test.js
- tests/integration/cli/logCommands.test.js

Related: #774, #800"
```

### ✅ PASO 4: Añadir Documentación

```bash
git add docs/plan/limpieza-805-ejecutada.md
git add RESUMEN-LIMPIEZA-805.md
git add EJECUTAR-LIMPIEZA-805.md
git add EJECUTAR-AHORA-805.md
git add COMANDOS-MANUALES-805.sh
git add scripts/cleanup-and-push-805.sh

git commit -m "docs: Add cleanup execution documentation for PR 805

- Document conflict resolution steps
- List removed RLS files (issue #800)
- List preserved files (issue #774)
- Add verification checklist
- Add manual execution scripts

Related: #774"
```

### ✅ PASO 5: Verificar

```bash
# Ver archivos modificados vs main
git diff origin/main --name-only

# Debe mostrar SOLO archivos de issue #774:
# - src/services/logBackupService.js
# - tests/unit/services/logBackupService.test.js
# - tests/unit/routes/admin-plan-limits.test.js
# - tests/integration/cli/logCommands.test.js
# + archivos de documentación

# NO debe mostrar:
# - tests/integration/multi-tenant-rls-issue-800.test.js
# - scripts/*rls*.js
```

### ✅ PASO 6: Tests

```bash
npm test
```

### ✅ PASO 7: Push

```bash
# Solo si tests pasan
git push origin fix/issue-774-pending-tests
```

### ✅ PASO 8: Verificar en GitHub

```bash
open https://github.com/Eibon7/roastr-ai/pull/805
```

---

## 📊 Qué Esperar

### Después del PASO 3 (commits):
```
✅ 3 commits nuevos en la rama
✅ Conflicto resuelto
✅ Archivos RLS eliminados
✅ Documentación añadida
```

### Después del PASO 5 (verificación):
```
✅ Solo 4-5 archivos de código de issue #774
✅ Sin archivos RLS
✅ Sin conflictos
```

### Después del PASO 6 (tests):
```
✅ Todos los tests pasando
✅ Sin errores
```

### Después del PASO 7 (push):
```
✅ PR 805 actualizada en GitHub
✅ Conflicto desaparecido
✅ Lista para review y merge
```

---

## ⚠️ Si Algo Falla

### Si "git rm" dice "file not found":
```bash
# Está bien, significa que el archivo ya no existe
# Continúa con el siguiente comando
```

### Si "nothing to commit":
```bash
# Está bien, significa que ya se commiteó antes
# Continúa con el siguiente paso
```

### Si tests fallan:
```bash
# Revisa el error
npm test -- --verbose

# Si es un test específico:
npm test -- tests/unit/services/logBackupService.test.js
```

---

## 🎯 Resumen

**Tiempo estimado:** 2-3 minutos

**Comandos totales:** 7 pasos

**Resultado:** PR limpia, documentada, lista para merge

---

## 📁 Archivos Creados Para Ti

- ✅ `EJECUTAR-AHORA-805.md` - Este archivo (instrucciones rápidas)
- ✅ `RESUMEN-LIMPIEZA-805.md` - Resumen completo
- ✅ `EJECUTAR-LIMPIEZA-805.md` - Guía detallada
- ✅ `COMANDOS-MANUALES-805.sh` - Script bash alternativo
- ✅ `scripts/cleanup-and-push-805.sh` - Script automatizado (para futuro)
- ✅ `docs/plan/limpieza-805-ejecutada.md` - Documentación de limpieza

---

## 🚀 EMPEZAR AHORA

**Abre tu terminal y copia/pega los comandos del PASO 1 arriba ↑**

Luego continúa con PASO 2, PASO 3, etc.

Al final tendrás la PR lista para merge.

---

✅ **TODO PREPARADO - SOLO COPIA Y PEGA LOS COMANDOS EN TU TERMINAL**


