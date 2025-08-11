# API Contracts Documentation

This document provides comprehensive API documentation for all endpoints in the Roastr.ai multi-tenant system.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Session Management](#session-management)
3. [Rate Limiting](#rate-limiting)
4. [OAuth Integration](#oauth-integration)
5. [Style Profile Management](#style-profile-management)
6. [User Management](#user-management)
7. [Admin Endpoints](#admin-endpoints)
8. [Billing & Subscription](#billing--subscription)
9. [Error Handling](#error-handling)
10. [Mock Mode Behavior](#mock-mode-behavior)

## Authentication Endpoints

### Register User

**POST** `/api/auth/register`

Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid-user-id",
      "email": "user@example.com",
      "email_confirmed": false
    }
  }
}
```

**Error Responses:**
- **400**: Invalid input or email already exists
- **500**: Registration failed

### User Login

**POST** `/api/auth/login`

Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "keepLogged": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "jwt-access-token",
    "refresh_token": "jwt-refresh-token", 
    "expires_at": 1642787400000,
    "user": {
      "id": "uuid-user-id",
      "email": "user@example.com",
      "email_confirmed": true,
      "is_admin": false,
      "name": "John Doe",
      "plan": "basic"
    }
  }
}
```

**Error Responses:**
- **400**: Missing email or password
- **401**: Wrong email or password
- **429**: Too many login attempts (rate limited)

### Magic Link Authentication

**POST** `/api/auth/magic-link`

Send magic link for passwordless login.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Magic link sent to your email. Please check your inbox.",
  "data": {
    "email": "user@example.com"
  }
}
```

### User Logout

**POST** `/api/auth/logout`

Logout current user and invalidate tokens.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  }
}
```

### Get Current User

**GET** `/api/auth/me`

Get current user profile information.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "creator_plus",
    "is_admin": false,
    "email_confirmed": true,
    "created_at": "2023-01-01T00:00:00Z",
    "organization": {
      "id": "org-uuid",
      "name": "User's Organization"
    }
  }
}
```

**Error Responses:**
- **401**: Invalid or expired token
- **403**: Token validation failed

## Session Management

### Session Refresh

**POST** `/api/auth/session/refresh`

Refresh expired or near-expiry access tokens.

**Request Body:**
```json
{
  "refresh_token": "jwt-refresh-token"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "new-jwt-access-token",
    "refresh_token": "new-jwt-refresh-token",
    "expires_at": 1642791000000,
    "expires_in": 3600,
    "user": {
      "id": "uuid-user-id",
      "email": "user@example.com"
    }
  }
}
```

**Error Responses:**
- **400**: Missing refresh token
- **401**: Invalid or expired refresh token
- **503**: Session refresh disabled

**Automatic Refresh Headers:**

When tokens are automatically refreshed during API calls:
```
X-New-Access-Token: new-jwt-access-token
X-New-Refresh-Token: new-jwt-refresh-token
X-Token-Refreshed: true
X-Expires-At: 1642791000000
```

## Rate Limiting

### Get Rate Limit Metrics

**GET** `/api/auth/rate-limit/metrics`

Get current rate limiting statistics (mock/test mode only).

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalAttempts": 150,
    "blockedAttempts": 8,
    "uniqueIPs": 45,
    "activeAttempts": 12,
    "currentlyBlocked": 3,
    "recentBlocksCount": 8,
    "rateLimitEnabled": true,
    "timestamp": 1642784400000
  }
}
```

**Error Responses:**
- **403**: Only available in mock mode

### Reset Rate Limit

**POST** `/api/auth/rate-limit/reset`

Reset rate limiting for specific IP/email combination (testing only).

**Request Body:**
```json
{
  "ip": "192.168.1.1",
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Rate limit reset successfully",
  "key": "192.168.1.1:a1b2c3d4"
}
```

**Rate Limited Response (429):**
```json
{
  "success": false,
  "error": "Too many login attempts. Please try again later.",
  "code": "RATE_LIMITED",
  "retryAfter": 12,
  "message": "For security reasons, please wait before attempting to log in again."
}
```

## OAuth Integration

### Get Available Platforms

**GET** `/api/integrations/platforms`

Get list of available OAuth platforms and their configuration.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "platforms": [
      {
        "platform": "twitter",
        "name": "Twitter",
        "enabled": true,
        "mockMode": true,
        "requirements": {
          "permissions": ["Read tweets", "Write tweets", "Access profile"],
          "notes": "Requires Twitter Developer account approval", 
          "estimatedTime": "5-10 minutes"
        },
        "scopes": ["read", "write", "offline.access"]
      }
    ],
    "mockMode": true,
    "totalPlatforms": 7,
    "enabledPlatforms": 7
  }
}
```

### Initiate OAuth Connection

**POST** `/api/integrations/{platform}/connect`

Start OAuth flow for a specific platform.

**Headers:** `Authorization: Bearer <access_token>`

**Path Parameters:**
- `platform`: One of `twitter`, `instagram`, `youtube`, `tiktok`, `linkedin`, `facebook`, `bluesky`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://mock-oauth.roastr.ai/twitter/authorize?client_id=mock_twitter_client&state=encoded-state",
    "state": "base64url-encoded-state-parameter",
    "platform": "twitter",
    "requirements": {
      "permissions": ["Read tweets", "Write tweets", "Access profile"],
      "notes": "Requires Twitter Developer account approval",
      "estimatedTime": "5-10 minutes"
    },
    "redirectUri": "http://localhost:3000/api/auth/twitter/callback",
    "mock": true
  }
}
```

