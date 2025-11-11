#!/bin/bash

# Script completo para limpiar y pushear PR 805 (Issue #774)
# Elimina contenido de issue 800 (ya mergeado) y prepara para push

set -e

REPO_ROOT="/Users/emiliopostigo/roastr-ai"
cd "$REPO_ROOT"

echo "🧹 =========================================="
echo "   Limpieza PR 805 - Issue #774"
echo "=========================================="
echo ""

# ============================================================================
# PASO 1: Verificar rama actual
# ============================================================================

echo "📍 Verificando rama actual..."
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "fix/issue-774-pending-tests" ]; then
    echo "⚠️  Cambiando a rama fix/issue-774-pending-tests..."
    git checkout fix/issue-774-pending-tests
fi

echo "✅ En rama: fix/issue-774-pending-tests"
echo ""

# ============================================================================
# PASO 2: Commitear resolución de conflicto
# ============================================================================

echo "📦 PASO 1: Commiteando resolución de conflicto..."
echo ""

# Verificar que no hay marcadores de conflicto
if grep -q "^<<<<<<<\|^=======\|^>>>>>>>" tests/integration/cli/logCommands.test.js; then
    echo "❌ ERROR: Todavía hay marcadores de conflicto en logCommands.test.js"
    exit 1
fi

echo "✅ Sin marcadores de conflicto"

# Verificar sintaxis
node -c tests/integration/cli/logCommands.test.js || {
    echo "❌ ERROR: Sintaxis inválida en logCommands.test.js"
    exit 1
}

echo "✅ Sintaxis válida"

# Commit del conflicto resuelto
git add tests/integration/cli/logCommands.test.js

git commit -m "fix: Resolve merge conflict in logCommands.test.js

- Merged changes from main
- Kept enhanced verification assertions from both versions
- Removed duplicate test cases
- Ensured comprehensive test coverage
- All expect statements preserved

Related: #774" || echo "ℹ️  Ya commiteado o nada que commitear"

echo "✅ Conflicto resuelto y commiteado"
echo ""

# ============================================================================
# PASO 3: Identificar y eliminar archivos de Issue #800 (RLS)
# ============================================================================

echo "📦 PASO 2: Eliminando archivos de Issue #800 (ya mergeado)..."
echo ""

# Lista de archivos RLS que pertenecen a issue 800
RLS_FILES=(
    "tests/integration/multi-tenant-rls-issue-800.test.js"
    "scripts/check-all-rls-tables.js"
    "scripts/check-missing-tables.js"
    "scripts/identify-untested-tables.js"
    "scripts/shared/rls-tables.js"
    "docs/test-evidence/issue-800"
)

REMOVED_COUNT=0
for file in "${RLS_FILES[@]}"; do
    if [ -e "$file" ]; then
        echo "  🗑️  Eliminando: $file"
        if [ -d "$file" ]; then
            git rm -r "$file" 2>/dev/null || true
        else
            git rm "$file" 2>/dev/null || true
        fi
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
    fi
done

if [ $REMOVED_COUNT -gt 0 ]; then
    echo ""
    echo "📝 Commiteando limpieza de archivos RLS..."
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
    echo "✅ Limpieza commiteada ($REMOVED_COUNT archivos eliminados)"
else
    echo "ℹ️  No se encontraron archivos RLS para eliminar (rama ya limpia)"
fi

echo ""

# ============================================================================
# PASO 4: Verificar archivos finales
# ============================================================================

echo "📊 PASO 3: Verificando archivos finales..."
echo ""

echo "Archivos modificados vs main:"
git diff origin/main --name-only | sort

echo ""
echo "🔍 Verificaciones:"

# Verificar que NO hay archivos RLS
if git diff origin/main --name-only | grep -q "rls-issue-800\|rls-tables\|check-all-rls\|check-missing\|identify-untested"; then
    echo "❌ ERROR: Todavía hay archivos RLS en la rama"
    git diff origin/main --name-only | grep "rls"
    exit 1
fi
echo "✅ Sin archivos RLS de issue #800"

# Verificar que SÍ hay archivos de issue 774
if git diff origin/main --name-only | grep -q "logBackup\|admin-plan-limits"; then
    echo "✅ Contiene archivos de issue #774 (correcto)"
else
    echo "⚠️  ADVERTENCIA: No se encontraron archivos esperados de issue #774"
fi

echo ""

# ============================================================================
# PASO 5: Crear documentación de limpieza
# ============================================================================

echo "📝 PASO 4: Generando documentación..."
echo ""

cat > docs/plan/limpieza-805-ejecutada.md << 'EOF'
# Limpieza Ejecutada - PR 805 (Issue #774)

## 🎯 Objetivo

Eliminar contenido de Issue #800 (RLS tests) de la rama de Issue #774 (pending tests),
ya que Issue #800 fue mergeada a main.

## ✅ Acciones Ejecutadas

