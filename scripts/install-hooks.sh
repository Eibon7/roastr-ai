#!/usr/bin/env bash
# Script para instalar git hooks del sistema Branch Guard

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="${REPO_ROOT}/.git/hooks"
SOURCE_DIR="${REPO_ROOT}/githooks"

echo "🔧 Instalando git hooks para Branch Guard..."

# Verificar que existe el directorio de hooks fuente
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: No se encuentra el directorio githooks/"
  exit 1
fi

# Instalar cada hook
for hook in pre-commit commit-msg pre-push; do
  if [ -f "$SOURCE_DIR/$hook" ]; then
    cp "$SOURCE_DIR/$hook" "$HOOKS_DIR/$hook"
    chmod +x "$HOOKS_DIR/$hook"
    echo "✅ Instalado: $hook"
  else
    echo "⚠️  No se encuentra: $hook"
  fi
done

echo ""
echo "🎉 Hooks instalados correctamente."
echo ""
echo "Próximos pasos:"
echo "1. Trabaja en una issue: scripts/use-issue.sh <issue-id>"
echo "2. Lee la documentación: docs/dev/branch-guard.md"