**Already Connected Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "already_connected",
    "message": "Already connected to twitter",
    "connection": {
      "platform": "twitter",
      "connected": true,
      "connectedAt": 1642784400000,
      "user_info": { /* user data */ }
    }
  }
}
```

**Error Responses:**
- **400**: Unsupported platform or invalid parameters
- **401**: Authentication required

### OAuth Callback Handler

**GET** `/api/auth/{platform}/callback`

Handle OAuth callback from external providers.

**Query Parameters:**
- `code`: Authorization code from provider
- `state`: State parameter for validation
- `error`: Error from provider (optional)
- `error_description`: Error description (optional)

**Success Response (302):**
```
Location: /connections?success=true&platform=twitter&connected=true
```

**Error Response (302):**
```
Location: /connections?error=Invalid%20state%20parameter&platform=twitter
```

### Get User Connections

**GET** `/api/integrations/connections`

Get all OAuth connections for the current user.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "platform": "twitter",
        "connected": true,
        "status": "connected",
        "connectedAt": 1642784400000,
        "lastRefreshed": null,
        "expires_at": 1642788000000,
        "user_info": {
          "id": "mock_twitter_user_1642784400123",
          "username": "mock_twitter_user", 
          "name": "Mock Twitter User",
          "profile_image_url": "https://via.placeholder.com/400x400",
          "verified": false,
          "public_metrics": {
            "followers_count": 1234,
            "following_count": 567,
            "tweet_count": 890
          }
        },
        "requirements": {
          "permissions": ["Read tweets", "Write tweets"],
          "notes": "Twitter Developer account required",
          "estimatedTime": "5-10 minutes"
        }
      }
    ],
    "totalConnected": 1,
    "totalPlatforms": 7,
    "mockMode": true
  }
}
```

### Refresh Platform Tokens

**POST** `/api/integrations/{platform}/refresh`

Refresh OAuth tokens for a specific platform.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Tokens refreshed successfully for twitter",
    "platform": "twitter",
    "expires_at": 1642791600000,
    "refreshed": true
  }
}
```

**Error Responses:**
- **404**: No connection found for platform
- **400**: Token refresh failed

### Disconnect Platform

**POST** `/api/integrations/{platform}/disconnect`

Disconnect OAuth connection for a specific platform.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully disconnected from twitter",
    "platform": "twitter",
    "disconnected": true
  }
}
```

**Error Responses:**
- **404**: No connection found for platform
- **400**: Disconnection failed

### Reset Mock Connections

**POST** `/api/integrations/mock/reset`

Reset OAuth connections in mock/test mode.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body (Optional):**
```json
{
  "platform": "twitter"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Reset connection for twitter",
    "platform": "twitter"
  }
}
```

