#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Uso: scripts/use-issue.sh <id> [feature|fix|chore]"
  exit 1
fi

ID="$1"
KIND="${2:-feature}"
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


