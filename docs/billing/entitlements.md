# Entitlements System Documentation

> **Issue #168** - Backend Entitlements per plan desde Stripe + límites de uso

## Overview

The Entitlements System is a comprehensive solution that manages user plan entitlements and usage limits based on Stripe Price metadata. It provides automatic enforcement of usage limits, feature access control, and monthly usage tracking with seamless integration into the existing billing infrastructure.

## Architecture

### Core Components

1. **EntitlementsService** - Manages entitlements from Stripe Price metadata
2. **UsageEnforcementMiddleware** - Express middleware for limit enforcement
3. **Database Schema** - Two new tables for entitlements and usage tracking
4. **Monthly Reset Cron Job** - Automated monthly usage counter resets
5. **Webhook Integration** - Automatic entitlements updates from Stripe events

### Data Flow

```
Stripe Subscription Created/Updated
    ↓
Webhook Event Received
    ↓
EntitlementsService.setEntitlementsFromStripePrice()
    ↓
Price Metadata Extracted & Stored in account_entitlements
    ↓
API Request with Usage Middleware
    ↓
check_usage_limit() - Database Function
    ↓
Request Allowed/Denied + Usage Incremented
    ↓
Monthly Cron Job Resets usage_counters
```

## Database Schema

### account_entitlements Table

Stores the source of truth for user entitlements derived from Stripe Price metadata.

```sql
CREATE TABLE account_entitlements (
    account_id UUID PRIMARY KEY REFERENCES users(id),
    analysis_limit_monthly INTEGER NOT NULL DEFAULT 100,
    roast_limit_monthly INTEGER NOT NULL DEFAULT 100,
    model TEXT DEFAULT 'gpt-3.5-turbo',
    shield_enabled BOOLEAN DEFAULT FALSE,
    rqc_mode TEXT DEFAULT 'basic',
    stripe_price_id TEXT,
    stripe_product_id TEXT,
    plan_name TEXT NOT NULL DEFAULT 'free',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### usage_counters Table

Tracks monthly usage with automatic period management.

```sql
CREATE TABLE usage_counters (
    account_id UUID PRIMARY KEY REFERENCES users(id),
    analysis_used INTEGER DEFAULT 0,
    roasts_used INTEGER DEFAULT 0,
    period_start DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW())::DATE,
    period_end DATE NOT NULL DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')::DATE,
    last_analysis_at TIMESTAMPTZ,
    last_roast_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Stripe Price Metadata Format

Configure your Stripe Prices with the following metadata fields:

```json
{
  "analysis_limit_monthly": "2000",
  "roast_limit_monthly": "1000",
  "model": "gpt-4",
  "shield_enabled": "true",
  "rqc_mode": "advanced",
  "plan_name": "pro"
}
```

### Supported Values

- **analysis_limit_monthly**: Integer or "-1" for unlimited
- **roast_limit_monthly**: Integer or "-1" for unlimited
- **model**: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`
- **shield_enabled**: `"true"` or `"false"`
- **rqc_mode**: `basic`, `advanced`, `premium`
- **plan_name**: `free`, `starter`, `pro`, `creator_plus`, `custom`

## Plan Defaults

When Stripe metadata is missing, the system applies defaults based on the lookup key or product name:

| Plan     | Analysis Limit | Roast Limit | Model         | Shield | RQC Mode |
| -------- | -------------- | ----------- | ------------- | ------ | -------- |
| Free     | 100            | 100         | gpt-3.5-turbo | false  | basic    |
| Starter  | 500            | 500         | gpt-3.5-turbo | false  | basic    |
| Pro      | 2000           | 1000        | gpt-4         | true   | advanced |
| Creator+ | unlimited      | unlimited   | gpt-4         | true   | premium  |
| Custom   | unlimited      | unlimited   | gpt-4         | true   | premium  |

## API Usage

### EntitlementsService

```javascript
const EntitlementsService = require('./src/services/entitlementsService');
const entitlementsService = new EntitlementsService();

// Set entitlements from Stripe Price
const result = await entitlementsService.setEntitlementsFromStripePrice(userId, stripePriceId, {
  metadata: { updated_from: 'webhook' }
});

// Set entitlements directly (for free plans)
await entitlementsService.setEntitlements(userId, {
  analysis_limit_monthly: 100,
  roast_limit_monthly: 100,
  plan_name: 'free'
});

// Check usage limits
const limitCheck = await entitlementsService.checkUsageLimit(userId, 'analysis');
if (!limitCheck.allowed) {
  // Handle limit exceeded
}

