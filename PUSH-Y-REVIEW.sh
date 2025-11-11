#!/bin/bash
# Script completo: Push + CodeRabbit Review
set -e

cd /Users/emiliopostigo/roastr-ai

echo "=========================================="
echo "🚀 PUSH + CODERABBIT REVIEW - PR 805"
echo "=========================================="
echo ""

# ============================================================================
# PARTE 1: PUSH
# ============================================================================

echo "📦 PARTE 1: PUSH DE CAMBIOS"
echo ""

echo "Step 1: Committing conflict resolution..."
git add tests/integration/cli/logCommands.test.js
git commit -m "fix: Resolve merge conflict in logCommands.test.js

- Merged changes from main
- Kept enhanced verification assertions from both versions
- Removed duplicate test cases
- Ensured comprehensive test coverage
- All expect statements preserved

Related: #774" || echo "ℹ️  Already committed or nothing to commit"

echo "✅ Conflict committed"
echo ""

echo "Step 2: Removing RLS files (issue #800)..."
git rm -f tests/integration/multi-tenant-rls-issue-800.test.js 2>/dev/null || true
git rm -f scripts/check-all-rls-tables.js 2>/dev/null || true
git rm -f scripts/check-missing-tables.js 2>/dev/null || true
git rm -f scripts/identify-untested-tables.js 2>/dev/null || true
git rm -f scripts/shared/rls-tables.js 2>/dev/null || true
git rm -rf docs/test-evidence/issue-800 2>/dev/null || true

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

Related: #774, #800" || echo "ℹ️  Already committed or nothing to commit"

echo "✅ Cleanup committed"
echo ""

echo "Step 3: Adding documentation..."
git add docs/plan/limpieza-805-ejecutada.md \
        RESUMEN-LIMPIEZA-805.md \
        EJECUTAR-LIMPIEZA-805.md \
        EJECUTAR-AHORA-805.md \
        COMANDOS-MANUALES-805.sh \
        scripts/cleanup-and-push-805.sh \
        push-805-now.sh \
        PUSH-AHORA.md \
        REVIEW-805.md \
        PUSH-Y-REVIEW.sh 2>/dev/null || true

git commit -m "docs: Add cleanup execution documentation for PR 805

- Document conflict resolution steps
- List removed RLS files (issue #800)
- List preserved files (issue #774)
- Add verification checklist
- Add execution scripts (automated and manual)
- Add CodeRabbit review documentation

Related: #774" || echo "ℹ️  Already committed or nothing to commit"

echo "✅ Documentation committed"
echo ""

echo "📊 Files modified vs main:"
git diff origin/main --name-only | head -20
echo ""

echo "🚀 Pushing to origin/fix/issue-774-pending-tests..."
git push origin fix/issue-774-pending-tests

echo "✅ Push completado"
echo ""

# ============================================================================
# PARTE 2: CODERABBIT REVIEW
# ============================================================================

echo "=========================================="
echo "🤖 PARTE 2: CODERABBIT REVIEW"
echo "=========================================="
echo ""

echo "Ejecutando CodeRabbit review..."
echo "(Esto puede tardar 2-5 minutos)"
echo ""

npm run coderabbit:review

echo ""
echo "=========================================="
echo "✅ COMPLETADO"
echo "=========================================="
echo ""
echo "📊 Resumen:"
echo "  ✅ Push completado"
echo "  ✅ CodeRabbit review ejecutada"
echo "  ✅ Commits generados:"
git log --oneline -3
echo ""
echo "🔗 Verifica en GitHub:"
echo "  https://github.com/Eibon7/roastr-ai/pull/805"
echo ""
echo "📝 Siguiente paso:"
echo "  - Revisa comentarios de CodeRabbit (si los hay)"
echo "  - Ejecuta tests: npm test"
echo "  - Si todo está bien, solicita merge"
echo ""