**Reset All Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Reset all connections",
    "resetCount": 3
  }
}
```

**Error Responses:**
- **403**: Only available in mock mode

## Style Profile Management

### Get Style Profile Status

**GET** `/api/style-profile/status`

Check if user has access to Style Profile feature and if profile exists.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "available": true,
    "featureEnabled": true,
    "profile": {
      "exists": true,
      "generatedAt": "2023-01-01T00:00:00Z",
      "languages": ["es", "en"],
      "totalItems": 250
    }
  }
}
```

**No Access Response (200):**
```json
{
  "success": true,
  "data": {
    "hasAccess": false,
    "available": false,
    "featureEnabled": true,
    "upgradeRequired": "Creator+ plan required for Style Profile feature"
  }
}
```

### Get Style Profile

**GET** `/api/style-profile`

Get user's complete style profile data.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "profiles": [
      {
        "lang": "es",
        "prompt": "Detailed Spanish style analysis...",
        "sources": {
          "twitter": 150,
          "instagram": 100
        },
        "createdAt": "2023-01-01T00:00:00Z",
        "metadata": {
          "totalItems": 250,
          "avgLength": 85,
          "dominantTone": "friendly",
          "styleType": "medium",
          "emojiUsage": 0.25
        },
        "examples": [
          "Example Spanish text 1",
          "Example Spanish text 2"
        ]
      }
    ],
    "totalItems": 250,
    "sources": {
      "twitter": 150,
      "instagram": 100
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "stats": {
      "languageCount": 1,
      "languages": ["es"],
      "totalSources": 2,
      "avgItemsPerLanguage": 250
    }
  }
}
```

**No Profile Response (200):**
```json
{
  "success": true,
  "data": {
    "available": false,
    "message": "No style profile generated yet. Connect social media accounts and generate profile first."
  }
}
```

**Error Responses:**
- **401**: Authentication required
- **403**: Creator+ plan required

### Generate Style Profile

**POST** `/api/style-profile/generate`

Generate new style profile from connected social media accounts.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "platforms": ["twitter", "instagram", "youtube"],
  "maxItemsPerPlatform": 300
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Style profile generated successfully",
    "profiles": [
      {
        "lang": "es",
        "prompt": "Generated Spanish style analysis...",
        "sources": {
          "twitter": 180,
          "instagram": 120
        },
        "createdAt": "2023-01-01T00:00:00Z",
        "metadata": {
          "totalItems": 300,
          "avgLength": 92,
          "dominantTone": "casual",
          "styleType": "medium"
        },
        "examples": [
          "Sample Spanish text 1",
          "Sample Spanish text 2"
        ]
      }
    ],
    "totalItems": 300,
    "sources": {
      "twitter": 180,
      "instagram": 120
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "stats": {
      "languageCount": 1,
      "languages": ["es"],
      "totalSources": 2,
      "avgItemsPerLanguage": 300
    }
  }
}
```

**Error Responses:**
- **400**: Missing platforms, no imported content, or insufficient content
- **401**: Authentication required  
- **403**: Creator+ plan required
- **503**: Feature temporarily disabled

### Preview Language Profile

**GET** `/api/style-profile/preview/{language}`

Preview style profile for a specific language.

**Headers:** `Authorization: Bearer <access_token>`

**Path Parameters:**
- `language`: Language code (e.g., `es`, `en`)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "profile": {
      "lang": "es",
      "prompt": "Spanish style profile prompt...",
      "sources": {
        "twitter": 150,
        "instagram": 100
      }
    },
    "preview": {
      "prompt": "Truncated preview of prompt...",
      "examples": [
        "Example 1",
        "Example 2"
      ],
      "metadata": {
        "totalItems": 250,
        "avgLength": 85,
        "dominantTone": "friendly",
        "styleType": "medium"
      },
      "sources": {
        "twitter": 150,
        "instagram": 100
      }
    }
  }
}
```

**Error Responses:**
- **404**: Language profile not found
- **401**: Authentication required
- **403**: Creator+ plan required

### Get Profile Statistics

**GET** `/api/style-profile/stats`

Get statistical overview of user's style profile.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "hasProfile": true,
    "languageCount": 2,
    "languages": ["es", "en"],
    "totalSources": 3,
    "avgItemsPerLanguage": 200,
    "generatedAt": "2023-01-01T00:00:00Z",
    "breakdown": {
      "es": {
        "itemCount": 250,
        "sources": ["twitter", "instagram"]
      },
      "en": {
        "itemCount": 150,
        "sources": ["youtube"]
      }
    }
  }
}
```

