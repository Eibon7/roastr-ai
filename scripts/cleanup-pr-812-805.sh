#!/bin/bash

# Script de limpieza para PR 812 (Issue 800) y PR 805 (Issue 774)
# Separa el contenido mezclado entre ambas ramas

set -e

REPO_ROOT="/Users/emiliopostigo/roastr-ai"
cd "$REPO_ROOT"

echo "🧹 Iniciando limpieza de ramas PR 812 y PR 805..."
echo ""

# ============================================================================
# PASO 1: Limpiar rama fix/issue-800-multi-tenant-rls-clean (PR 812)
# ============================================================================

echo "📦 PASO 1: Limpiando rama fix/issue-800-multi-tenant-rls-clean (Issue 800 - RLS tests)"
echo ""

# Backup
echo "Creando backup..."
git branch backup/issue-800-$(date +%Y%m%d-%H%M%S) fix/issue-800-multi-tenant-rls-clean
echo "✅ Backup creado"
echo ""

# Checkout a la rama
echo "Cambiando a rama fix/issue-800-multi-tenant-rls-clean..."
git checkout fix/issue-800-multi-tenant-rls-clean

echo "Commits actuales en la rama:"
git log --oneline -5
echo ""

# Reset al commit bueno (897cbd76 - solo contenido de RLS)
echo "⚠️  Reset hard a commit 897cbd76 (solo contenido RLS)..."
git reset --hard 897cbd76

echo ""
echo "✅ Rama 800 limpiada. Archivos ahora:"
git diff origin/main --name-only
echo ""

# Verificación
echo "📋 Verificación rama 800:"
if git diff origin/main --name-only | grep -q "logBackup"; then
    echo "❌ ERROR: Todavía contiene archivos de logBackup (issue 774)"
    exit 1
fi
echo "✅ Sin archivos de logBackup"

if git diff origin/main --name-only | grep -q "rls"; then
    echo "✅ Contiene archivos RLS (correcto)"
else
    echo "❌ ERROR: No contiene archivos RLS"
    exit 1
fi

echo ""
echo "✅ Rama fix/issue-800-multi-tenant-rls-clean lista para force push"
echo ""

# ============================================================================
# PASO 2: Limpiar rama fix/issue-774-pending-tests (PR 805)
# ============================================================================

echo "📦 PASO 2: Limpiando rama fix/issue-774-pending-tests (Issue 774 - Pending tests)"
echo ""

# Backup
echo "Creando backup..."
git branch backup/issue-774-$(date +%Y%m%d-%H%M%S) fix/issue-774-pending-tests
echo "✅ Backup creado"
echo ""

# Checkout a la rama
echo "Cambiando a rama fix/issue-774-pending-tests..."
git checkout fix/issue-774-pending-tests

echo "Archivos actuales vs main:"
git diff origin/main --name-only
echo ""

# Identificar archivos de issue 800 que no deberían estar
echo "Eliminando archivos de issue 800..."

# Lista de archivos a eliminar (issue 800)
FILES_TO_REMOVE=(
    "tests/integration/multi-tenant-rls-issue-800.test.js"
    "scripts/check-all-rls-tables.js"
    "scripts/check-missing-tables.js"
    "scripts/identify-untested-tables.js"
    "scripts/shared/rls-tables.js"
    "docs/test-evidence/issue-800"
)

REMOVED_COUNT=0
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -e "$file" ]; then
        echo "  - Eliminando: $file"
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
    echo "Commiteando limpieza..."
    git commit -m "chore: Remove issue 800 content from issue 774 branch

- Remove RLS test files (belong to issue 800)
- Remove RLS utility scripts
- Keep only logBackup and admin-plan-limits test fixes
- Ensure no duplicate content between PRs"
    echo "✅ Limpieza commiteada"
else
    echo "ℹ️  No se encontraron archivos de issue 800 para eliminar"
fi

echo ""
echo "✅ Rama 774 limpiada. Archivos ahora:"
git diff origin/main --name-only
echo ""

# Verificación
echo "📋 Verificación rama 774:"
if git diff origin/main --name-only | grep -q "rls-issue-800"; then
    echo "❌ ERROR: Todavía contiene archivos RLS de issue 800"
    exit 1
fi
echo "✅ Sin archivos RLS de issue 800"

if git diff origin/main --name-only | grep -q "logBackup"; then
    echo "✅ Contiene archivos logBackup (correcto)"
else
    echo "⚠️  ADVERTENCIA: No contiene archivos logBackup"
fi

echo ""
echo "✅ Rama fix/issue-774-pending-tests lista para force push"
echo ""

# ============================================================================
# PASO 3: Resumen y siguiente acción
# ============================================================================

echo "======================================================================"
echo "✅ LIMPIEZA COMPLETADA"
echo "======================================================================"
echo ""
echo "📊 Resumen:"
echo ""
echo "Rama fix/issue-800-multi-tenant-rls-clean (PR 812):"
echo "  - Reset a commit 897cbd76"
echo "  - Contiene SOLO archivos RLS"
echo "  - Backup: backup/issue-800-*"
echo ""
echo "Rama fix/issue-774-pending-tests (PR 805):"
echo "  - Archivos RLS eliminados"
echo "  - Contiene SOLO archivos de pending tests"
echo "  - Backup: backup/issue-774-*"
echo ""
echo "======================================================================"
echo "⚠️  SIGUIENTE PASO: FORCE PUSH"
echo "======================================================================"
echo ""
echo "Para completar la limpieza, ejecuta:"
echo ""
echo "  # Push rama 800"
echo "  git checkout fix/issue-800-multi-tenant-rls-clean"
echo "  git push origin fix/issue-800-multi-tenant-rls-clean --force-with-lease"
echo ""
echo "  # Push rama 774"
echo "  git checkout fix/issue-774-pending-tests"
echo "  git push origin fix/issue-774-pending-tests --force-with-lease"
echo ""
echo "🔍 Para revisar cambios antes de push:"
echo ""
echo "  # Ver rama 800"
echo "  git checkout fix/issue-800-multi-tenant-rls-clean"
echo "  git diff origin/fix/issue-800-multi-tenant-rls-clean"
echo ""
echo "  # Ver rama 774"
echo "  git checkout fix/issue-774-pending-tests"
echo "  git diff origin/fix/issue-774-pending-tests"
echo ""
echo "✅ Limpieza lista. Revisa los cambios y ejecuta force push cuando estés listo."


