# Plan Limits Configuration System

## Issue #99: Database-Based Plan Limit Configuration

This document describes the implementation of the database-based plan limits configuration system that replaces hardcoded limits throughout the codebase.

## Overview

Previously, plan limits were hardcoded in multiple services (`workerNotificationService.js`, `costControl.js`, `authService.js`, etc.). This made it difficult to modify limits without deploying new code. The new system stores all plan limits in a database table, allowing administrators to modify limits through API endpoints.

## Components

### 1. Database Schema (`/database/migrations/013_plan_limits_configuration.sql`)

Created a new `plan_limits` table with the following structure:
- `plan_id`: References the plans table (free, pro, creator_plus, custom)
- Response limits: `max_roasts`, `monthly_responses_limit`
- Platform limits: `max_platforms`, `integrations_limit`
- Feature flags: `shield_enabled`, `custom_prompts`, `priority_support`, etc.
- Additional limits: `monthly_tokens_limit`, `daily_api_calls_limit`
- Audit fields: `created_at`, `updated_at`, `updated_by`

Also includes:
- Audit log table (`plan_limits_audit`) for tracking changes
- Database functions for retrieving and checking limits
- Row Level Security policies (admins only can modify)

### 2. Plan Limits Service (`/src/services/planLimitsService.js`)

Central service for managing plan limits:
- **Caching**: 5-minute in-memory cache to reduce database queries
- **Methods**:
  - `getPlanLimits(planId)`: Get limits for a specific plan
  - `getAllPlanLimits()`: Get all plan limits at once
  - `updatePlanLimits(planId, updates, updatedBy)`: Update limits (admin only)
  - `checkLimit(planId, limitType, currentUsage)`: Check if limit is exceeded
  - `clearCache()`: Force cache refresh

### 3. Service Updates

Updated the following services to use `planLimitsService`:

#### `workerNotificationService.js`
- Changed `getPlanLimits()` to async method
- Added fallback mechanism for database failures
- Maintains backward compatibility

#### `costControl.js`
- Updated `upgradePlan()` to fetch limits from database
- Updated `canUseShield()` to use database limits
- Removed hardcoded plan configuration

#### `authService.js`
- Changed `getPlanLimits()` to async method
- Added plan ID mapping for backward compatibility (basic → free)
- Maintains original response format

#### `analytics.js`
- Updated `getPlanLimits()` to async method
- Added static rate limits for express-rate-limit compatibility
- Maps database limits to analytics-specific format

### 4. Admin API Endpoints (`/src/routes/admin.js`)

New endpoints for managing plan limits:

- **GET /api/admin/plan-limits**
  - Returns all plan limits configurations
  - No parameters required

- **GET /api/admin/plan-limits/:planId**
  - Returns limits for a specific plan
  - Parameters: `planId` (free, pro, creator_plus, custom)

- **PUT /api/admin/plan-limits/:planId**
  - Updates limits for a specific plan
  - Requires admin authentication
  - Body: JSON object with limit updates
  - Validates allowed fields and plan IDs

- **POST /api/admin/plan-limits/refresh-cache**
  - Forces cache refresh
  - Useful after direct database updates

## Usage Examples

### Viewing Current Limits
```bash
# Get all plan limits
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.roastr.ai/api/admin/plan-limits

# Get specific plan limits
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.roastr.ai/api/admin/plan-limits/pro
```

### Updating Plan Limits
```bash
# Update Pro plan limits
curl -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyResponsesLimit": 2000,
    "maxPlatforms": 10,
    "monthlyTokensLimit": 200000
  }' \
  https://api.roastr.ai/api/admin/plan-limits/pro
```

### Refreshing Cache
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.roastr.ai/api/admin/plan-limits/refresh-cache
```

## Migration Notes

1. **Default Values**: The migration includes INSERT statements with current hardcoded values
2. **Backward Compatibility**: Services maintain fallback to hardcoded values if database is unavailable
3. **Plan ID Mapping**: The system maps old plan names (basic) to new ones (free)
4. **Caching**: 5-minute cache reduces database load while allowing reasonably quick updates

## Benefits

1. **Flexibility**: Modify limits without code deployment
2. **Auditability**: All changes are logged with timestamps and user IDs
3. **Performance**: Caching layer prevents excessive database queries
4. **Consistency**: Single source of truth for all plan limits
5. **Security**: Row Level Security ensures only admins can modify limits

## Testing

The following should be tested:
1. Service functionality with database limits
2. Fallback behavior when database is unavailable
3. Cache expiration and refresh
4. Admin API endpoints with proper authentication
5. Audit log creation on updates

## Future Enhancements

1. **Web UI**: Admin panel for managing limits
2. **Webhooks**: Notify services when limits change
3. **A/B Testing**: Support for experimental limit configurations
4. **Granular Limits**: Per-organization limit overrides