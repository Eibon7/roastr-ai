# Plan de Limpieza - PR 812 (Issue 800) y PR 805 (Issue 774)

## 🎯 Problema Identificado

Ambas ramas tienen contenido mezclado:

### PR 812 - rama `fix/issue-800-multi-tenant-rls-clean` (Issue 800: RLS tests)
**Contenido CORRECTO (debe quedarse):**
- ✅ `tests/integration/multi-tenant-rls-issue-800.test.js`
- ✅ `scripts/check-all-rls-tables.js`
- ✅ `scripts/check-missing-tables.js`
- ✅ `scripts/identify-untested-tables.js`
- ✅ `scripts/shared/rls-tables.js`
- ✅ `docs/test-evidence/issue-800/`

**Contenido INCORRECTO (debe eliminarse):**
- ❌ `src/services/logBackupService.js` (commit a6650212)
- ❌ `tests/unit/services/logBackupService.test.js` (commit a6650212)
- ❌ Merge conflict resolution en multi-tenant.md (commit c1b95bd0)

### PR 805 - rama `fix/issue-774-pending-tests` (Issue 774: Pending tests)
**Contenido CORRECTO (debe quedarse):**
- ✅ `src/services/logBackupService.js` (commit 87a569d9 - versión completa)
- ✅ `tests/unit/services/logBackupService.test.js` (commit 87a569d9)
- ✅ `tests/unit/routes/admin-plan-limits.test.js` (commit 87a569d9)
- ✅ `tests/integration/cli/logCommands.test.js`

**Contenido INCORRECTO (debe eliminarse):**
- ❌ `tests/integration/multi-tenant-rls-issue-800.test.js`
- ❌ `scripts/check-all-rls-tables.js`
- ❌ `scripts/check-missing-tables.js`
- ❌ `scripts/identify-untested-tables.js`
- ❌ `scripts/shared/rls-tables.js`
- ❌ `docs/test-evidence/issue-800/`

## 🔧 Plan de Ejecución

### PASO 1: Limpiar rama fix/issue-800-multi-tenant-rls-clean (PR 812)

```bash
# 1. Checkout a rama 800
git checkout fix/issue-800-multi-tenant-rls-clean

# 2. Backup
git branch backup/issue-800-$(date +%Y%m%d-%H%M%S)

# 3. Ver qué commit es el bueno (897cbd76)
git log --oneline -5

# 4. Reset hard al commit bueno (antes de los commits incorrectos)
git reset --hard 897cbd76

# 5. Verificar que solo tiene contenido de RLS
git diff origin/main --name-only

# 6. Force push
git push origin fix/issue-800-multi-tenant-rls-clean --force-with-lease
```

### PASO 2: Limpiar rama fix/issue-774-pending-tests (PR 805)

```bash
# 1. Checkout a rama 774
git checkout fix/issue-774-pending-tests

# 2. Backup
git branch backup/issue-774-$(date +%Y%m%d-%H%M%S)

# 3. Ver archivos modificados vs main
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

# 6. Verificar que solo quedan archivos de issue 774
git diff origin/main --name-only

# 7. Push
git push origin fix/issue-774-pending-tests --force-with-lease
```

### PASO 3: Verificación Final

**Para rama 800:**
```bash
git checkout fix/issue-800-multi-tenant-rls-clean
git diff origin/main --name-only

# Debe mostrar SOLO:
# - tests/integration/multi-tenant-rls-issue-800.test.js
# - scripts/check-all-rls-tables.js
# - scripts/check-missing-tables.js
# - scripts/identify-untested-tables.js
# - scripts/shared/rls-tables.js
# - docs/test-evidence/issue-800/summary.md
# - docs/test-evidence/issue-800/test-output.txt

# NO debe incluir:
# - src/services/logBackupService.js
# - tests/unit/services/logBackupService.test.js
```

**Para rama 774:**
```bash
git checkout fix/issue-774-pending-tests
git diff origin/main --name-only

# Debe mostrar SOLO:
# - src/services/logBackupService.js
# - tests/unit/services/logBackupService.test.js
# - tests/unit/routes/admin-plan-limits.test.js
# - tests/integration/cli/logCommands.test.js (si es parte del scope)

# NO debe incluir:
# - tests/integration/multi-tenant-rls-issue-800.test.js
# - scripts/check-all-rls-tables.js (ni otros scripts RLS)
# - docs/test-evidence/issue-800/
```

## 📊 Comparación de Código - logBackupService

### Commit 87a569d9 (rama 774) ✅ MEJOR
- 3 archivos modificados
- 145 insertions, 44 deletions
- Incluye fixes para:
  - logBackupService.js
  - logBackupService.test.js
  - admin-plan-limits.test.js
- **Más completo y alineado con scope de issue 774**

### Commit a6650212 (rama 800) ❌ INCOMPLETO
- 2 archivos modificados
- 50 insertions, 20 deletions
- Solo logBackupService y su test
- **Incompleto, NO incluye admin-plan-limits**

**Decisión:** Usar código de commit 87a569d9 (ya está en rama 774)

## 🔗 Referencias

- PR 812: https://github.com/Eibon7/roastr-ai/pull/812 (Issue 800)
- PR 805: https://github.com/Eibon7/roastr-ai/pull/805 (Issue 774)
- Commit bueno issue 800: 897cbd76
- Commit bueno issue 774: 87a569d9

## ✅ Checklist Post-Limpieza

- [ ] PR 812 tiene SOLO contenido de issue 800 (RLS tests)
- [ ] PR 805 tiene SOLO contenido de issue 774 (pending tests)
- [ ] No hay código duplicado entre ramas
- [ ] Cada rama compila y tests pasan
- [ ] Force push ejecutado con --force-with-lease
- [ ] PRs actualizadas en GitHub
- [ ] Documentación actualizada


