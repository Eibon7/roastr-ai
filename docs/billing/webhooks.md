# Stripe Webhooks Documentation

> **Issue #169** - Backend Webhooks Stripe mínimos (alta/cambio/cancelación)

## Overview

The Stripe Webhooks system provides automated processing of subscription lifecycle events with comprehensive idempotency, error handling, and customer mapping. It automatically updates user entitlements based on Stripe Price metadata when subscriptions are created, updated, or canceled.

## Architecture

### Core Components

1. **StripeWebhookService** - Main service for webhook event processing
2. **Webhook Events Table** - Database table for idempotency and audit trail
3. **Customer Mapping** - Links Stripe customers to user accounts
4. **Entitlements Integration** - Automatic entitlements updates
5. **Admin Tools** - Statistics and cleanup functionality

### Webhook Flow

```
Stripe Event → Signature Verification → Idempotency Check → Event Processing → Entitlements Update → Database Recording
```

## Supported Events

### Core Events (Required)

| Event Type                      | Description                          | Action Taken                                 |
| ------------------------------- | ------------------------------------ | -------------------------------------------- |
| `checkout.session.completed`    | User completes subscription purchase | Set initial entitlements from Price metadata |
| `customer.subscription.created` | New subscription created             | Update entitlements                          |
| `customer.subscription.updated` | Subscription plan changed            | Refresh entitlements from new Price          |
| `customer.subscription.deleted` | Subscription canceled                | Reset to free plan entitlements              |

### Optional Events (Informational)

| Event Type                  | Description                    | Action Taken                       |
| --------------------------- | ------------------------------ | ---------------------------------- |
| `invoice.payment_succeeded` | Payment processed successfully | Log success, update billing status |
| `invoice.payment_failed`    | Payment failed                 | Log failure for monitoring         |

## Database Schema

### webhook_events Table

```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'received',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    event_data JSONB NOT NULL,
    processing_result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    customer_id VARCHAR(255),
    subscription_id VARCHAR(255),
    account_id UUID REFERENCES users(id)
);
```

### Key Features

- **Idempotency**: Prevents duplicate processing using `stripe_event_id`
- **Audit Trail**: Complete record of all webhook events and results
- **Error Tracking**: Failed events with error messages and retry counts
- **Customer Mapping**: Links events to users for easier debugging

## Webhook Endpoint

### POST /api/billing/webhooks/stripe

The main webhook endpoint that receives events from Stripe.

**Request Requirements:**

- `stripe-signature` header with valid signature
- Raw JSON body (not parsed by Express)
- Content-Type: `application/json`

**Response Format:**

```json
{
  "received": true,
  "processed": true,
  "idempotent": false,
  "message": "Checkout completed and entitlements updated"
}
```

## Signature Verification

### Security Implementation

```javascript
// Verify webhook signature using Stripe's library
const event = stripeWrapper.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### Environment Variables

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_endpoint_secret_here
```

⚠️ **Critical**: Always use the webhook endpoint secret, not your API secret.

## Idempotency System

### How It Works

1. **Check Processing Status**: Query `webhook_events` table by `stripe_event_id`
2. **Start Processing**: Record event with `status='processing'`
3. **Complete Processing**: Update with results and `status='completed'`
4. **Handle Failures**: Update with error and `status='failed'`

### Database Functions

```sql
-- Check if event already processed
SELECT is_webhook_event_processed('evt_1234567890');

-- Start processing with idempotency
SELECT start_webhook_event_processing(
    'evt_1234567890',
    'checkout.session.completed',
    '{"data": "..."}',
    'cus_customer123',
    'sub_subscription123'
);

-- Complete processing
SELECT complete_webhook_event_processing(
    'evt_1234567890',
    true, -- success
    '{"entitlements_updated": true}',
    null, -- no error
    'user-uuid-here'
);
```

## Event Processing

### Checkout Session Completed

**Trigger**: User completes subscription purchase
**Actions:**

1. Extract `user_id` from session metadata
2. Update user's `stripe_customer_id`
3. Retrieve subscription and price details
4. Set entitlements from Price metadata

