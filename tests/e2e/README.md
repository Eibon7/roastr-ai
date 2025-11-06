# E2E Tests Documentation

## Polar Checkout Flow Tests

**File:** `tests/e2e/polar-checkout-flow.spec.js`

### Overview

Tests for the Polar webhook integration and database updates when users subscribe to plans.

### Test Coverage

1. **Webhook Processing**
   - Tests that `order.created` webhooks update user plans correctly
   - Verifies database subscriptions are created

2. **Idempotency**
   - Tests that duplicate webhooks don't create duplicate subscriptions
   - Ensures upsert logic works correctly

3. **Plan Mapping**
   - Tests that different Polar price IDs map to correct plan tiers
   - Verifies `pro` and `creator_plus` plans

4. **Security**
   - Tests webhook signature validation (when configured)
   - Tests graceful handling of webhooks for non-existent users

### Test Helpers

**File:** `tests/helpers/polarE2EHelpers.js`

Helper functions:
- `createTestUser(email, plan)` - Create test user in database
- `getUserFromDB(email)` - Get user by email
- `getSubscriptionFromDB(userId)` - Get subscription by user ID
- `deleteTestUser(email)` - Cleanup test user
- `simulatePolarWebhook(eventType, data, options)` - Simulate webhook
- `waitFor(condition, options)` - Poll for async conditions
- `createTestEmail(prefix)` - Generate unique test email

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run Polar tests specifically
npm run test:e2e tests/e2e/polar-checkout-flow.spec.js

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

### Environment Requirements

⚠️ **IMPORTANT**: These tests require actual database configuration to pass. They currently fail in mock mode.

**Required:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

**Optional but recommended:**
- `POLAR_WEBHOOK_SECRET` - For signature validation tests
- `POLAR_PRO_PRICE_ID` - Real Polar price ID for pro plan
- `POLAR_PLUS_PRICE_ID` - Real Polar price ID for creator_plus plan

### Test Status

**✅ Implemented:**
- Test structure and logic
- Webhook simulation
- Helper functions
- Security tests

**⚠️ Blockers:**
- Tests fail in mock mode (Supabase not configured)
- Real database required for full E2E verification

**📋 See:**
- Issue #729 - E2E test implementation (this PR)
- Issue #741 - Checklist Pre-Producción (environment setup requirements)

### Test Architecture

```
tests/
├── e2e/
│   ├── polar-checkout-flow.spec.js   # Main test file
│   └── README.md                      # This file
└── helpers/
    └── polarE2EHelpers.js            # Reusable test helpers
```

### Future Enhancements

- [ ] Add tests for failed payments
- [ ] Test subscription cancellation flow
- [ ] Test subscription.updated events
- [ ] Add performance benchmarks
- [ ] Integration with real Polar sandbox (if available)
- [ ] Visual regression tests for pricing page

### Troubleshooting

**"Supabase environment variables not set - running in mock mode"**
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- Tests cannot verify database updates in mock mode

**"Timeout waiting for condition"**
- Database not configured correctly
- Webhook handler not running
- Check server logs for errors

**"User not found" errors**
- Supabase RLS policies may block test user creation
- Use service role key for tests (has RLS bypass)

---

**Issue:** #729
**Author:** Claude
**Date:** 2025-11-06