// Increment usage
await entitlementsService.incrementUsage(userId, 'roasts', 1);

// Get usage summary
const summary = await entitlementsService.getUsageSummary(userId);
```

### Usage Middleware

```javascript
const { UsageEnforcementMiddleware } = require('./src/middleware/usageEnforcement');

// Apply to routes
app.post('/api/analyze', ...UsageEnforcementMiddleware.forAnalysis(1), (req, res) => {
  // Analysis logic here
  res.json({ success: true, result: 'analysis complete' });
});

app.post('/api/roast', ...UsageEnforcementMiddleware.forRoasts(1), (req, res) => {
  // Roast generation logic here
  res.json({ success: true, result: 'roast generated' });
});

// Feature requirements
app.get('/api/shield-feature', UsageEnforcementMiddleware.requireShield(), (req, res) => {
  // Shield feature logic
});

app.get('/api/premium-feature', UsageEnforcementMiddleware.requirePremiumRQC(), (req, res) => {
  // Premium feature logic
});
```

## Error Responses

The middleware returns semantic error codes for proper UI handling:

### Limit Reached (429)

```json
{
  "success": false,
  "error": "Monthly analysis limit reached",
  "code": "LIMIT_REACHED",
  "details": {
    "action_type": "analysis",
    "used": 1000,
    "limit": 1000,
    "period_end": "2024-01-31",
    "unlimited": false
  }
}
```

### Feature Not Available (403)

```json
{
  "success": false,
  "error": "Feature 'shield_enabled' not available in your plan",
  "code": "FEATURE_NOT_AVAILABLE",
  "details": {
    "feature": "shield_enabled",
    "current_plan": "free",
    "required_value": true,
    "actual_value": false
  }
}
```

### Usage Check Failed (500)

```json
{
  "success": false,
  "error": "Usage validation failed",
  "code": "USAGE_CHECK_FAILED"
}
```

## Monthly Usage Reset

The system includes an automated cron job that resets usage counters monthly:

```javascript
const { initializeMonthlyReset } = require('./src/cron/monthlyUsageReset');

// Start the cron job (runs at UTC 00:00 on day 1 of each month)
initializeMonthlyReset();

// Manual reset for testing
const { monthlyUsageResetJob } = require('./src/cron/monthlyUsageReset');
await monthlyUsageResetJob.executeReset();
```

### Cron Schedule

- **Schedule**: `0 0 1 * *` (UTC 00:00 on the 1st of every month)
- **Timezone**: UTC
- **Function**: `reset_monthly_usage_counters()`
- **Monitoring**: Comprehensive logging with success/failure notifications

## Webhook Integration

The entitlements system is automatically integrated with Stripe webhooks:

### Supported Events

- **checkout.session.completed** - Updates entitlements after successful subscription
- **customer.subscription.updated** - Updates entitlements when subscription changes
- **customer.subscription.deleted** - Resets to free plan entitlements

### Webhook Processing Flow

1. Stripe webhook received
2. Webhook signature verified
3. User ID extracted from metadata
4. Price ID retrieved from subscription
5. `EntitlementsService.setEntitlementsFromStripePrice()` called
6. Entitlements updated within 60 seconds
7. Fallback to free plan if Stripe fails

## Database Functions

### check_usage_limit(user_id, usage_type)

Checks if user can perform an action based on current usage and limits.

```sql
SELECT check_usage_limit('user-123', 'analysis'); -- Returns boolean
```

### increment_usage(user_id, usage_type, increment_by)

Increments usage counter and handles monthly period resets.

```sql
SELECT increment_usage('user-123', 'roasts', 1); -- Returns boolean
```

### reset_monthly_usage_counters()

Resets all usage counters for accounts past their billing period.

```sql
SELECT reset_monthly_usage_counters(); -- Returns number of accounts reset
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Entitlements Update Success Rate** - % of successful Stripe webhook processing
2. **Usage Limit Hit Rate** - % of requests blocked by limits
3. **Monthly Reset Success** - Success rate of monthly counter resets
4. **Database Function Performance** - Response times for usage checks
5. **Plan Distribution** - User count by plan type

### Log Events

```javascript
// Entitlements updated
logger.info('Entitlements updated from Stripe Price', {
  userId,
  stripePriceId,
  planName: 'pro',
  analysisLimit: 2000
});

// Usage limit exceeded
logger.warn('Usage limit exceeded', {
  userId,
  actionType: 'analysis',
  used: 1000,
  limit: 1000
});

// Monthly reset completed
logger.info('Monthly usage counter reset completed', {
  accounts_reset: 150,
  duration_ms: 2500
});
```

