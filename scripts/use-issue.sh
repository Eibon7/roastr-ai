#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Uso: scripts/use-issue.sh <id> [prefijo]"
  echo ""
  echo "Prefijos válidos:"
  echo "  feature  - Nueva funcionalidad (default)"
  echo "  fix      - Corrección de errores"
  echo "  chore    - Tareas de mantenimiento"
  echo "  docs     - Cambios en documentación"
  echo "  test     - Añadir o modificar tests"
  echo "  refactor - Refactorización de código"
  echo "  perf     - Mejoras de rendimiento"
  echo "  ci       - Cambios en CI/CD"
  echo "  build    - Cambios en sistema de build"
  echo "  style    - Cambios de formato"
  exit 1
fi

ID="$1"
KIND="${2:-feature}"

# Validar que el prefijo sea válido
VALID_PREFIXES="feature|fix|chore|docs|test|refactor|perf|ci|build|style"
if ! echo "$KIND" | grep -E "^($VALID_PREFIXES)$" > /dev/null; then
  echo "❌ Prefijo inválido: $KIND"
  echo "Prefijos válidos: feature, fix, chore, docs, test, refactor, perf, ci, build, style"
  exit 1
fi

BRANCH="${KIND}/issue-${ID}"

git fetch origin --quiet || true
if git show-ref --quiet --verify "refs/heads/${BRANCH}"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

echo "$BRANCH" > .issue_lock
echo "🔐 Candado fijado para rama: $BRANCH"
echo "Sugerencia: /new-pr para abrir PR inicial."