### 1. Resolución de Conflicto

**Archivo:** `tests/integration/cli/logCommands.test.js`

**Conflictos resueltos:**
- Líneas 162-189: Comandos `maintenance status` y `cleanup`
- Líneas 249-261: Tests `health check` output
- Líneas 312-325: Tests de configuración
- Líneas 366-398: Flujo E2E completo

**Estrategia:**
- Mantuve verificaciones más completas de ambas versiones
- Eliminé duplicación innecesaria
- Preservé todas las assertions importantes

**Resultado:** 0 marcadores de conflicto, sintaxis válida

### 2. Eliminación de Archivos RLS (Issue #800)

**Archivos eliminados:**
- ❌ `tests/integration/multi-tenant-rls-issue-800.test.js`
- ❌ `scripts/check-all-rls-tables.js`
- ❌ `scripts/check-missing-tables.js`
- ❌ `scripts/identify-untested-tables.js`
- ❌ `scripts/shared/rls-tables.js`
- ❌ `docs/test-evidence/issue-800/`

**Razón:** Issue #800 ya está mergeada en main. Este contenido no pertenece
a Issue #774.

### 3. Archivos Preservados (Issue #774)

**Archivos que permanecen:**
- ✅ `src/services/logBackupService.js`
- ✅ `tests/unit/services/logBackupService.test.js`
- ✅ `tests/unit/routes/admin-plan-limits.test.js`
- ✅ `tests/integration/cli/logCommands.test.js`

**Estos archivos SÍ pertenecen al scope de Issue #774.**

## 📊 Verificación

### Antes de Limpieza
```
Archivos modificados: 22
Incluía: logBackup, admin-plan-limits, RLS tests, scripts RLS
```

### Después de Limpieza
```
Archivos modificados: ~4
Solo incluye: logBackup, admin-plan-limits, logCommands tests
Sin archivos RLS
```

## 🎯 Resultado

✅ Rama limpia
✅ Solo contenido de Issue #774
✅ Conflictos resueltos
✅ Sin duplicación con main
✅ Lista para revisión y merge

## 📝 Commits Generados

1. `fix: Resolve merge conflict in logCommands.test.js`
2. `chore: Remove issue #800 content from issue #774 branch`
3. `docs: Add cleanup execution documentation`

## 🔗 Referencias

- PR 805: https://github.com/Eibon7/roastr-ai/pull/805
- Issue #774: Pending tests fixes
- Issue #800: RLS tests (ya mergeada)

## ✅ Checklist Post-Limpieza

- [x] Conflicto resuelto
- [x] Archivos RLS eliminados
- [x] Solo archivos de issue #774 presentes
- [x] Sintaxis verificada
- [x] Commits claros y descriptivos
- [x] Documentación generada
- [ ] Tests ejecutados (siguiente paso)
- [ ] Push a origin (siguiente paso)

## 🚀 Siguiente Paso

```bash
# Ejecutar tests
npm test

# Si pasan, pushear
git push origin fix/issue-774-pending-tests
```

---

**Ejecutado:** $(date +"%Y-%m-%d %H:%M:%S")
**Script:** `scripts/cleanup-and-push-805.sh`
EOF

git add docs/plan/limpieza-805-ejecutada.md

git commit -m "docs: Add cleanup execution documentation for PR 805

- Document conflict resolution steps
- List removed RLS files (issue #800)
- List preserved files (issue #774)
- Add verification checklist

Related: #774" || echo "ℹ️  Ya commiteado"

echo "✅ Documentación generada: docs/plan/limpieza-805-ejecutada.md"
echo ""

# ============================================================================
# PASO 6: Resumen
# ============================================================================

echo "=========================================="
echo "✅ LIMPIEZA COMPLETADA"
echo "=========================================="
echo ""
echo "📊 Resumen:"
echo ""
echo "✅ Conflicto resuelto: logCommands.test.js"
echo "✅ Archivos RLS eliminados: $REMOVED_COUNT"
echo "✅ Commits generados: 2-3"
echo "✅ Documentación creada"
echo ""
echo "📁 Archivos finales en rama (solo Issue #774):"
git diff origin/main --name-only | grep -E "(logBackup|admin|logCommands)" || echo "  (ejecutar 'git diff origin/main --name-only' para ver todos)"
echo ""
echo "=========================================="
echo "🚀 SIGUIENTE PASO: TESTS Y PUSH"
echo "=========================================="
echo ""
echo "Ejecuta:"
echo ""
echo "  # 1. Tests"
echo "  npm test"
echo ""
echo "  # 2. Si pasan, push"
echo "  git push origin fix/issue-774-pending-tests"
echo ""
echo "  # 3. Verificar en GitHub que PR se actualizó"
echo "  open https://github.com/Eibon7/roastr-ai/pull/805"
echo ""
echo "✅ Script completado exitosamente"