```javascript
// Example session metadata requirement
{
    "metadata": {
        "user_id": "auth0|507f1f77bcf86cd799439011"
    }
}
```

### Subscription Updated

**Trigger**: Plan changes, status changes, etc.
**Actions:**

1. Find user by `stripe_customer_id`
2. Extract price from subscription items
3. Update entitlements from new Price metadata
4. Handle special cases (canceled, incomplete)

### Subscription Deleted

**Trigger**: Subscription canceled or expired
**Actions:**

1. Find user by `stripe_customer_id`
2. Reset entitlements to free plan
3. Log cancellation reason

### Payment Events

**Trigger**: Payment succeeded/failed
**Actions:**

1. Find user by `stripe_customer_id`
2. Log payment result for monitoring
3. Could trigger notifications (future enhancement)

## Customer Mapping

### User ↔ Stripe Customer Linking

The system maintains the relationship between users and Stripe customers:

```sql
-- Users table includes Stripe customer ID
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
```

**Mapping Process:**

1. **Checkout Completion**: Links user to customer during first purchase
2. **Customer Lookup**: All subsequent events use customer ID to find user
3. **Error Handling**: Events for unknown customers are logged but not failed

## Error Handling

### Failure Scenarios

1. **Signature Verification Failed** → HTTP 400, processing stops
2. **User Not Found** → Log warning, continue (for payment events)
3. **Missing Price ID** → Handle gracefully, may reset to free plan
4. **Entitlements Update Failed** → Log error but complete webhook processing
5. **Database Errors** → Retry up to 3 times, then mark as failed

### Always Return HTTP 200

```javascript
// Always return 200 to prevent Stripe retries
res.json({
  received: true,
  processed: result.success,
  error: result.error || null
});
```

**Why?** Stripe will retry failed webhooks up to 3 days. Since we handle our own retries and idempotency, we acknowledge receipt even on processing failures.

## Configuration

### Stripe Dashboard Setup

1. **Create Webhook Endpoint**
   - URL: `https://your-domain.com/api/billing/webhooks/stripe`
   - Events to send: Select required events listed above

2. **Get Webhook Secret**
   - Copy the webhook endpoint secret (starts with `whsec_`)
   - Add to environment as `STRIPE_WEBHOOK_SECRET`

3. **Test Webhook**
   - Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe`
   - Or send test events from Stripe Dashboard

### Environment Variables

```bash
# Required
STRIPE_SECRET_KEY=sk_live_or_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_endpoint_secret

# Optional (for enhanced features)
STRIPE_PRICE_LOOKUP_PRO=pro_monthly
STRIPE_PRICE_LOOKUP_CREATOR=creator_plus_monthly
```

## Monitoring and Administration

### Webhook Statistics

**GET /api/billing/webhook-stats** (Admin only)

```json
{
  "success": true,
  "data": {
    "period_days": 7,
    "statistics": [
      {
        "event_type": "checkout.session.completed",
        "total_events": 100,
        "completed_events": 95,
        "failed_events": 5,
        "success_rate": 95.0
      }
    ]
  }
}
```

### Webhook Cleanup

**POST /api/billing/webhook-cleanup** (Admin only)

```json
{
  "days": 30
}
```

Removes webhook events older than specified days to keep database clean.

### Database Functions for Monitoring

```sql
-- Get webhook statistics for last 24 hours
SELECT * FROM get_webhook_stats(NOW() - INTERVAL '24 hours');

-- Cleanup events older than 30 days
SELECT cleanup_webhook_events(30);

-- Check failed events
SELECT * FROM webhook_events
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

## Testing

### Unit Tests

```bash
# Run webhook service tests
npm test -- tests/unit/services/stripeWebhookService.test.js

# Run integration tests
npm test -- tests/integration/stripeWebhooksFlow.test.js
```

### Test with Stripe CLI

```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Manual Testing

```bash
# Create test webhook payload
curl -X POST http://localhost:3000/api/billing/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=timestamp,v1=signature" \
  -d '{
    "id": "evt_test_webhook",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_session",
        "customer": "cus_test123",
        "subscription": "sub_test123",
        "metadata": {
          "user_id": "test-user-123"
        }
      }
    }
  }'
