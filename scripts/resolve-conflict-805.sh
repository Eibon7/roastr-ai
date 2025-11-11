#!/bin/bash

# Script para resolver conflictos en PR 805

set -e

cd /Users/emiliopostigo/roastr-ai

echo "🔍 Verificando estado del conflicto..."

# Verificar que no haya marcadores de conflicto
if grep -r "^<<<<<<<\|^=======\|^>>>>>>>" tests/integration/cli/logCommands.test.js; then
    echo "❌ ERROR: Todavía hay marcadores de conflicto"
    exit 1
fi

echo "✅ No hay marcadores de conflicto"

# Verificar sintaxis del archivo
echo "🔍 Verificando sintaxis JavaScript..."
node -c tests/integration/cli/logCommands.test.js || {
    echo "❌ ERROR: Sintaxis inválida en logCommands.test.js"
    exit 1
}

echo "✅ Sintaxis válida"

# Stage el archivo resuelto
echo "📦 Staging archivo resuelto..."
git add tests/integration/cli/logCommands.test.js

# Verificar status
echo "📊 Estado de git:"
git status --short

# Continuar el merge
echo "🔀 Continuando merge..."
git merge --continue || {
    echo "⚠️  No hay merge en progreso, solo commiteando el fix..."
    git commit -m "fix: Resolve merge conflict in logCommands.test.js

- Merged changes from main
- Kept both verification assertions (backup, cleanup, health)
- Removed duplicate test cases
- Ensured all expect statements are preserved"
}

echo "✅ Conflicto resuelto exitosamente"
echo ""
echo "📋 Siguiente paso: Aplicar revisión de CodeRabbit"