### Delete Style Profile

**DELETE** `/api/style-profile`

Delete user's style profile data.

**Headers:** `Authorization: Bearer <access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Style profile deleted successfully",
    "deleted": true
  }
}
```

**Error Responses:**
- **404**: No style profile found to delete
- **401**: Authentication required
- **403**: Creator+ plan required

## User Management

### Update User Profile

**PUT** `/api/auth/profile`

Update user profile information.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "John Smith",
  "bio": "Updated bio text",
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-user-id", 
    "email": "user@example.com",
    "name": "John Smith",
    "bio": "Updated bio text",
    "preferences": {
      "theme": "dark",
      "notifications": true
    },
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

### Reset Password

**POST** `/api/auth/reset-password`

Send password reset email to user.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "If an account with this email exists, a reset link has been sent.",
  "data": {
    "email": "user@example.com"
  }
}
```

### Update Password

**POST** `/api/auth/update-password`

Update user password using reset token.

**Request Body:**
```json
{
  "access_token": "password-reset-token",
  "password": "newsecurepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password updated successfully. You can now login with your new password.",
  "data": {
    "updated": true
  }
}
```

**Error Responses:**
- **400**: Missing token/password or password too short
- **400**: Invalid or expired reset token

## Admin Endpoints

### List All Users

**GET** `/api/auth/admin/users`

Get paginated list of all users with search and filtering.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Query Parameters:**
- `limit` (default: 20): Number of users per page
- `offset` (default: 0): Page offset
- `search`: Search term for email/name
- `plan`: Filter by plan type
- `active`: Filter by active status (true/false)
- `suspended`: Filter by suspended status (true/false)
- `sortBy` (default: created_at): Sort field
- `sortOrder` (default: desc): Sort order

**Example:** `/api/auth/admin/users?limit=50&search=john&plan=creator_plus&sortBy=created_at`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-user-id",
        "email": "user@example.com",
        "name": "John Doe",
        "plan": "creator_plus", 
        "is_admin": false,
        "active": true,
        "suspended": false,
        "created_at": "2023-01-01T00:00:00Z",
        "last_login": "2023-01-15T00:00:00Z",
        "organization": {
          "id": "org-uuid",
          "name": "User's Org"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 20,
      "offset": 0,
      "pages": 8
    },
    "filters": {
      "search": "",
      "plan": null,
      "active": null,
      "suspended": null
    }
  }
}
```

### Get User Details

**GET** `/api/auth/admin/users/{userId}`

Get detailed information about a specific user.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "plan": "creator_plus",
      "is_admin": false,
      "active": true,
      "suspended": false,
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-15T00:00:00Z",
      "last_login": "2023-01-15T00:00:00Z"
    },
    "stats": {
      "totalLogins": 45,
      "connectedPlatforms": 3,
      "styleProfileGenerated": true,
      "lastActivity": "2023-01-15T00:00:00Z"
    },
    "activity": [
      {
        "action": "login",
        "timestamp": "2023-01-15T00:00:00Z",
        "metadata": {
          "ip": "192.168.1.1",
          "user_agent": "Mozilla/5.0..."
        }
      }
    ]
  }
}
```

### Update User Plan

**POST** `/api/auth/admin/users/{userId}/plan`

Change user's subscription plan.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Request Body:**
```json
{
  "newPlan": "creator_plus"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-user-id",
      "email": "user@example.com",
      "plan": "creator_plus",
      "updated_at": "2023-01-01T00:00:00Z"
    },
    "message": "User plan updated successfully"
  }
}
```

### Suspend User

**POST** `/api/auth/admin/users/{userId}/suspend`

Suspend user account.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Request Body:**
```json
{
  "reason": "Terms of service violation"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-user-id",
      "suspended": true,
      "suspended_at": "2023-01-01T00:00:00Z",
      "suspended_by": "admin-user-id",
      "suspension_reason": "Terms of service violation"
    },
    "message": "User suspended successfully"
  }
}
```

### Unsuspend User

**POST** `/api/auth/admin/users/{userId}/unsuspend`

Remove suspension from user account.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-user-id",
      "suspended": false,
      "unsuspended_at": "2023-01-01T00:00:00Z",
      "unsuspended_by": "admin-user-id"
    },
    "message": "User unsuspended successfully"
  }
}
```

