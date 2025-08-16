# billing.test.js

**Path:** `tests/unit/routes/billing.test.js`

## billing Tests

### Billing Routes Tests

#### GET /api/billing/plans

Tests:
- ✓ should return available subscription plans

#### POST /api/billing/create-checkout-session

Tests:
- ✓ should create checkout session successfully for Pro plan
- ✓ should return error for missing lookupKey
- ✓ should return error for invalid lookupKey
- ✓ should use existing customer if available

#### POST /api/billing/create-portal-session

Tests:
- ✓ should create portal session successfully
- ✓ should return error when no subscription found

#### GET /api/billing/subscription

Tests:
- ✓ should return user subscription details
- ✓ should return error when database fails

#### POST /webhooks/stripe

Tests:
- ✓ should handle checkout.session.completed event
- ✓ should return error for invalid webhook signature
- ✓ should handle unrecognized webhook events

#### Error Handling

Tests:
- ✓ should handle Stripe API errors gracefully
- ✓ should handle database errors

#### Authentication

Tests:
- ✓ should require authentication for protected routes

