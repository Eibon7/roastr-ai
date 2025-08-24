# Notification Endpoints Rate Limiting

**Issue #97 Implementation**

## Overview

Rate limiting has been implemented for all notification endpoints to prevent abuse and ensure system stability. The implementation follows the existing rate limiting patterns used throughout the application.

## Endpoints Protected

All notification endpoints now have rate limiting applied:

- `GET /api/notifications` - List user notifications
- `GET /api/notifications/count` - Get unread count  
- `GET /api/notifications/banners` - Get banner notifications
- `POST /api/notifications/:id/mark-read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Archive notification

## Rate Limits

### General Notification Endpoints
- **Limit**: 60 requests per minute per IP/user
- **Applies to**: GET endpoints (list, count, banners)
- **Window**: 1 minute

### Notification Marking Endpoints  
- **Limit**: 30 requests per minute per IP/user
- **Applies to**: POST endpoints (mark-read, mark-all-read)
- **Window**: 1 minute

### Notification Deletion Endpoints
- **Limit**: 20 requests per minute per IP/user  
- **Applies to**: DELETE endpoints (archive)
- **Window**: 1 minute

## Configuration

Rate limits can be configured via environment variables:

```bash
# General notification endpoints
NOTIFICATION_RATE_WINDOW_MS=60000  # 1 minute
NOTIFICATION_RATE_MAX=60           # 60 requests

# Marking endpoints
NOTIFICATION_MARK_RATE_WINDOW_MS=60000  # 1 minute
NOTIFICATION_MARK_RATE_MAX=30           # 30 requests

# Deletion endpoints
NOTIFICATION_DELETE_RATE_WINDOW_MS=60000  # 1 minute
NOTIFICATION_DELETE_RATE_MAX=20           # 20 requests
```

## Rate Limiting Key Generation

Rate limiting uses a combination of IP address and user ID:
- **Format**: `notification_type:${ip}:${userId}`
- **Examples**: 
  - `notification:127.0.0.1:user-123`
  - `notification_mark:127.0.0.1:user-123`
  - `notification_delete:127.0.0.1:user-123`

## Error Responses

When rate limit is exceeded, endpoints return:

```json
{
  "success": false,
  "error": "Too many notification requests. Please slow down.",
  "code": "NOTIFICATION_RATE_LIMITED",
  "retryAfter": 45
}
```

**HTTP Status**: `429 Too Many Requests`

**Headers Include**:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in window
- `RateLimit-Reset`: Time when window resets

## Logging

Rate limit exceeded events are logged with the following information:
- User IP address
- User ID (first 8 characters + ...)
- Endpoint path
- HTTP method
- User agent

Example log entry:
```
WARN: Notification endpoint rate limit exceeded {
  ip: "192.168.1.100",
  userId: "abc12345...",
  endpoint: "/api/notifications",
  method: "GET",
  userAgent: "Mozilla/5.0..."
}
```

## Bypass Options

Rate limiting can be disabled via:
- **Test Environment**: Automatically disabled when `NODE_ENV=test`
- **Feature Flag**: Set `DISABLE_RATE_LIMIT=true` via flags configuration

## Implementation Details

### Files Created/Modified

1. **New Middleware**: `src/middleware/notificationRateLimiter.js`
   - Contains all rate limiting logic
   - Configurable rate limits
   - Proper error handling and logging

2. **Updated Routes**: `src/routes/notifications.js`
   - Applied appropriate rate limiters to each endpoint
   - Maintains existing functionality

3. **Test Coverage**: 
   - `tests/unit/middleware/notificationRateLimiter.test.js`
   - `tests/unit/routes/notifications-rate-limit.test.js`

### Dependencies

Uses the existing `express-rate-limit` library (v8.0.1) for consistent rate limiting behavior across the application.

## Security Considerations

- **IP + User ID**: Prevents both anonymous abuse and authenticated user abuse
- **Different Limits**: More sensitive operations have stricter limits
- **Comprehensive Logging**: All rate limit violations are logged for monitoring
- **Graceful Degradation**: Rate limiting can be disabled if needed without breaking functionality

## Monitoring

Rate limiting events can be monitored through:
- Application logs (WARN level for rate limit exceeded)
- Rate limit headers in HTTP responses
- Custom metrics (if implemented via logging aggregation)

## Testing

Comprehensive test suite covers:
- ✅ Rate limiting middleware functionality
- ✅ Integration with notification endpoints
- ✅ Configuration options
- ✅ Error handling
- ✅ Key generation
- ✅ Environment-based skipping
- ✅ Logging behavior

All tests pass and maintain backward compatibility with existing notification functionality.