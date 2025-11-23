# Roast API Testing Guide

This document provides comprehensive testing guidelines for the Roastr.ai roast generation API endpoints.

## Overview

The Roastr.ai roast API provides AI-powered roast generation with the following key features:

- **OpenAI Integration**: Real AI-powered roast generation (flagged by `ENABLE_REAL_OPENAI`)
- **Perspective API Moderation**: Content safety analysis and toxicity detection
- **IPv6-Safe Rate Limiting**: Robust rate limiting that handles both IPv4 and IPv6 addresses
- **Credit System**: User-based credit consumption and limits
- **Consistent JSON Responses**: Standardized response format across all endpoints

## Endpoints

### 1. POST /api/roast/preview

Generate a roast preview without consuming user credits.

**Authentication**: Required  
**Rate Limit**: 30 requests/15min (authenticated), 5 requests/15min (anonymous)

#### Request Body

```json
{
  "text": "string (required, max 2000 chars)",
  "tone": "string (optional, default: 'sarcastic')",
  "intensity": "number (optional, 1-5, default: 3)",
  "humorType": "string (optional, default: 'witty')"
}
```

#### Valid Values

- **tone**: `sarcastic`, `witty`, `clever`, `playful`, `savage`
- **humorType**: `witty`, `clever`, `sarcastic`, `playful`, `observational`
- **intensity**: 1 (gentle) to 5 (savage)

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "roast": "Generated roast text",
    "metadata": {
      "tone": "sarcastic",
      "intensity": 3,
      "humorType": "witty",
      "toxicityScore": 0.1,
      "safe": true,
      "preview": true,
      "plan": "creator",
      "processingTimeMs": 450,
      "generatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. POST /api/roast/generate

Generate a roast and consume user credits.

**Authentication**: Required  
**Rate Limit**: 30 requests/15min (authenticated), 5 requests/15min (anonymous)

#### Request Body

Same as `/preview` endpoint.

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "roast": "Generated roast text",
    "metadata": {
      "tone": "witty",
      "intensity": 3,
      "humorType": "clever",
      "toxicityScore": 0.15,
      "safe": true,
      "preview": false,
      "plan": "creator",
      "processingTimeMs": 520,
      "generatedAt": "2024-01-15T10:30:00.000Z"
    },
    "credits": {
      "remaining": 485,
      "limit": 500,
      "used": 15
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. GET /api/roast/credits

Get user's current credit status.

**Authentication**: Required

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "plan": "creator",
    "status": "active",
    "credits": {
      "remaining": 485,
      "limit": 500,
      "used": 15,
      "unlimited": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing Scenarios

### 1. Basic Functionality Tests

#### Test Case: Successful Roast Generation

```bash
curl -X POST http://localhost:3000/api/roast/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I think pineapple belongs on pizza",
    "tone": "sarcastic",
    "intensity": 3
  }'
```

**Expected**: 200 response with roast and metadata

#### Test Case: Parameter Validation

```bash
curl -X POST http://localhost:3000/api/roast/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "",
    "tone": "invalid-tone",
    "intensity": 10
  }'
```

**Expected**: 400 response with validation errors

### 2. Authentication Tests

#### Test Case: Missing Authentication

```bash
curl -X POST http://localhost:3000/api/roast/preview \
  -H "Content-Type: application/json" \
  -d '{"text": "test message"}'
```

**Expected**: 401 response

### 3. Rate Limiting Tests

#### Test Case: Rate Limit Exceeded

```bash
# Send 31 requests rapidly (exceeds authenticated limit of 30)
for i in {1..31}; do
  curl -X POST http://localhost:3000/api/roast/preview \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "test message '$i'"}' &
done
wait
```

**Expected**: First 30 requests succeed, 31st returns 429

### 4. Content Moderation Tests

#### Test Case: High Toxicity Content

```bash
curl -X POST http://localhost:3000/api/roast/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I hate everyone and everything"
  }'
```

**Expected**: 400 response if Perspective API detects high toxicity

### 5. Credit System Tests

#### Test Case: Credit Consumption

```bash
# Check initial credits
curl -X GET http://localhost:3000/api/roast/credits \
  -H "Authorization: Bearer YOUR_TOKEN"

# Generate roast (consumes credit)
curl -X POST http://localhost:3000/api/roast/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "test message"}'

# Check credits again
curl -X GET http://localhost:3000/api/roast/credits \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: Credits decrease by 1 after generation

## Environment Variables

### Required for Full Functionality

```bash
# OpenAI Integration
ENABLE_REAL_OPENAI=true
OPENAI_API_KEY=your_openai_api_key

# Perspective API Integration
ENABLE_PERSPECTIVE_API=true
PERSPECTIVE_API_KEY=your_perspective_api_key

# Rate Limiting
ENABLE_RATE_LIMIT=true

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### Development/Testing

```bash
# Disable external APIs for testing
ENABLE_REAL_OPENAI=false
ENABLE_PERSPECTIVE_API=false
ENABLE_RATE_LIMIT=false

# Enable debug logging
NODE_ENV=development
DEBUG_RATE_LIMIT=true
```

## Running Tests

### Unit Tests

```bash
npm test tests/unit/roast.test.js
```

### Integration Tests

```bash
npm test tests/integration/roast.test.js
```

### All Roast Tests

```bash
npm test -- --testPathPattern=roast
```

## Performance Benchmarks

### Expected Response Times

- **Preview endpoint**: < 1000ms (mock), < 3000ms (real OpenAI)
- **Generate endpoint**: < 1200ms (mock), < 3500ms (real OpenAI)
- **Credits endpoint**: < 200ms

### Rate Limiting Thresholds

- **Authenticated users**: 30 requests per 15 minutes
- **Anonymous users**: 5 requests per 15 minutes
- **IPv6 normalization**: Handles compressed and expanded formats

### Credit Limits by Plan

- **Free**: 50 roasts per month
- **Creator**: 500 roasts per month
- **Pro**: Unlimited roasts

## Error Codes

| Code | Description             | Common Causes                                    |
| ---- | ----------------------- | ------------------------------------------------ |
| 400  | Validation failed       | Invalid parameters, empty text, unsupported tone |
| 400  | Content not suitable    | High toxicity score from Perspective API         |
| 401  | Authentication required | Missing or invalid token                         |
| 402  | Insufficient credits    | User has reached monthly limit                   |
| 429  | Rate limit exceeded     | Too many requests in time window                 |
| 500  | Internal server error   | OpenAI API error, database connection issue      |

## Troubleshooting

### Common Issues

#### 1. Rate Limit False Positives

**Symptom**: Users getting 429 errors unexpectedly  
**Solution**: Check IPv6 normalization, verify rate limit configuration

#### 2. High Response Times

**Symptom**: Requests taking > 5 seconds  
**Solution**: Check OpenAI API status, verify database connections

#### 3. Credit Calculation Errors

**Symptom**: Incorrect credit counts  
**Solution**: Verify database transactions, check for race conditions

### Debug Commands

```bash
# Check service status
curl -X GET http://localhost:3000/api/health

# Verify authentication
curl -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test rate limiting
curl -X GET http://localhost:3000/api/roast/credits \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v  # Check rate limit headers
```

## Security Considerations

### Input Validation

- Text length limits (2000 characters)
- Parameter type validation
- SQL injection prevention
- XSS prevention in responses

### Rate Limiting

- IPv6-safe IP normalization
- User-based and IP-based limits
- Exponential backoff recommendations

### Content Safety

- Perspective API integration
- Toxicity score thresholds
- Category-based filtering
