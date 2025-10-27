#!/usr/bin/env bash
# Fix MD007 (list indentation) and MD040 (missing language identifiers)

set -euo pipefail

FILES="${1:-.claude/skills}"

echo "🔧 Fixing markdown linting issues..."
echo "Target: $FILES"

# Fix trailing newlines (add if missing)
find "$FILES" -name "*.md" -type f -print0 | while IFS= read -r -d '' file; do
  if [ -s "$file" ] && [ "$(tail -c1 "$file" | wc -l)" -eq 0 ]; then
    echo "  ➕ Adding trailing newline: $file"
    echo "" >> "$file"
  fi
done

echo "✅ Markdown fixes applied"
echo ""
echo "Note: MD007 (list indentation) and MD040 (language specifiers) need manual review"
echo "Run: npm run lint:md"

