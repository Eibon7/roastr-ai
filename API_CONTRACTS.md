# API Contracts Documentation

This document outlines all API endpoints for the Roastr.ai application, with special focus on the new **Style Profile** feature.

## 🎭 Mock Mode

All endpoints support **100% mock mode** for CI/CD and development without external dependencies.

- **Backend Mock**: Set `ENABLE_MOCK_MODE=true`
- **Frontend Mock**: Set `REACT_APP_ENABLE_MOCK_MODE=true`

## 🔐 Authentication

Most endpoints require authentication via JWT token in `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

## 📋 Plan Management API

### GET /api/plan/available
Get all available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "free",
        "name": "Free",
        "price": 0,
        "features": {
          "roastsPerMonth": 100,
          "platformConnections": 2,
          "styleProfile": false
        }
      },
      {
        "id": "creator_plus",
        "name": "Creator+",
        "price": 19.99,
        "features": {
          "roastsPerMonth": 5000,
          "platformConnections": 10,
          "styleProfile": true
        }
      }
    ]
  }
}
```

### GET /api/plan/current
Get current user's plan (authenticated).

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": "creator_plus",
    "details": {
      "id": "creator_plus",
      "name": "Creator+",
      "features": { "styleProfile": true }
    },
    "canAccessStyleProfile": true
  }
}
```

### POST /api/plan/select
Select a new plan (authenticated).

**Request:**
```json
{
  "plan": "creator_plus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": "creator_plus",
    "details": { "name": "Creator+" },
    "message": "Successfully selected Creator+ plan"
  }
}
```

## 🎨 Style Profile API

### GET /api/style-profile/status
Check Style Profile feature access and status (authenticated).

**Response:**
```json
{
  "success": true,
  "data": {
    "featureEnabled": true,
    "hasAccess": true,
    "available": true,
    "hasExistingProfile": false
  }
}
```

### GET /api/style-profile
Get user's existing style profile (authenticated).

**Response (No Profile):**
```json
{
  "success": true,
  "data": {
    "available": false,
    "message": "No style profile generated yet"
  }
}
```

**Response (Profile Exists):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "profiles": [
      {
        "lang": "es",
        "prompt": "Eres un usuario amigable que usa un estilo equilibrado...",
        "examples": ["Ejemplo 1", "Ejemplo 2"],
        "sources": { "twitter": 180, "instagram": 95 },
        "metadata": {
          "totalItems": 275,
          "avgLength": 142,
          "dominantTone": "friendly"
        },
        "createdAt": "2025-01-09T15:30:00Z"
      }
    ],
    "totalItems": 315,
    "sources": { "twitter": 220, "instagram": 95 },
    "createdAt": "2025-01-09T15:30:00Z"
  }
}
```

### POST /api/style-profile/generate
Generate a new style profile (authenticated, Creator+ required).

**Request:**
```json
{
  "platforms": ["twitter", "instagram"],
  "maxItemsPerPlatform": 300
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "lang": "es",
        "prompt": "Eres un usuario que tiende a usar un tono amigable...",
        "examples": ["Ejemplo generado 1", "Ejemplo generado 2"],
        "sources": { "twitter": 180, "instagram": 95 },
        "metadata": {
          "totalItems": 275,
          "avgLength": 142,
          "dominantTone": "friendly",
          "topicDistribution": {
            "humor": 0.35,
            "commentary": 0.25,
            "personal": 0.20,
            "other": 0.20
          }
        },
        "createdAt": "2025-01-09T15:30:00Z"
      }
    ],
    "totalItems": 315,
    "sources": { "twitter": 220, "instagram": 95 },
    "message": "Style profile generated successfully",
    "createdAt": "2025-01-09T15:30:00Z"
  }
}
```

**Error Response (Insufficient Plan):**
```json
{
  "success": false,
  "error": "Style Profile generation requires Creator+ plan",
  "upgrade": true,
  "requiredPlan": "creator_plus"
}
```

