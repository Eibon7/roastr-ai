#!/bin/bash
# Comandos para ejecutar MANUALMENTE (copy/paste uno por uno)

cd /Users/emiliopostigo/roastr-ai

echo "=== PASO 1: Commitear conflicto resuelto ==="
git add tests/integration/cli/logCommands.test.js
git commit -m "fix: Resolve merge conflict in logCommands.test.js

- Merged changes from main
- Kept enhanced verification assertions from both versions
- Removed duplicate test cases
- Ensured comprehensive test coverage
- All expect statements preserved

Related: #774"

echo ""
echo "=== PASO 2: Eliminar archivos RLS (issue #800) ==="
git rm -f tests/integration/multi-tenant-rls-issue-800.test.js
git rm -f scripts/check-all-rls-tables.js
git rm -f scripts/check-missing-tables.js
git rm -f scripts/identify-untested-tables.js
git rm -f scripts/shared/rls-tables.js
git rm -rf docs/test-evidence/issue-800

echo ""
echo "=== PASO 3: Commitear limpieza ==="
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

echo ""
echo "=== PASO 4: Añadir documentación ==="
git add docs/plan/limpieza-805-ejecutada.md
git commit -m "docs: Add cleanup execution documentation for PR 805

- Document conflict resolution steps
- List removed RLS files (issue #800)
- List preserved files (issue #774)
- Add verification checklist

Related: #774"

echo ""
echo "=== VERIFICACIÓN ==="
echo "Archivos modificados vs main (solo debe aparecer issue #774):"
git diff origin/main --name-only

echo ""
echo "=== SIGUIENTE: Tests y Push ==="
echo "npm test"
echo "git push origin fix/issue-774-pending-tests"


