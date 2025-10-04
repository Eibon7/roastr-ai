#!/bin/bash

# Pre-Flight Checklist Script
# Automated validation before creating a PR
# Usage: ./scripts/pre-flight-check.sh

set -e

echo "🚀 Pre-Flight Checklist - Roastr AI"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Function to print check result
check_pass() {
  echo -e "${GREEN}✅ PASS:${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}❌ FAIL:${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠️  WARN:${NC} $1"
  ((WARNINGS++))
}

echo "📝 Checking Tests..."
echo "-------------------"

# Check if tests exist
if [ -d "tests" ]; then
  check_pass "Tests directory exists"

  # Run tests
  if npm test -- --passWithNoTests 2>&1 | grep -q "Tests.*passed"; then
    check_pass "Tests are passing"
  else
    check_fail "Tests are failing - fix before creating PR"
  fi
else
  check_warn "No tests directory found"
fi

echo ""
echo "📚 Checking Documentation..."
echo "----------------------------"

# Check if CLAUDE.md needs update
if git diff --cached --name-only | grep -q "src/\|\.claude/agents/"; then
  if git diff --cached --name-only | grep -q "CLAUDE.md\|spec.md\|docs/nodes/"; then
    check_pass "Documentation appears updated"
  else
    check_warn "Changed src/ or agents/ but no doc updates - verify if needed"
  fi
fi

# Check for GDD compliance
if git diff --cached --name-only | grep -q "src/"; then
  if [ -d "docs/nodes" ]; then
    check_pass "GDD nodes directory exists"
  else
    check_warn "No GDD nodes directory found"
  fi
fi

echo ""
echo "🧹 Checking Code Quality..."
echo "---------------------------"

# Check for console.logs in staged files
if git diff --cached | grep -q "console\.log"; then
  check_fail "Found console.log statements - remove debug logs"
else
  check_pass "No debug console.logs found"
fi

# Check for TODOs without issues
if git diff --cached | grep -q "TODO\|FIXME" | grep -v "issue #"; then
  check_warn "Found TODO/FIXME comments - consider creating issues"
else
  check_pass "No untracked TODOs found"
fi

# Check for commented code
COMMENTED_CODE=$(git diff --cached | grep -E "^\+\s*//.*[{};]" | wc -l)
if [ "$COMMENTED_CODE" -gt 5 ]; then
  check_warn "Found $COMMENTED_CODE lines of commented code - clean up if unused"
else
  check_pass "Minimal commented code"
fi

echo ""
echo "🔒 Checking Security..."
echo "-----------------------"

# Check for hardcoded credentials
if git diff --cached | grep -iE "(password|api_key|secret|token)\s*=\s*['\"]"; then
  check_fail "Found potential hardcoded credentials"
else
  check_pass "No hardcoded credentials found"
fi

# Check for .env files
if git diff --cached --name-only | grep -q "\.env"; then
  check_fail "Attempting to commit .env file - add to .gitignore"
else
  check_pass "No .env files in commit"
fi

echo ""
echo "📊 Summary"
echo "=========="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Pre-flight check FAILED${NC}"
  echo "Fix the issues above before creating PR"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Pre-flight check passed with warnings${NC}"
  echo "Review warnings above before creating PR"
  echo ""
  read -p "Continue with PR creation? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted by user"
    exit 1
  fi
else
  echo -e "${GREEN}✅ Pre-flight check PASSED${NC}"
  echo "Ready to create PR!"
fi

echo ""
echo "Next steps:"
echo "1. Review changes: git diff --staged"
echo "2. Create PR: gh pr create"
echo "3. Wait for CI/CD and CodeRabbit review"
echo "4. Target: 0 CodeRabbit comments"
