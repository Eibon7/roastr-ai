#!/bin/bash

# QA Test Suite Runner for Issue #90
# Social Media Integrations Testing

set -e

echo "🧪 Running QA Test Suite for Social Media Integrations (Issue #90)"
echo "=================================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test configuration
export NODE_ENV=test
export ENABLE_MOCK_MODE=true

# Check if ngrok is available for webhook testing
NGROK_AVAILABLE=false
if command -v ngrok &> /dev/null; then
    NGROK_AVAILABLE=true
    echo "✅ ngrok available for webhook testing"
else
    echo "⚠️  ngrok not available - webhook tests will run in mock mode"
fi

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function to run individual test suite
run_test_suite() {
    local test_name="$1"
    local test_file="$2"
    local description="$3"
    
    echo ""
    echo "🔍 Running: $test_name"
    echo "   Description: $description"
    echo "   File: $test_file"
    
    if npm test "$test_file" --silent; then
        echo -e "   ${GREEN}✅ PASSED${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "   ${RED}❌ FAILED${NC}: $test_name"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("$test_name")
    fi
}

# Run QA test suites
echo ""
echo "🚀 Starting QA Test Execution..."

run_test_suite \
    "OAuth Integration Tests" \
    "tests/qa/oauth-integration-tests.js" \
    "Real OAuth flows with development credentials"

run_test_suite \
    "Token Management Tests" \
    "tests/qa/token-management-tests.js" \
    "Token storage, expiration, and renewal mechanisms"

run_test_suite \
    "Webhook Integration Tests" \
    "tests/qa/webhook-tests.js" \
    "Webhook handling with HMAC signatures and ngrok"

run_test_suite \
    "Payload Processing Tests" \
    "tests/qa/payload-processing-tests.js" \
    "Real webhook payload processing pipeline"

run_test_suite \
    "Retry System Tests" \
    "tests/qa/retry-system-tests.js" \
    "Exponential backoff and error simulation"

# Test results summary
echo ""
echo "=================================================================="
echo "🎯 QA TEST RESULTS SUMMARY"
echo "=================================================================="

echo "Total Test Suites: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    echo "Failed Test Suites:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  ❌ $test"
    done
else
    echo -e "${GREEN}Failed: 0${NC}"
fi

# Overall result
echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "🎉 ${GREEN}ALL QA TESTS PASSED!${NC}"
    echo "✅ Social media integrations are ready for production deployment"
    echo ""
    echo "Next steps:"
    echo "1. Run production readiness check: ./scripts/production-deployment-checklist.js"
    echo "2. Set up real OAuth credentials and webhook secrets"
    echo "3. Configure ngrok tunnel for webhook testing"
    echo "4. Deploy to staging environment for final validation"
    
    # Run production readiness check
    echo ""
    echo "🔍 Running Production Readiness Check..."
    if node ./scripts/production-deployment-checklist.js; then
        echo -e "✅ ${GREEN}Production readiness check passed!${NC}"
    else
        echo -e "⚠️  ${YELLOW}Production readiness check found issues - see details above${NC}"
    fi
    
    exit 0
else
    echo -e "❌ ${RED}QA TESTS FAILED${NC}"
    echo "🛑 Do not deploy to production until all tests pass"
    echo ""
    echo "Troubleshooting:"
    echo "• Check test logs above for specific failure details"
    echo "• Ensure all required environment variables are set"
    echo "• Verify database connectivity and credentials" 
    echo "• Check that mock mode is enabled for testing"
    
    exit 1
fi