## Testing

### Unit Tests

```bash
# Run EntitlementsService tests
npm test -- tests/unit/services/entitlementsService.test.js

# Run middleware tests
npm test -- tests/unit/middleware/usageEnforcement.test.js
```

### Integration Tests

```bash
# Run complete entitlements flow tests
npm test -- tests/integration/entitlementsFlow.test.js
```

### Manual Testing

```bash
# Run monthly reset manually (be careful - this affects real data)
node src/cron/monthlyUsageReset.js

# Test specific plan entitlements
curl -X POST http://localhost:3000/api/analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"test analysis"}'
```

## Security Considerations

### Row Level Security (RLS)

All entitlements and usage tables enforce RLS:

- Users can only access their own entitlements and usage
- Service role can manage all records for system operations
- Admin users have no special access (use service role for admin operations)

### Input Validation

- All usage types validated (`'analysis'`, `'roasts'`)
- Stripe Price metadata sanitized before storage
- Database constraints prevent negative limits
- Period validation ensures valid date ranges

### Error Handling

- Stripe API failures trigger fallback to free plan entitlements
- Database errors fail safe (deny access on error)
- Usage increment failures don't block API responses
- Comprehensive error logging for debugging

## Troubleshooting

### Common Issues

**Issue**: Entitlements not updating after subscription change
**Solution**: Check Stripe webhook endpoint configuration and logs

**Issue**: Users hitting limits unexpectedly  
**Solution**: Verify usage counters and check for period reset issues

**Issue**: Monthly reset not running
**Solution**: Check cron job status and server timezone configuration

**Issue**: Feature access denied for paid users
**Solution**: Verify entitlements table has correct feature flags

### Debug Commands

```javascript
// Check user entitlements
const entitlements = await entitlementsService.getEntitlements(userId);
console.log('Entitlements:', entitlements);

// Check current usage
const usage = await entitlementsService.getCurrentUsage(userId);
console.log('Usage:', usage);

// Get usage summary
const summary = await entitlementsService.getUsageSummary(userId);
console.log('Summary:', JSON.stringify(summary, null, 2));

// Check cron job status
const { monthlyUsageResetJob } = require('./src/cron/monthlyUsageReset');
console.log('Cron status:', monthlyUsageResetJob.getStatus());
```

## Migration Guide

### From Existing System

1. **Run Database Migration**

   ```bash
   psql -d your_database -f database/migrations/002_add_entitlements_and_usage_tracking.sql
   ```

2. **Update Application Code**

   ```javascript
   // Add to your main app.js
   const { initializeUsageEnforcement } = require('./src/middleware/usageEnforcement');
   const { initializeMonthlyReset } = require('./src/cron/monthlyUsageReset');

   initializeUsageEnforcement(app);
   initializeMonthlyReset();
   ```

3. **Configure Stripe Prices**
   - Add metadata to existing Stripe Prices
   - Test webhook endpoint receives events
   - Verify entitlements update correctly

4. **Add Middleware to Routes**

   ```javascript
   // Replace manual limit checks with middleware
   app.post('/api/analyze', ...UsageEnforcementMiddleware.forAnalysis(1), analyzeController);
   ```

5. **Test and Monitor**
   - Run integration tests
   - Monitor logs for errors
   - Verify usage limits working correctly

## Performance Considerations

### Database Optimization

- Indexes on frequently queried fields
- Efficient RLS policies
- Optimized database functions
- Proper connection pooling

### Caching Strategy

The system is designed for real-time accuracy over performance:

- No caching of usage data (always fresh from database)
- Entitlements cached briefly (updated via webhooks)
- Database functions optimized for speed

### Scalability

- Usage checks use database functions (minimal application logic)
- Monthly resets handled by single efficient SQL operation
- Webhook processing is asynchronous and fault-tolerant
- Horizontal scaling supported (stateless design)

---

## Summary

The Entitlements System provides a complete solution for managing user plan limits and feature access based on Stripe subscriptions. Key benefits:

✅ **Automatic** - Entitlements update within 60s of Stripe events  
✅ **Reliable** - Fallback mechanisms and comprehensive error handling  
✅ **Scalable** - Database-driven with minimal application overhead  
✅ **Flexible** - Supports unlimited plans and custom metadata  
✅ **Secure** - RLS protection and fail-safe error handling  
✅ **Testable** - Full unit and integration test coverage

The system meets all requirements from Issue #168 and provides a solid foundation for future plan management needs.
