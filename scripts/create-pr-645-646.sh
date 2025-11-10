#!/bin/bash
set -e

# Get repository root dynamically
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")")
cd "$REPO_ROOT" || exit 1

echo "🔍 Checking git status..."
git status --short

echo ""
echo "🌿 Creating/checking out branch..."
BRANCH_NAME="fix/issue-645-646-cli-tests-audit"
if git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
  echo "Branch exists, checking out..."
  git checkout "$BRANCH_NAME"
else
  echo "Creating new branch..."
  git checkout -b "$BRANCH_NAME"
fi

echo ""
echo "📦 Staging files..."
git add tests/integration/cli/logCommands.test.js
git add docs/test-evidence/issue-646-audit-summary.md
git add scripts/audit-test-failures.js
git add PR_DESCRIPTION_645_646.md

echo ""
echo "📝 Creating commit..."
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  git commit -m "fix(tests): Fix CLI test suite and complete test audit (#645, #646)

- Fix CLI tests to use correct path (logManager.js)
- Update command structure to match actual implementation  
- Increase timeouts for CLI operations (30s -> 60s)
- Complete comprehensive audit of ~179 failing test suites
- Categorize failures into 10 priority-based categories
- Define 3-phase fix strategy with milestones
- Add audit utility script for future use

Fixes #645
Fixes #646"
fi

echo ""
echo "🚀 Pushing branch..."
if git rev-parse --verify --quiet "origin/$BRANCH_NAME" >/dev/null 2>&1; then
  echo "Branch already exists on remote, pushing updates..."
  git push origin "$BRANCH_NAME"
else
  echo "Pushing new branch..."
  git push -u origin "$BRANCH_NAME"
fi

echo ""
echo "🔨 Creating PR..."
if gh pr view "$BRANCH_NAME" --json number >/dev/null 2>&1; then
  echo "PR already exists"
else
  gh pr create \
    --title "Fix CLI Test Suite & Complete Test Audit (#645, #646)" \
    --body-file PR_DESCRIPTION_645_646.md \
    --base main \
    --head "$BRANCH_NAME"
fi

echo ""
echo "✅ Done! Checking PR status..."
gh pr list --head fix/issue-645-646-cli-tests-audit --json number,title,state,url


