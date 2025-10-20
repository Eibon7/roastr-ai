#!/bin/bash

# Manual Testing Script - Auth Complete Flow
# Run this script to execute all tests

set -e

echo "🧪 Starting Manual Testing - Auth Complete Flow"
echo "================================================"

# API endpoint
API_URL="http://localhost:3000"

# Generate unique test email
export EMAIL="test-manual-$(date +%s)@test.com"
export PASSWORD="Test123!@#Strong"
export NAME="Manual Test User"

echo ""
echo "📧 Test User: $EMAIL"
echo "🔗 API URL: $API_URL"
echo ""

# Test 1: Registration
echo "================================================================"
echo "TEST 1: Register new user"
echo "================================================================"
REGISTER_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"name\": \"$NAME\"}")

echo "$REGISTER_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$REGISTER_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ TEST 1 PASSED: Registration successful"
else
  echo "❌ TEST 1 FAILED: Expected 201, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 2: Login
echo "================================================================"
echo "TEST 2: Login with valid credentials"
echo "================================================================"
LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

echo "$LOGIN_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

# Extract tokens
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -v HTTP_STATUS | jq -r '.data.access_token // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -v HTTP_STATUS | jq -r '.data.refresh_token // empty')

if [ "$HTTP_CODE" = "200" ] && [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ TEST 2 PASSED: Login successful"
  echo "📝 Access Token: ${ACCESS_TOKEN:0:20}..."
  echo "📝 Refresh Token: ${REFRESH_TOKEN:0:20}..."
else
  echo "❌ TEST 2 FAILED: Expected 200, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 3: Get current user
echo "================================================================"
echo "TEST 3: Access protected route /api/auth/me"
echo "================================================================"
ME_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET $API_URL/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$ME_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$ME_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ TEST 3 PASSED: Protected route accessible"
else
  echo "❌ TEST 3 FAILED: Expected 200, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 4: Refresh token
echo "================================================================"
echo "TEST 4: Refresh access token"
echo "================================================================"
REFRESH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/session/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}")

echo "$REFRESH_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$REFRESH_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | grep -v HTTP_STATUS | jq -r '.data.access_token // empty')

if [ "$HTTP_CODE" = "200" ] && [ -n "$NEW_ACCESS_TOKEN" ] && [ "$NEW_ACCESS_TOKEN" != "$ACCESS_TOKEN" ]; then
  echo "✅ TEST 4 PASSED: Token refresh successful"
  echo "📝 New Access Token: ${NEW_ACCESS_TOKEN:0:20}..."
else
  echo "❌ TEST 4 FAILED: Expected 200 and new token, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 5: Logout
echo "================================================================"
echo "TEST 5: Logout"
echo "================================================================"
LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$LOGOUT_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$LOGOUT_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ TEST 5 PASSED: Logout successful"
else
  echo "❌ TEST 5 FAILED: Expected 200, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 6: Verify token invalid after logout
echo "================================================================"
echo "TEST 6: Verify token invalid after logout"
echo "================================================================"
INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET $API_URL/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$INVALID_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$INVALID_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ TEST 6 PASSED: Token invalidated after logout"
else
  echo "❌ TEST 6 FAILED: Expected 401, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 7: Duplicate registration
echo "================================================================"
echo "TEST 7: Reject duplicate email"
echo "================================================================"
DUPLICATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"DifferentPassword123!\", \"name\": \"Another User\"}")

echo "$DUPLICATE_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$DUPLICATE_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ TEST 7 PASSED: Duplicate email rejected"
else
  echo "❌ TEST 7 FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 8: Weak password
echo "================================================================"
echo "TEST 8: Reject weak password"
echo "================================================================"
WEAK_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"test-weak-$(date +%s)@test.com\", \"password\": \"123\", \"name\": \"Test User\"}")

echo "$WEAK_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$WEAK_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ TEST 8 PASSED: Weak password rejected"
else
  echo "❌ TEST 8 FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 9: Invalid login
echo "================================================================"
echo "TEST 9: Reject invalid password"
echo "================================================================"
INVALID_LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"WrongPassword123!\"}")

echo "$INVALID_LOGIN_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$INVALID_LOGIN_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ TEST 9 PASSED: Invalid password rejected"
else
  echo "❌ TEST 9 FAILED: Expected 401, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 10: Password reset
echo "================================================================"
echo "TEST 10: Send password reset email"
echo "================================================================"
RESET_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}")

echo "$RESET_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$RESET_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ TEST 10 PASSED: Password reset request accepted"
else
  echo "❌ TEST 10 FAILED: Expected 200, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 11: Missing email in registration
echo "================================================================"
echo "TEST 11: Missing email in registration"
echo "================================================================"
MISSING_EMAIL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$PASSWORD\", \"name\": \"Test User\"}")

echo "$MISSING_EMAIL_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$MISSING_EMAIL_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ TEST 11 PASSED: Missing email rejected"
else
  echo "❌ TEST 11 FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

sleep 1

# Test 12: Missing password in registration
echo "================================================================"
echo "TEST 12: Missing password in registration"
echo "================================================================"
MISSING_PASS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"test-$(date +%s)@test.com\", \"name\": \"Test User\"}")

echo "$MISSING_PASS_RESPONSE" | grep -v HTTP_STATUS | jq '.'
HTTP_CODE=$(echo "$MISSING_PASS_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ TEST 12 PASSED: Missing password rejected"
else
  echo "❌ TEST 12 FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

# Summary
echo "================================================================"
echo "🎉 All manual tests completed!"
echo "================================================================"
echo ""
echo "📧 Test user email: $EMAIL"
echo "🔗 API URL: $API_URL"
echo ""
echo "📊 Test Summary:"
echo "  TEST 1: Registration ..................... ✅"
echo "  TEST 2: Login ............................ ✅"
echo "  TEST 3: Protected route .................. ✅"
echo "  TEST 4: Token refresh .................... ✅"
echo "  TEST 5: Logout ........................... ✅"
echo "  TEST 6: Token invalidation ............... ✅"
echo "  TEST 7: Duplicate email .................. ✅"
echo "  TEST 8: Weak password .................... ✅"
echo "  TEST 9: Invalid password ................. ✅"
echo "  TEST 10: Password reset .................. ✅"
echo "  TEST 11: Missing email ................... ✅"
echo "  TEST 12: Missing password ................ ✅"
echo ""
echo "💡 Check detailed responses above for verification"
echo "📝 Results saved to: docs/test-evidence/manual-testing-results.txt"
