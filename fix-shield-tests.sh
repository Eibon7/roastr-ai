#!/bin/bash
# Comprehensive fix script for Shield action tags tests
# Based on analysis from previous session

# Fix 1: Change skip reason from 'not_reportable' to 'not reportable' in service
# Portable sed for macOS and Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/reason: 'not_reportable'/reason: 'not reportable'/g" src/services/shieldService.js
else
  sed -i.bak "s/reason: 'not_reportable'/reason: 'not reportable'/g" src/services/shieldService.js
  rm -f src/services/shieldService.js.bak
fi

echo "✅ Applied Fix #1: Skip reason string mismatch"
echo "   Changed 'not_reportable' → 'not reportable' in src/services/shieldService.js"
echo ""
echo "Next: Run tests to verify 27/27 passing (100%)"
