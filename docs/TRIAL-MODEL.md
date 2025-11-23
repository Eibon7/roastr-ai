# Trial Model - Business Requirements

**Version:** 1.0
**Date:** 2025-11-08
**Status:** Active (PR #756)

---

## Overview

Roastr AI uses a **30-day trial model** with `starter_trial` as the entry plan. There is NO permanent free plan. Users must subscribe to a paid plan (Starter/Pro/Plus) to maintain active processing capabilities.

---

## Plan Hierarchy

```
starter_trial (30 days) → starter (€5/mo) → pro (€15/mo) → plus (€50/mo)
                ↓
        (expired/cancelled)
                ↓
         Read-only access
```

---

## Core Behaviors

### 1. Signup Flow

**When:** New user registers

**Action:**

- Automatically assign: `starter_trial`
- Trial duration: 30 days from signup
- Limits: Full Starter plan functionality
  - Comment analysis: ✅ Active
  - Roast generation: ✅ Active
  - Shield moderation: ✅ Active
  - Analytics: ✅ Active

**Implementation:**

- `authService.js` - Default plan in `createUserManually()`
- `subscriptionService.js` - Trial initialization
- Database: `users.plan = 'starter_trial'`, `trial_end = NOW() + 30 days`

---

### 2. Trial Expiry (30 days)

**When:** `trial_end` date is reached

**Behavior:**

- Platform access: ✅ Full UI access
- Comment analysis: ❌ Disabled
- Roast generation: ❌ Disabled
- Shield moderation: ❌ Disabled
- View historical data: ✅ Enabled (read-only)
- Analytics dashboard: ✅ Visible (no new data)

**User experience:**

- Can navigate all screens
- Can see previous roasts, analytics, configurations
- Cannot trigger new operations
- Banner/notice: "Trial expired - Upgrade to continue"

**Implementation:**

- Workers check `isPlanActive()` before processing
- Queue service rejects jobs for expired trials
- Frontend shows read-only mode
- No background processing for expired users

---

### 3. Early Upgrade (during trial)

**When:** User subscribes before trial expires

**Behavior:**

- Upgrade: ✅ Immediate
- Trial cancellation: Trial ends immediately
- Billing: Starts immediately
- Access: Full paid plan features

**Flow:**

```
starter_trial (day 10/30) → User subscribes to Pro
                           → trial_end = NOW()
                           → plan = 'pro'
                           → status = 'active'
                           → Billing cycle starts
```

**Implementation:**

- `stripeWebhookService.js` - `checkout.session.completed`
- Cancel trial immediately
- Apply paid plan entitlements
- Set `subscription_status = 'active'`

---

### 4. Subscription Cancellation

**When:** User cancels paid subscription (Starter/Pro/Plus)

**Behavior:**

- Access: ✅ Full until period ends
- Period end behavior: Same as trial expiry
  - Platform access: ✅ Yes
  - Processing: ❌ Disabled
  - Read-only: ✅ Historical data

**Does NOT:**

- ❌ Grant new trial period
- ❌ Reset to `starter_trial`
- ❌ Allow re-trial

**Flow:**

```
Pro (active) → User cancels → Access until period_end
                            → After period_end: Read-only mode
                            → plan = 'pro' (unchanged)
                            → status = 'canceled'
                            → No active processing
```

**Implementation:**

- `stripeWebhookService.js` - `customer.subscription.deleted`
- Maintain plan name
- Set `subscription_status = 'canceled'`
- Workers check both plan AND status

---

### 5. Payment Failure

**When:** `invoice.payment_failed` event from Stripe

**Behavior:**

- Same as trial expiry / cancellation:
  - Platform access: ✅ Yes
  - Processing: ❌ Disabled
  - Read-only: ✅ Historical data

**Grace period:** None (immediate suspension of processing)

**Recovery:**

- User updates payment method
- `invoice.payment_succeeded` triggers
- Processing re-enabled automatically

**Implementation:**

- `stripeWebhookService.js` - `_handlePaymentFailed()`
- Set `subscription_status = 'past_due'`
- Workers reject jobs for `past_due` status

---

## Plan Validation Logic

### Active Processing Check

```javascript
function isPlanActive(plan, status, trialEnd) {
  // Paid plans must have 'active' status
  if (['starter', 'pro', 'plus', 'creator_plus', 'custom'].includes(plan)) {
    return status === 'active';
  }

  // Trial plan must not be expired
  if (plan === 'starter_trial') {
    return new Date(trialEnd) > new Date();
  }

  // No other plans exist (no 'free')
  return false;
}
```

### Worker Gate

```javascript
// Before processing any job
if (!isPlanActive(user.plan, user.subscription_status, user.trial_end)) {
  logger.warn('Job rejected - inactive plan', { userId, plan, status });
  return {
    success: false,
    error: 'PLAN_INACTIVE',
    message: 'Subscription expired or payment failed. Please upgrade.'
  };
}
```

---

## Migration Strategy

### Phase 1: Code Migration ✅ In Progress (PR #756)

1. ✅ `authService.js` - Default to `starter_trial`
2. ✅ `subscriptionService.js` - Trial handling
3. ✅ `workerNotificationService.js` - Suspended limits
4. ⏳ `stripeWebhookService.js` - Webhook fallbacks
5. ⏳ `planService.js` - Remove 'free' from PLAN_FEATURES
6. ⏳ All workers - Add `isPlanActive()` checks

### Phase 2: Database Migration (Future PR)

**Not needed currently** - No existing users with 'free' plan.

If users exist in future:

```sql
-- Hypothetical migration (NOT EXECUTING NOW)
UPDATE users
SET
    plan = 'starter_trial',
    trial_end = NOW() + INTERVAL '30 days',
    subscription_status = 'trialing'
WHERE plan = 'free';
```

### Phase 3: Worker Enforcement (Future PR)

Add plan checks to:

- `FetchCommentsWorker.js`
- `AnalyzeToxicityWorker.js`
- `GenerateReplyWorker.js`
- `ShieldActionWorker.js`
- `queueService.js` - Job submission gate

---

## Edge Cases

### A. User signs up, never upgrades, never uses product

- Trial expires after 30 days
- Account remains in read-only mode indefinitely
- No automatic deletion
- Can upgrade anytime to reactivate

### B. User downgrades from Plus → Pro → Starter

- Immediate downgrade (no period_end waiting)
- Features restricted to new plan tier
- No "read-only" mode (still paying)

### C. Stripe webhook fails to deliver

- Retry mechanism in Stripe (automatic)
- Idempotency in `stripeWebhookService.js` prevents duplicates
- Manual reconciliation: `scripts/reconcile-subscriptions.js` (future)

### D. User has multiple organizations

- Each organization inherits user's plan
- Plan check happens at user level, not org level
- Billing is per user, not per org

---

## Testing Requirements

### Unit Tests

- [x] `authService.test.js` - Default plan is `starter_trial`
- [x] `subscriptionService.test.js` - Trial expiry behavior
- [ ] `stripeWebhookService.test.js` - Fallback to `starter_trial`
- [ ] `planService.test.js` - No 'free' plan exists

### Integration Tests

- [ ] `trial-expiry.integration.test.js` - Full expiry flow
- [ ] `payment-failure.integration.test.js` - Failed payment flow
- [ ] `early-upgrade.integration.test.js` - Trial → Paid flow

### E2E Tests

- [ ] Signup → Trial → Expiry → Upgrade
- [ ] Signup → Trial → Early upgrade
- [ ] Active subscription → Cancel → Period end

---

## Monitoring & Alerts

### Metrics to Track

- Trial conversion rate (trial → paid)
- Trial expiry without conversion
- Failed payment recovery rate
- Cancellation reasons (exit surveys)

### Alerts

- High failed payment rate (>5%)
- Low trial conversion (<10%)
- Webhook processing failures

---

## Documentation Updates

- [x] `docs/TRIAL-MODEL.md` (this file)
- [ ] `CLAUDE.md` - Update business model section
- [ ] `spec.md` - Update plan hierarchy
- [ ] `docs/nodes/billing.md` - Update trial logic

---

## References

- **Issue**: #484 (Stripe Checkout Integration)
- **PR**: #756 (Trial Model Implementation)
- **CodeRabbit Review**: https://github.com/Eibon7/roastr-ai/pull/756#issuecomment-3506626576
- **Stripe Docs**: https://stripe.com/docs/billing/subscriptions/trials

---

## Changelog

| Date       | Change                | Author           |
| ---------- | --------------------- | ---------------- |
| 2025-11-08 | Initial documentation | Claude (PR #756) |

---

**Enforcement Date:** Upon merge of PR #756
**Backward Compatibility:** None required (no existing users)
