# 🧹 Guía de Ejecución: Limpieza PR 812 y PR 805

## 📋 Resumen del Problema

- **PR 812** (Issue 800 - RLS tests) contiene código de Issue 774 (logBackup tests)
- **PR 805** (Issue 774 - Pending tests) contiene código de Issue 800 (RLS tests)

## 🎯 Objetivo

Separar completamente el contenido para que cada PR tenga SOLO su código correspondiente.

## ⚡ Opción 1: Script Automático (RECOMENDADO)

```bash
# Dar permisos de ejecución
chmod +x scripts/cleanup-pr-812-805.sh

# Ejecutar script
./scripts/cleanup-pr-812-805.sh

# El script hará:
# 1. Backup de ambas ramas
# 2. Limpieza de rama 800 (reset a commit limpio)
# 3. Limpieza de rama 774 (eliminar archivos RLS)
# 4. Verificación de ambas ramas
# 5. Te dirá cómo hacer force push
```

## 🔧 Opción 2: Manual (Paso a Paso)

### Parte A: Limpiar Rama 800 (PR 812)

```bash
# 1. Ir a la rama
git checkout fix/issue-800-multi-tenant-rls-clean

# 2. Crear backup
git branch backup/issue-800-manual

# 3. Ver commits actuales
git log --oneline -5
# Deberías ver:
# c1b95bd0 fix: Resolve merge conflict in multi-tenant.md
# a6650212 fix: Apply CodeRabbit suggestions... (logBackup <- INCORRECTO)
# 897cbd76 test(multi-tenant): Expand RLS integration... <- ESTE ES EL BUENO

# 4. Reset al commit limpio
git reset --hard 897cbd76

# 5. Verificar archivos
git diff origin/main --name-only
# Debe mostrar SOLO archivos RLS:
# - tests/integration/multi-tenant-rls-issue-800.test.js
# - scripts/check-all-rls-tables.js
# - scripts/check-missing-tables.js
# - scripts/identify-untested-tables.js
# - scripts/shared/rls-tables.js
# - docs/test-evidence/issue-800/...

# 6. Force push
git push origin fix/issue-800-multi-tenant-rls-clean --force-with-lease
```

### Parte B: Limpiar Rama 774 (PR 805)

```bash
# 1. Ir a la rama
git checkout fix/issue-774-pending-tests

# 2. Crear backup
git branch backup/issue-774-manual

# 3. Ver archivos actuales
git diff origin/main --name-only

# 4. Eliminar archivos de issue 800
git rm tests/integration/multi-tenant-rls-issue-800.test.js
git rm scripts/check-all-rls-tables.js
git rm scripts/check-missing-tables.js
git rm scripts/identify-untested-tables.js
git rm scripts/shared/rls-tables.js
git rm -r docs/test-evidence/issue-800/

# 5. Commit limpieza
git commit -m "chore: Remove issue 800 content from issue 774 branch"

# 6. Verificar archivos finales
git diff origin/main --name-only
# Debe mostrar SOLO:
# - src/services/logBackupService.js
# - tests/unit/services/logBackupService.test.js
# - tests/unit/routes/admin-plan-limits.test.js
# - tests/integration/cli/logCommands.test.js

# 7. Force push
git push origin fix/issue-774-pending-tests --force-with-lease
```

## ✅ Verificación Post-Limpieza

### Verificar PR 812 (Issue 800)

```bash
git checkout fix/issue-800-multi-tenant-rls-clean
git diff origin/main --name-only

# ✅ Debe contener:
#    - Archivos RLS (multi-tenant-rls-issue-800.test.js, scripts RLS, etc.)
# ❌ NO debe contener:
#    - logBackupService.js
#    - logBackupService.test.js
```

### Verificar PR 805 (Issue 774)

```bash
git checkout fix/issue-774-pending-tests
git diff origin/main --name-only

# ✅ Debe contener:
#    - logBackupService.js
#    - logBackupService.test.js
#    - admin-plan-limits.test.js
# ❌ NO debe contener:
#    - multi-tenant-rls-issue-800.test.js
#    - Scripts RLS (check-all-rls-tables.js, etc.)
```

## 🧪 Tests Post-Limpieza

```bash
# Verificar rama 800
git checkout fix/issue-800-multi-tenant-rls-clean
npm test tests/integration/multi-tenant-rls-issue-800.test.js

# Verificar rama 774
git checkout fix/issue-774-pending-tests
npm test tests/unit/services/logBackupService.test.js
npm test tests/unit/routes/admin-plan-limits.test.js
```

## 🚨 Si Algo Sale Mal

### Restaurar desde Backup

```bash
# Restaurar rama 800
git checkout backup/issue-800-manual
git branch -D fix/issue-800-multi-tenant-rls-clean
git checkout -b fix/issue-800-multi-tenant-rls-clean
git push origin fix/issue-800-multi-tenant-rls-clean --force-with-lease

# Restaurar rama 774
git checkout backup/issue-774-manual
git branch -D fix/issue-774-pending-tests
git checkout -b fix/issue-774-pending-tests
git push origin fix/issue-774-pending-tests --force-with-lease
```

## 📝 Checklist Final

- [ ] Rama 800 tiene SOLO contenido RLS
- [ ] Rama 774 tiene SOLO contenido pending tests
- [ ] No hay archivos duplicados entre ramas
- [ ] Tests pasan en rama 800: `npm test tests/integration/multi-tenant-rls-issue-800.test.js`
- [ ] Tests pasan en rama 774: `npm test tests/unit/services/logBackupService.test.js`
- [ ] Force push ejecutado con `--force-with-lease`
- [ ] PRs actualizadas en GitHub
- [ ] Backups creados y disponibles

## 🔗 Referencias

- Plan detallado: `docs/plan/cleanup-pr-812-805.md`
- Script automático: `scripts/cleanup-pr-812-805.sh`
- PR 812: https://github.com/Eibon7/roastr-ai/pull/812
- PR 805: https://github.com/Eibon7/roastr-ai/pull/805

## 💡 Notas

- Usar `--force-with-lease` en lugar de `--force` para evitar sobrescribir trabajo de otros
- Los backups se crean automáticamente antes de cualquier operación destructiva
- Cada rama debe pasar sus tests antes del force push
- Verificar en GitHub que las PRs se actualizaron correctamente después del push


