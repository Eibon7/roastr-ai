#!/bin/bash
set -e
cd /Users/emiliopostigo/roastr-ai

echo "=== Current branch ==="
git rev-parse --abbrev-ref HEAD

echo ""
echo "=== Checking .babelrc in HEAD ==="
git show HEAD:.babelrc | grep -E "(<<<<|====|>>>>)" && echo "CONFLICTS FOUND" || echo "NO CONFLICTS"

echo ""
echo "=== Current .babelrc status ==="
git status .babelrc

echo ""
echo "=== Diff between HEAD and current ==="
git diff HEAD .babelrc | head -60 || echo "No differences"

echo ""
echo "=== Adding and committing ==="
git add .babelrc
git commit -m "fix(pr-830): Resolve merge conflict markers in .babelrc

- Remove all Git conflict markers (<<<<<<< HEAD, =======, >>>>>>>)
- Keep Node target for test environment (not browsers)
- Ensure valid JSON structure for Babel configuration

Fixes CodeRabbit comment: Babel config was invalid JSON due to conflict markers" || echo "Commit failed or nothing to commit"

echo ""
echo "=== Pushing ==="
git push origin feature/issue-456-publisher-worker-implementation || echo "Push failed"

echo ""
echo "=== Latest commit ==="
git log --oneline -1