### DELETE /api/style-profile
Delete user's style profile (authenticated).

**Response:**
```json
{
  "success": true,
  "message": "Style profile deleted successfully"
}
```

## 🔗 Integration Management API

### GET /api/integrations/platforms
Get available social media platforms for integration.

**Response:**
```json
{
  "success": true,
  "data": {
    "platforms": [
      {
        "name": "twitter",
        "displayName": "Twitter/X",
        "icon": "𝕏",
        "description": "Connect your Twitter account",
        "maxImportLimit": 300,
        "languages": ["es", "en"]
      },
      {
        "name": "instagram",
        "displayName": "Instagram",
        "icon": "📷",
        "description": "Connect Instagram account",
        "maxImportLimit": 300,
        "languages": ["es", "en"]
      }
    ]
  }
}
```

### GET /api/integrations/status
Get user's integration status (authenticated).

**Response:**
```json
{
  "success": true,
  "data": {
    "integrations": [
      {
        "platform": "twitter",
        "displayName": "Twitter/X",
        "status": "connected",
        "importedCount": 287,
        "lastImport": "2025-01-09T15:30:00Z"
      },
      {
        "platform": "instagram",
        "displayName": "Instagram",
        "status": "disconnected",
        "importedCount": 0,
        "lastImport": null
      }
    ],
    "connectedCount": 1,
    "totalPlatforms": 2
  }
}
```

### POST /api/integrations/connect
Connect to a social media platform (authenticated).

**Request:**
```json
{
  "platform": "twitter"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platform": "twitter",
    "status": "connected",
    "message": "Successfully connected to Twitter/X",
    "connectedAt": "2025-01-09T15:30:00Z"
  }
}
```

### POST /api/integrations/import
Import content from a connected platform (authenticated).

**Request:**
```json
{
  "platform": "twitter",
  "maxItems": 300
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platform": "twitter",
    "imported": 287,
    "languageHints": ["es", "en"],
    "status": "completed"
  }
}
```

## 🏥 Health & Monitoring

### GET /api/health
Application health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-09T15:30:00Z",
  "mockMode": true,
  "features": {
    "styleProfile": true
  }
}
```

## ⚠️ Error Responses

All endpoints use consistent error format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes:
- `UNAUTHORIZED` (401): Invalid or missing authentication
- `FORBIDDEN` (403): Insufficient plan or permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

## 🎭 Mock Mode Behavior

In mock mode, all endpoints:
- Return realistic fake data
- Simulate network delays (100-200ms)
- Never make external API calls
- Maintain consistent state within a session
- Support all error scenarios for testing

### Mock Data Features:
- **Multi-language profiles** with Spanish/English content
- **Realistic user content** from multiple platforms
- **Plan gating simulation** with Creator+ requirements
- **Progress tracking** for import operations
- **Error simulation** for testing edge cases

## 🔧 Environment Variables

### Mock Mode Configuration:
```bash
# Backend Mock Mode
ENABLE_MOCK_MODE=true

# Frontend Mock Mode  
REACT_APP_ENABLE_MOCK_MODE=true
REACT_APP_SUPABASE_URL=http://localhost/mock
REACT_APP_SUPABASE_ANON_KEY=mock-anon-key
```

### Production Configuration:
```bash
# Real API keys (not in repo)
OPENAI_API_KEY=sk-real-key
SUPABASE_URL=https://your-project.supabase.co
TWITTER_BEARER_TOKEN=your-real-token
# ... other real API keys
```

---

## 📚 Additional Notes

- All timestamps are in ISO 8601 format (UTC)
- All API responses include CORS headers for frontend access
- Rate limiting is applied per user (authenticated endpoints)
- Mock mode is automatically enabled in test environments
- All endpoints support both JSON request/response and form data where appropriate

**Last Updated:** January 2025  
**Version:** 1.0.0 (Style Profile Feature Complete)