## Billing & Subscription

### Get Available Plans

**GET** `/api/plan/available`

Get list of available subscription plans.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "basic",
        "name": "Basic",
        "price": 0,
        "interval": "month",
        "features": {
          "basicRoasts": true,
          "styleProfile": false,
          "oauthConnections": false
        }
      },
      {
        "id": "creator_plus", 
        "name": "Creator+",
        "price": 2999,
        "interval": "month", 
        "features": {
          "basicRoasts": true,
          "styleProfile": true,
          "oauthConnections": true,
          "prioritySupport": true
        }
      }
    ]
  }
}
```

### Select Plan

**POST** `/api/plan/select`

Select or change user's subscription plan.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "plan": "creator_plus"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": "creator_plus",
    "effective_date": "2023-01-01T00:00:00Z",
    "features": {
      "styleProfile": true,
      "oauthConnections": true
    }
  }
}
```

## Error Handling

### Standard Error Format

All API errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional error details (debug mode only)",
  "timestamp": 1642784400000
}
```

### HTTP Status Codes

- **200**: Success
- **201**: Created successfully
- **400**: Bad request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Resource not found
- **429**: Too many requests (rate limited)
- **500**: Internal server error
- **503**: Service unavailable

### Common Error Codes

- `RATE_LIMITED`: Too many requests
- `INVALID_TOKEN`: Invalid or expired JWT
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `FEATURE_DISABLED`: Requested feature is disabled
- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `ALREADY_EXISTS`: Resource already exists
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

### Error Response Examples

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Access token required",
  "code": "AUTHENTICATION_REQUIRED",
  "timestamp": 1642784400000
}
```

**Rate Limited (429):**
```json
{
  "success": false,
  "error": "Too many login attempts. Please try again later.",
  "code": "RATE_LIMITED", 
  "retryAfter": 900,
  "message": "For security reasons, please wait before attempting to log in again.",
  "timestamp": 1642784400000
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "At least one platform is required for style profile generation",
  "code": "VALIDATION_ERROR",
  "example": {
    "platforms": ["twitter", "instagram"],
    "maxItemsPerPlatform": 300
  },
  "timestamp": 1642784400000
}
```

**Feature Access Error (403):**
```json
{
  "success": false,
  "error": "Style Profile feature requires Creator+ plan",
  "code": "FEATURE_ACCESS_DENIED",
  "upgrade": true,
  "requiredPlan": "creator_plus",
  "timestamp": 1642784400000
}
```

## Mock Mode Behavior

When `ENABLE_MOCK_MODE=true` or `NODE_ENV=test`, the API operates in mock mode:

### Authentication
- All JWT tokens are simulated and valid
- No actual Supabase calls are made
- User data is generated predictably

### OAuth Integration  
- All OAuth flows are simulated
- No external API calls to social platforms
- Consistent mock user data is returned
- State validation still works normally

### Style Profile
- Content analysis is simulated
- Realistic but deterministic results
- No actual AI API calls

### Rate Limiting
- Full rate limiting logic is active
- In-memory storage is used
- Metrics endpoint is accessible

### Feature Flags
- Mock mode overrides many feature flags
- Debug endpoints become available
- Additional testing utilities are enabled

### Mock Response Indicators

Mock responses include identification:

```json
{
  "success": true,
  "data": {
    "access_token": "mock-access-token-1642784400123",
    "mock": true,
    "mockMode": true
  }
}
```

### Testing Utilities

Additional endpoints available in mock mode:

- `POST /api/integrations/mock/reset` - Reset OAuth connections
- `GET /api/auth/rate-limit/metrics` - Get rate limiting stats  
- `POST /api/auth/rate-limit/reset` - Reset rate limits
- Various debug headers and extended error information

This comprehensive API provides robust functionality for multi-tenant social media integration with strong security, rate limiting, and developer-friendly testing capabilities.