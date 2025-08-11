# Billing System Guide

Complete guide for Stripe billing integration, webhook handling, and subscription management.

## Overview

The billing system provides:
- **Subscription Plans**: Free, Pro ($20/mo), Creator+ ($50/mo)
- **Stripe Integration**: Checkout sessions and customer portal
- **Webhook Processing**: Automatic subscription updates
- **Plan Gating**: Feature access control by subscription level
- **Graceful Degradation**: Works without Stripe keys (unavailable mode)

## Stripe Dashboard Configuration

### 1. Products and Prices

Create these products with recurring prices:

```
Product: Pro Plan
- Price ID: price_xxx (save to STRIPE_PRICE_PRO env var)
- Lookup Key: plan_pro
- Amount: $20.00 USD
- Recurring: Monthly

Product: Creator+ Plan  
- Price ID: price_yyy (save to STRIPE_PRICE_CREATOR env var)
- Lookup Key: plan_creator_plus
- Amount: $50.00 USD
- Recurring: Monthly
```

### 2. Customer Portal Settings

Enable these portal features:
- ✅ Subscription cancellation
- ✅ Subscription updates  
- ✅ Payment method updates
- ✅ Invoice history
- ✅ Billing information updates

### 3. Webhook Configuration

Create webhook endpoint:
```
URL: https://your-domain.com/webhooks/stripe
Events to send:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
```

Save the signing secret as `STRIPE_WEBHOOK_SECRET`.

## Environment Variables

Required for production:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs for Stripe redirects
STRIPE_SUCCESS_URL=https://your-domain.com/billing/success
STRIPE_CANCEL_URL=https://your-domain.com/billing/cancel
STRIPE_PORTAL_RETURN_URL=https://your-domain.com/billing

# Price lookup keys (optional, defaults provided)
STRIPE_PRICE_LOOKUP_PRO=plan_pro
STRIPE_PRICE_LOOKUP_CREATOR=plan_creator_plus
```

## Local Development

### 1. Install Stripe CLI
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login to your account
stripe login
```

### 2. Forward webhooks
```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to your .env file
```

### 3. Test with cards
Success: 4242424242424242
Decline: 4000000000000002

## API Endpoints

### POST /api/billing/create-checkout-session
**Request:**
```json
{
  "plan": "pro"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cs_test_123...",
    "url": "https://checkout.stripe.com/pay/cs_test_123..."
  }
}
```

### POST /api/billing/create-portal-session
**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/bps_123..."
  }
}
```