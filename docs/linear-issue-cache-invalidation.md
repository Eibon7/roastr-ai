# Linear Issue Template: Analytics Cache Invalidation

**Title:** Analytics Cache Invalidation - Persona Changes

**Description:**

## Problem

Analytics dashboards currently show cached data that may not reflect the most up-to-date user persona configurations. When a user updates their persona (identity, intolerance, tolerance), the analytics cache retains old data until TTL expiration (5 minutes), leading to:

- Stale analytics data in dashboards
- Inaccurate persona-based insights
- Poor user experience when viewing analytics immediately after persona updates

## Solution

Implement automatic cache invalidation for analytics data when user persona changes. This ensures analytics dashboards always reflect the latest persona configurations without waiting for cache TTL expiration.

## Acceptance Criteria

- [ ] When a user updates their persona via POST /api/persona, analytics cache is invalidated for that user
- [ ] When a user deletes their persona via DELETE /api/persona, analytics cache is invalidated for that user
- [ ] When a user updates persona via PUT /api/user/roastr-persona, analytics cache is invalidated for that user
- [ ] Cache invalidation is efficient (only clears entries for the affected user, not all users)
- [ ] Cache invalidation does not block the persona update request (graceful error handling)
- [ ] Unit tests validate cache invalidation logic
- [ ] Implementation follows v2 patterns (modular service, proper logging)

## Technical Implementation

### Files Modified/Created

- `src/services/analyticsCacheService.js` (NEW) - Service for cache invalidation
- `src/routes/analytics.js` - Add userId tracking index and setCachedData enhancement
- `src/routes/persona.js` - Integrate cache invalidation in POST and DELETE endpoints
- `src/routes/user.js` - Integrate cache invalidation in PUT endpoint
- `tests/unit/routes/analytics-cache-invalidation.test.js` (NEW) - Unit tests

### Key Components

1. **userIdCacheIndex**: Map tracking which cache keys belong to which userId
2. **invalidateAnalyticsCache(userId)**: Function to clear all cache entries for a specific user
3. **Integration points**: Call invalidateAnalyticsCache after successful persona updates/deletions

## Testing

- Unit tests for cache invalidation logic
- Verify cache entries are removed for specific user only
- Verify other users' cache entries remain intact
- Verify graceful handling when cache service not initialized

## Notes

- This issue is separate from ROA-356 (Amplitude Identity Sync)
- Cache invalidation is backend-only (no frontend changes)
- Uses existing analytics cache infrastructure (no new cache system)


