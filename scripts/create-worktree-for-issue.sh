#!/bin/bash
# scripts/create-worktree-for-issue.sh
#
# Automatiza la creación de worktrees para issues con:
# - Branch naming convention
# - .issue_lock automático
# - Auto-activación GDD
#
# Uso: ./scripts/create-worktree-for-issue.sh <issue-number> [scope]
# Ejemplo: ./scripts/create-worktree-for-issue.sh 1033 setup

set -e  # Exit on error

ISSUE_NUM=$1
SCOPE=${2:-"main"}

# Validación
if [ -z "$ISSUE_NUM" ]; then
  echo "❌ Error: Issue number is required"
  echo ""
  echo "Usage: $0 <issue-number> [scope]"
  echo ""
  echo "Examples:"
  echo "  $0 1033          # Creates feature/issue-1033-main"
  echo "  $0 1033 setup    # Creates feature/issue-1033-setup"
  echo "  $0 1044 tests    # Creates feature/issue-1044-tests"
  exit 1
fi

# Verificar que estamos en el repo principal
if [ ! -d ".git" ]; then
  echo "❌ Error: Must run from repository root"
  exit 1
fi

# Guardar directorio original antes de cambiar
ORIGINAL_DIR=$(pwd)

# Configuración
BRANCH="feature/issue-${ISSUE_NUM}-${SCOPE}"
WORKTREE_BASE_PATH="${WORKTREE_BASE_PATH:-../roastr-ai-worktrees}"
WORKTREE_PATH="${WORKTREE_BASE_PATH}/issue-${ISSUE_NUM}"

# Verificar si el worktree ya existe
if [ -d "$WORKTREE_PATH" ]; then
  echo "⚠️  Worktree already exists: $WORKTREE_PATH"
  echo ""
  echo "Options:"
  echo "  1. Remove it: git worktree remove $WORKTREE_PATH"
  echo "  2. Use different scope: $0 $ISSUE_NUM <different-scope>"
  exit 1
fi

# Crear directorio base si no existe
mkdir -p "$WORKTREE_BASE_PATH"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Creating worktree for Issue #${ISSUE_NUM}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Crear worktree
echo "📁 Creating worktree..."
git worktree add "$WORKTREE_PATH" -b "$BRANCH"

# Crear .issue_lock
echo "🔒 Creating issue lock..."
echo "$BRANCH" > "$WORKTREE_PATH/.issue_lock"

# Cambiar al worktree
cd "$WORKTREE_PATH"

# Auto-activar GDD (si el script existe)
if [ -f "scripts/cursor-agents/auto-gdd-activation.js" ]; then
  echo "🎯 Auto-activating GDD..."
  node scripts/cursor-agents/auto-gdd-activation.js "$ISSUE_NUM" || {
    echo "⚠️  GDD auto-activation failed (continuing anyway)"
  }
else
  echo "⚠️  GDD auto-activation script not found (skipping)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Worktree created successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Path:   $WORKTREE_PATH"
echo "🌿 Branch: $BRANCH"
echo "🔒 Lock:   $BRANCH (.issue_lock created)"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  # Open in Cursor and start working"
echo ""
echo "When done:"
echo "  cd $ORIGINAL_DIR"
echo "  git worktree remove $WORKTREE_PATH"
echo ""

