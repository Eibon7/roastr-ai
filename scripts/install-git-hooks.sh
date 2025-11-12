#!/usr/bin/env bash

###############################################################################
# SCRIPT: install-git-hooks.sh
# PROPÓSITO: Instalar git hooks de protección para el proyecto
# USO: bash scripts/install-git-hooks.sh
###############################################################################

set -e

HOOKS_DIR=".git/hooks"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔧 INSTALANDO GIT HOOKS DE PROTECCIÓN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .git exists
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "❌ ERROR: No se encontró directorio .git"
  echo "   Este script debe ejecutarse desde la raíz del repositorio"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/$HOOKS_DIR"

###############################################################################
# PRE-COMMIT HOOK
###############################################################################

echo "📝 Instalando pre-commit hook..."

cat > "$PROJECT_ROOT/$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env bash
set -e

# 1. Verificar .env existe (CRÍTICO)
node scripts/verify-env-exists.js || {
  echo "❌ .env no encontrado. Ejecuta: cp .env.example .env"
  exit 1
}

# 2. Verificar branch lock
if [ ! -f .issue_lock ]; then
  echo "⚠️  Falta .issue_lock (rama esperada). Crea el fichero con: echo \"<branch>\" > .issue_lock"
  exit 1
fi

EXPECTED_BRANCH="$(tr -d '[:space:]' < .issue_lock)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$EXPECTED_BRANCH" != "$CURRENT_BRANCH" ]; then
  echo "❌ Rama incorrecta: estás en '$CURRENT_BRANCH' pero .issue_lock exige '$EXPECTED_BRANCH'."
  echo "   Cambia con: git checkout $EXPECTED_BRANCH"
  exit 1
fi
EOF

chmod +x "$PROJECT_ROOT/$HOOKS_DIR/pre-commit"
echo "   ✅ pre-commit hook instalado"

###############################################################################
# COMMIT-MSG HOOK (si no existe, preservar el existente)
###############################################################################

if [ ! -f "$PROJECT_ROOT/$HOOKS_DIR/commit-msg" ]; then
  echo "📝 Instalando commit-msg hook..."
  
  cat > "$PROJECT_ROOT/$HOOKS_DIR/commit-msg" << 'EOF'
#!/usr/bin/env bash
set -e

# Verificar que el mensaje de commit no está vacío
if [ -z "$(cat "$1" | grep -v '^#')" ]; then
  echo "❌ Mensaje de commit vacío"
  exit 1
fi
EOF

  chmod +x "$PROJECT_ROOT/$HOOKS_DIR/commit-msg"
  echo "   ✅ commit-msg hook instalado"
else
  echo "   ⚪ commit-msg hook ya existe (preservado)"
fi

###############################################################################
# VERIFICACIÓN
###############################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INSTALACIÓN COMPLETADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Hooks instalados:"
ls -lh "$PROJECT_ROOT/$HOOKS_DIR" | grep -E "(pre-commit|commit-msg|pre-push)" || echo "  - pre-commit"
echo ""
echo "🔒 PROTECCIONES ACTIVAS:"
echo "   • .env debe existir antes de commits"
echo "   • Backups automáticos en cada verificación"
echo "   • Branch lock verification (.issue_lock)"
echo ""
echo "📚 Más info: docs/policies/env-file-protection.md"
echo ""