```

## Troubleshooting

### Common Issues

**Issue**: Webhooks not being received
**Solution**:

- Check webhook endpoint URL in Stripe Dashboard
- Verify HTTPS certificate is valid
- Check server logs for connection issues

**Issue**: Signature verification failed
**Solution**:

- Verify `STRIPE_WEBHOOK_SECRET` environment variable
- Ensure using webhook endpoint secret, not API secret
- Check that body is raw (not parsed by middleware)

**Issue**: Events processed multiple times
**Solution**:

- Check idempotency implementation
- Verify `stripe_event_id` uniqueness constraint
- Review database function `is_webhook_event_processed`

**Issue**: User entitlements not updating
**Solution**:

- Verify Price metadata is configured in Stripe
- Check EntitlementsService integration
- Review webhook processing logs

### Debug Commands

```javascript
// Check webhook event processing status
const result = await supabaseServiceClient
  .from('webhook_events')
  .select('*')
  .eq('stripe_event_id', 'evt_1234567890')
  .single();

// Get recent failed webhook events
const { data: failedEvents } = await supabaseServiceClient
  .from('webhook_events')
  .select('*')
  .eq('status', 'failed')
  .order('created_at', { ascending: false })
  .limit(10);

// Check user's Stripe customer mapping
const { data: user } = await supabaseServiceClient
  .from('users')
  .select('id, stripe_customer_id, plan')
  .eq('id', 'user-uuid')
  .single();
```

## Security Considerations

### Webhook Security

- ✅ **Always verify signatures** before processing
- ✅ **Use HTTPS endpoints** for production
- ✅ **Rate limiting** on webhook endpoint (future enhancement)
- ✅ **Input validation** on all event data
- ✅ **Sanitize metadata** before database storage

### Data Protection

- **PII Handling**: Event data may contain customer information
- **Retention Policy**: Cleanup old events automatically
- **Access Control**: Admin-only access to webhook statistics
- **Audit Trail**: Complete record of all webhook processing

## Performance Optimization

### Database Optimization

```sql
-- Indexes for efficient queries
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_status_created ON webhook_events(status, created_at);
CREATE INDEX idx_webhook_events_customer_id ON webhook_events(customer_id);
```

### Processing Optimization

- **Idempotency**: Prevents duplicate work
- **Async Processing**: Webhooks return quickly, processing continues
- **Batching**: Database functions minimize round trips
- **Connection Pooling**: Efficient database connections

## Migration Guide

### From Previous Webhook Implementation

1. **Run Database Migration**

   ```bash
   psql -d your_database -f database/migrations/003_add_webhook_events_table.sql
   ```

2. **Update Environment Variables**

   ```bash
   # Add webhook secret if not already present
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

3. **Update Stripe Dashboard**
   - Ensure webhook endpoint is pointing to `/api/billing/webhooks/stripe`
   - Verify all required events are selected
   - Test webhook endpoint

4. **Monitor Migration**

   ```bash
   # Check webhook processing stats
   curl -H "Authorization: Bearer admin-token" \
        http://localhost:3000/api/billing/webhook-stats
   ```

5. **Cleanup Old Events** (Optional)
   ```bash
   # Remove old events after successful migration
   curl -X POST -H "Authorization: Bearer admin-token" \
        -H "Content-Type: application/json" \
        -d '{"days": 30}' \
        http://localhost:3000/api/billing/webhook-cleanup
   ```

---

## Summary

The Stripe Webhooks system provides:

✅ **Idempotent Processing** - Duplicate events handled safely  
✅ **Signature Verification** - Security against forged requests  
✅ **Customer Mapping** - Automatic linking of Stripe customers to users  
✅ **Entitlements Integration** - Automatic updates from Price metadata  
✅ **Comprehensive Logging** - Full audit trail of all events  
✅ **Error Handling** - Graceful failure handling and recovery  
✅ **Admin Tools** - Statistics and maintenance functionality  
✅ **High Performance** - Optimized database queries and processing

The system meets all requirements from Issue #169 and provides a robust foundation for subscription lifecycle management.
