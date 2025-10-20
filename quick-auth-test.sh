#!/bin/bash

# Quick Auth Test with Real Email Domain
set -e

API_URL="http://localhost:3000"

# Use a real email domain (gmail.com) instead of test.com
EMAIL="claude-test-$(date +%s)@gmail.com"
PASSWORD="Test123!@#Strong"
NAME="Quick Test User"

echo "🧪 Quick Auth Test"
echo "📧 Email: $EMAIL"
echo ""

# Start server if not running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "🚀 Starting server..."
    npm run dev > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 5
    echo "✅ Server started (PID: $SERVER_PID)"
fi

echo "TEST: Register new user"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"name\": \"$NAME\"}")

echo "$RESPONSE" | grep -v HTTP_CODE | jq '.'
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)

echo ""
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ SUCCESS: Registration worked with real email domain!"
else
    echo "❌ FAILED: Registration failed with HTTP $HTTP_CODE"
    echo ""
    echo "Possible reasons:"
    echo "1. Supabase requires email confirmation (check your email)"
    echo "2. Supabase has specific domain restrictions configured"
    echo "3. Rate limit reached"
fi

# Kill server if we started it
if [ -n "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
fi
