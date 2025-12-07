# GDD Node — Billing v2

**Version:** 2.0  
**Status:** ✅ Production  
**Last Updated:** 2025-12-05  
**Owner:** Back-end Dev  
**Priority:** Critical

---

## 1. Summary

The **Billing** node is the subscription management system for Roastr v2. It uses **Polar** as the single billing provider for checkout, charges, renewals, trials, cancellations, and webhooks.

All revenue and subscription states come exclusively from Polar. There is **no Stripe in v2**. There is **no Free plan in v2**.

The billing system manages:

- Plan subscriptions (Starter, Pro, Plus)
- Trial periods and activation
- Payment method validation
- Subscription state machine (trialing, active, canceled_pending, paused, etc.)
- Usage tracking (analysis and roast credits)
- Limit enforcement based on plan
- Webhook processing from Polar
- Upgrade/downgrade flows
- Cost control and monitoring

---

## 2. Responsibilities

### Functional Responsibilities

1. **Subscription Management**
   - Create subscriptions via Polar checkout
   - Manage subscription states (trialing, active, canceled_pending, paused)
   - Process upgrades and downgrades
   - Handle cancellations with proper state transitions

2. **Trial Management**
   - Activate trials based on plan (Starter: 30 days, Pro: 7 days, Plus: no trial)
   - Require payment method validation before trial activation
   - Handle trial cancellation (immediate termination)
   - Transition from trial to active subscription

3. **Payment Processing**
   - Payment method validation
   - Charge processing via Polar
   - Payment failure handling and retries
   - Payment recovery flow (5-day period)

4. **Usage Tracking**
   - Track analysis credits consumed per user
   - Track roast credits consumed per user
   - Enforce monthly limits based on plan
   - Reset limits at cycle start

5. **Limit Enforcement**
   - Enforce analysis limits (blocks ingestion when exhausted)
   - Enforce roast limits (blocks roast generation when exhausted)
   - Prevent service usage when limits are reached
   - Update UI to reflect limit status

6. **Webhook Processing**
   - Receive and process Polar webhooks
   - Update subscription state machine
   - Maintain idempotency for all webhook handlers
   - Trigger appropriate system responses (workers, UI updates)

7. **State Machine Management**
   - Implement deterministic billing state machine
   - Handle all state transitions according to Spec v2 rules
   - Ensure service access aligns with subscription state

### Non-Functional Responsibilities

1. **Integration with Polar**
   - Single billing provider (no Stripe)
   - Webhook endpoint management
   - API client for Polar operations

2. **Cost Control**
   - Track usage costs
   - Monitor credit consumption
   - Provide cost analytics (TBD — not explicitly documented in Spec v2)

3. **Observability**
   - Log subscription events
   - Track state transitions
   - Monitor payment failures
   - Alert on billing anomalies

---

## 3. Inputs

### Checkout Request

```typescript
{
  userId: string;
  planId: "starter" | "pro" | "plus";
  paymentMethodId: string;  // From Polar checkout
}
```

### Webhook Events (from Polar)

```typescript
{
  event: 
    | "subscription_created"
    | "subscription_active"
    | "subscription_canceled"
    | "subscription_updated"
    | "invoice_payment_failed"
    | "invoice_payment_succeeded";
  subscription_id: string;
  customer_id: string;
  // Additional Polar payload fields
}
```

### Upgrade/Downgrade Request

```typescript
{
  userId: string;
  newPlanId: "starter" | "pro" | "plus";
  immediate: boolean;  // true for upgrade, false for downgrade (scheduled)
}
```

### Cancel Request

```typescript
{
  userId: string;
  reason?: string;  // Optional cancellation reason
}
```

### Usage Consumption Event

```typescript
{
  userId: string;
  type: "analysis" | "roast" | "corrective";
  amount: number;  // Typically 1 per event
}
```

---

## 4. Outputs

### Subscription Object

```typescript
{
  id: string;                    // Subscription ID from Polar
  userId: string;
  planId: "starter" | "pro" | "plus";
  state: SubscriptionState;      // See SSOT for valid states
  currentPeriodStart: timestamp;
  currentPeriodEnd: timestamp;
  trialStart?: timestamp;
  trialEnd?: timestamp;
  canceledAt?: timestamp;
  analysisLimit: number;
  roastLimit: number;
  analysisUsed: number;
  roastsUsed: number;
  analysisRemaining: number;
  roastsRemaining: number;
}
```

### Checkout Response

```typescript
{
  checkoutUrl: string;           // Polar checkout URL
  subscriptionId?: string;       // If subscription already exists
}
```

### State Transition Result

```typescript
{
  previousState: SubscriptionState;
  newState: SubscriptionState;
  transitionReason: string;
  effectiveDate: timestamp;
}
```

### Limit Status

```typescript
{
  analysisRemaining: number;
  roastsRemaining: number;
  analysisExhausted: boolean;
  roastsExhausted: boolean;
  canUseService: boolean;        // true if analysis > 0
}
```

---

## 5. Internal Rules

### Plan Rules

1. **Valid Plans (from SSOT)**
   - Only `"starter"`, `"pro"`, `"plus"` are valid
   - Legacy plans (`"free"`, `"basic"`, `"creator_plus"`) are rejected

2. **Plan Limits (from SSOT)**
   - Starter: 1,000 analysis/month, 5 roasts/month, 1 account per platform
   - Pro: 10,000 analysis/month, 1,000 roasts/month, 2 accounts per platform
   - Plus: 100,000 analysis/month, 5,000 roasts/month, 2 accounts per platform

3. **Plan Capabilities (from SSOT)**
   - Starter: Basic Shield, standard tones, Roastr Persona
   - Pro: Full Shield, personal tone, multi-account, Roastr Persona
   - Plus: All Pro features + Sponsors + optional queue priority

### Trial Rules

1. **Trial Activation**
   - Starter → 30-day trial
   - Pro → 7-day trial
   - Plus → **no trial**
   - Trial always requires valid payment method
   - Trial begins immediately after payment validation

2. **Trial Cancellation**
   - If user cancels during trial → **trial ends immediately**
   - Account transitions to `paused` state
   - No charge is made
   - Service is cut off immediately
   - Workers stop processing

3. **Trial to Active Transition**
   - Payment successful → state becomes `active`
   - Payment fails → enters `payment_retry` (up to 5 days)
   - After payment retry fails → state becomes `paused`

### Subscription State Machine Rules

1. **State Definitions (from SSOT)**
   ```typescript
   type SubscriptionState =
     | "trialing"
     | "expired_trial_pending_payment"  // Internal, can be represented via Polar fields
     | "payment_retry"
     | "active"
     | "canceled_pending"
     | "paused";
   ```

2. **State Transitions**
   - All transitions must go through deterministic `billingStateMachine(currentState, event)`
   - Webhooks trigger state transitions
   - State changes affect service access immediately

3. **State Behaviors**

   **trialing:**
   - Full plan access
   - Limits apply according to plan
   - Upgrades allowed without new trial

   **active:**
   - Full service access
   - Shield ON, Roasts ON (if credits available)
   - Ingestión ON (if analysis available)
   - Cancellation → `canceled_pending`

   **canceled_pending:**
   - Service continues until `current_period_end`
   - All features remain active
   - At period end → transitions to `paused`

   **paused:**
   - Service OFF (Shield, Roasts, Ingestion, Workers)
   - UI remains accessible (billing, history, settings)
   - Can reactivate before period end (no charge) or after (new checkout + charge)

   **payment_retry:**
   - User maintains normal access
   - Banners shown to update payment method
   - Up to 5 days managed by Polar
   - Success → `active`
   - Failure → `paused`

### Webhook Processing Rules

1. **Idempotency**
   - All webhook handlers must be idempotent
   - Duplicate webhook events must not cause duplicate state changes
   - Webhook processing must use `billingStateMachine(currentState, event)`

2. **Webhook Mappings (from Spec v2)**
   - `subscription_created` → `trialing` or `active` (Plus)
   - `subscription_active` → `active`
   - `subscription_canceled` → `canceled_pending`
   - `invoice_payment_failed` → `payment_retry`
   - `invoice_payment_succeeded` → `active`
   - `subscription_updated` → upgrade/downgrade (state remains `active` unless other rules apply)

### Usage Tracking Rules

1. **Credit Consumption**
   - 1 analysis completed → consume 1 analysis credit
   - 1 roast generated → consume 1 roast credit
   - 1 roast regenerated → consume 1 roast credit
   - 1 corrective reply → consume 1 roast credit

2. **Limit Enforcement**
   - When `analysis_remaining = 0`:
     - Gatekeeper OFF
     - Shield OFF
     - Roasts OFF
     - Workers do not process new ingestion jobs
     - No autopost
     - UI still shows comments from social media APIs (listing only, no processing)
   - When `roasts_remaining = 0`:
     - Shield continues functioning (if analysis available)
     - No new roasts generated (auto-approve or manual)
     - UI shows "Limit reached" badge

3. **Limit Reset**
   - Limits reset at start of each billing cycle
   - Reset triggered by `invoice_payment_succeeded` webhook (new cycle)
   - Reset triggered by `subscription_active` webhook (trial → active transition)

### Upgrade/Downgrade Rules

1. **Upgrade (Starter → Pro)**
   - If in trial Starter → converts to trial Pro (remaining days)
   - If active → immediate upgrade
   - Limits updated immediately
   - Prorating handled by Polar

2. **Upgrade (Pro → Plus)**
   - No trial period
   - Immediate charge
   - New cycle starts
   - Remaining analysis and roasts added to new limits
   - State remains `active`

3. **Downgrade**
   - During trial → immediate
   - During active cycle → scheduled for next cycle
   - Sponsors deactivated if downgrading from Plus

### Reactivation Rules

1. **Before Period End**
   - No new charge
   - Cycle continues
   - Limits do NOT reset

2. **After Period End**
   - Account is already `paused`
   - New checkout required
   - Immediate charge
   - New cycle starts
   - Limits reset

### Payment Failure Rules

1. **During Trial**
   - Payment validation required before trial starts
   - If payment invalid → trial not activated

2. **After Trial**
   - Payment failure → `payment_retry` state
   - Up to 5 days for recovery (managed by Polar)
   - Email notifications sent
   - If not resolved → `paused` state

---

## 6. Dependencies

Este nodo depende de los siguientes nodos:

- [`infraestructura.md`](./infraestructura.md)
- [`observabilidad.md`](./observabilidad.md)
- [`ssot-integration.md`](./ssot-integration.md)

### System Dependencies

- **Polar (Billing Provider)**
  - Checkout URL generation
  - Payment processing
  - Subscription management
  - Webhook delivery
  - Prorating calculations

- **Database (Supabase)**
  - Subscription records
  - Usage tracking tables
  - State machine persistence

- **Infrastructure Node**
  - Queue system for async processing
  - Database access patterns
  - Multi-tenant isolation

- **Observability Node**
  - Logging subscription events
  - Tracking state transitions
  - Monitoring payment failures
  - Usage analytics

- **SSOT Integration Node**
  - Plan definitions and limits
  - Subscription state definitions
  - Credit consumption rules
  - Plan capabilities

### Node Dependencies (GDD)

- `infraestructura.md`
- `observabilidad.md`
- `ssot-integration.md`

### Required By

The `billing` node is required by:

- `roasting-engine` — Needs plan limits and credit availability
- `analysis-engine` — Needs plan limits and credit availability
- `shield-engine` — Needs subscription state for service access
- `integraciones-redes-sociales` — Needs plan limits for account limits
- `observabilidad` — Needs billing data for analytics
- `frontend-user-app` — Needs subscription info for UI display
- `frontend-admin` — Needs billing data for admin panel

### Node Dependencies

According to `system-map-v2.yaml`, `billing` depends on:

- [`infraestructura.md`](./infraestructura.md) — Queue system and database
- [`observabilidad.md`](./observabilidad.md) — Logging and metrics
- [`ssot-integration.md`](./ssot-integration.md) — Plan definitions and rules

---

## 7. Edge Cases

### Trial Edge Cases

1. **Trial Cancellation**
   - User cancels during trial → trial ends immediately
   - Account → `paused` state
   - No service access
   - No charge made

2. **Upgrade During Trial**
   - Starter → Pro during trial → converts remaining trial to Pro trial
   - Starter → Plus during trial → exits trial, becomes active immediately with charge

3. **Trial Requested for Plus**
   - Plus does not support trials
   - Error 400: "Plus no incluye periodo de prueba."

### Payment Edge Cases

1. **Payment Method Invalid During Signup**
   - Account created but trial not activated
   - Onboarding blocked at payment step
   - User must provide valid payment to continue

2. **Payment Failure After Trial**
   - Enters `payment_retry` state
   - Up to 5 days for recovery
   - If not resolved → `paused` state
   - Service continues during retry period

3. **Expired/Stolen Card**
   - `invoice_payment_failed` webhook received
   - Email notifications sent
   - Retries for 5 days
   - If unresolved → `paused`

### Limit Exhaustion Edge Cases

1. **Analysis = 0**
   - All processing stops (Gatekeeper, Shield, Roasts)
   - Workers do not process new ingestion jobs
   - UI continues to show comments from social APIs (listing only)
   - User can upgrade plan, update card, view history

2. **Roasts = 0**
   - Shield continues (if analysis available)
   - No new roasts generated
   - UI shows "Limit reached" badge
   - User can upgrade plan

3. **Both Limits = 0**
   - Complete service shutdown
   - UI shows upgrade prompts
   - User can view history and billing

### Subscription State Edge Cases

1. **Cancelation During Paid Cycle**
   - State → `canceled_pending`
   - Service continues until `current_period_end`
   - At period end → state → `paused`

2. **Reactivation Before Period End**
   - If reactivated before `current_period_end` → `active` immediately
   - No new charge
   - Limits do NOT reset
   - Cycle continues

3. **Reactivation After Period End**
   - Account already `paused`
   - New checkout required
   - Immediate charge
   - New cycle starts
   - Limits reset

4. **Manual Pause by User**
   - Workers stop
   - Shield OFF
   - Roasts OFF
   - Ingestion OFF
   - User can reactivate from Billing UI

### Webhook Edge Cases

1. **Duplicate Webhook Events**
   - Must be handled idempotently
   - No duplicate state changes
   - No duplicate limit resets

2. **Webhook Out of Order**
   - State machine must handle events in any order
   - Invalid transitions should be logged and ignored (or trigger manual review)

3. **Webhook Processing Failure**
   - Dead letter queue for failed webhook processing
   - Retry mechanism
   - Manual intervention if persistent failures

### Upgrade/Downgrade Edge Cases

1. **Upgrade During Trial**
   - Starter trial → Pro upgrade → remaining days converted to Pro trial
   - No new trial period started

2. **Downgrade with Active Usage**
   - Downgrade scheduled for next cycle
   - Current usage continues under current plan limits
   - New limits apply at cycle start

3. **Sponsor Deactivation on Downgrade**
   - If downgrading from Plus → sponsors automatically deactivated
   - No data loss, just feature access removed

---

## 8. Acceptance Criteria

### Subscription Creation

1. ✅ User can select plan (Starter, Pro, Plus) during signup
2. ✅ Payment method validation occurs before trial activation
3. ✅ Trial starts immediately after payment validation
4. ✅ Subscription created with correct initial state (`trialing` or `active` for Plus)
5. ✅ Monthly limits initialized according to plan
6. ✅ Usage counters initialized to 0

### Trial Management

1. ✅ Starter plan gets 30-day trial
2. ✅ Pro plan gets 7-day trial
3. ✅ Plus plan has no trial
4. ✅ Trial cancellation ends trial immediately
5. ✅ Trial cancellation transitions to `paused` state
6. ✅ No charge made if trial is canceled
7. ✅ Trial to active transition occurs when payment succeeds

### Payment Processing

1. ✅ Payment method validation before trial activation
2. ✅ Payment failure triggers retry flow (up to 5 days)
3. ✅ Payment recovery sends email notifications
4. ✅ Payment failure after retry → `paused` state

### State Machine

1. ✅ All state transitions follow deterministic rules
2. ✅ Webhooks trigger correct state transitions
3. ✅ Service access aligns with subscription state
4. ✅ State changes are idempotent

### Usage Tracking

1. ✅ Analysis credits decrement when analysis completed
2. ✅ Roast credits decrement when roast generated/regenerated
3. ✅ Corrective replies consume roast credit
4. ✅ Limits reset at cycle start
5. ✅ Limits enforce service access correctly

### Limit Enforcement

1. ✅ `analysis_remaining = 0` → stops all processing (Gatekeeper, Shield, Roasts, Ingestion)
2. ✅ `roasts_remaining = 0` → stops roast generation but Shield continues
3. ✅ UI shows appropriate limit status and upgrade prompts
4. ✅ Workers respect limit exhaustion

### Webhook Processing

1. ✅ All webhook handlers are idempotent
2. ✅ Webhook events trigger correct state transitions
3. ✅ Duplicate webhooks do not cause duplicate changes
4. ✅ Failed webhook processing goes to DLQ

### Upgrade/Downgrade

1. ✅ Upgrades apply immediately (trial or active)
2. ✅ Downgrades schedule for next cycle
3. ✅ Limits update correctly on upgrade
4. ✅ Sponsors deactivate on downgrade from Plus

### Reactivation

1. ✅ Reactivation before period end → no charge, limits don't reset
2. ✅ Reactivation after period end → new checkout, immediate charge, new cycle

---

## 9. Test Matrix

### Unit Tests

**Location:** `tests/unit/services/billingService.test.ts`

1. **State Machine**
   - ✅ All valid state transitions work correctly
   - ✅ Invalid transitions are rejected
   - ✅ State machine is deterministic (same input → same output)

2. **Trial Logic**
   - ✅ Trial activation with valid payment
   - ✅ Trial cancellation ends immediately
   - ✅ Trial → active transition on payment success
   - ✅ Trial → paused transition on payment failure

3. **Limit Enforcement**
   - ✅ Limits reset at cycle start
   - ✅ Credit consumption decrements correctly
   - ✅ Exhaustion triggers service shutdown

4. **Usage Tracking**
   - ✅ Analysis credits tracked correctly
   - ✅ Roast credits tracked correctly
   - ✅ Regenerations consume credits
   - ✅ Corrective replies consume credits

### Integration Tests

**Location:** `tests/integration/billing.test.ts`

1. **Polar Webhook Processing**
   - ✅ `subscription_created` webhook → correct state
   - ✅ `subscription_active` webhook → correct transition
   - ✅ `subscription_canceled` webhook → `canceled_pending`
   - ✅ `invoice_payment_failed` webhook → `payment_retry`
   - ✅ `invoice_payment_succeeded` webhook → `active` + limit reset
   - ✅ Webhook idempotency (duplicate events)

2. **Upgrade/Downgrade Flows**
   - ✅ Starter → Pro upgrade (trial and active)
   - ✅ Pro → Plus upgrade (immediate charge)
   - ✅ Plus → Pro downgrade (scheduled)
   - ✅ Sponsor deactivation on downgrade

3. **Limit Exhaustion Integration**
   - ✅ Analysis = 0 → workers stop, Shield stops, Roasts stop
   - ✅ Roasts = 0 → Shield continues, roasts stop
   - ✅ UI shows correct limit status

4. **Payment Failure Recovery**
   - ✅ Payment failure → retry flow initiated
   - ✅ Payment recovery → state returns to `active`
   - ✅ Payment failure after retry → `paused`

### E2E Tests (Playwright)

**Location:** `tests/e2e/billing.test.ts`

1. **Full Checkout Flow**
   - ✅ Plan selection → checkout → payment → trial activation
   - ✅ Plus checkout → immediate active (no trial)

2. **Trial Cancellation**
   - ✅ Cancel during trial → immediate pause
   - ✅ Service stops immediately

3. **Upgrade Flow**
   - ✅ Upgrade from Starter to Pro → limits update
   - ✅ Upgrade from Pro to Plus → immediate charge

4. **Limit Exhaustion UI**
   - ✅ Analysis exhausted → UI shows upgrade prompts
   - ✅ Roasts exhausted → Shield still works, roast generation blocked

5. **Reactivation Flow**
   - ✅ Reactivate before period end → no charge
   - ✅ Reactivate after period end → new checkout

---

## 10. Implementation Notes

### Files Referenced (from system-map-v2.yaml)

- `src/services/billingService.js` — Core billing logic
- `src/routes/billing.js` — Billing API endpoints
- `src/routes/polarWebhook.js` — Polar webhook handler
- `src/services/costControl.js` — Cost tracking and control
- `src/services/usageTracker.js` — Usage credit tracking
- `src/services/creditsService.js` — Credit management
- `src/services/planLimitsService.js` — Plan limit enforcement
- `src/services/entitlementsService.js` — Feature entitlement based on plan

### Worker

- **BillingUpdate** — Processes billing-related async jobs
  - Usage credit updates
  - Limit resets
  - State transitions triggered by webhooks

### Integration Points

1. **Polar API Client**
   - Checkout URL generation
   - Subscription management
   - Webhook signature verification

2. **Database Schema**
   - Subscription table (links to Polar subscription ID)
   - Usage tracking table (analysis_used, roasts_used, period)
   - State machine state storage

3. **SSOT Integration**
   - Plan definitions loaded from SSOT
   - Limits loaded from SSOT
   - State machine rules from SSOT
   - Credit consumption rules from SSOT

### State Machine Implementation

The billing state machine must be implemented as a **pure reducer**:

```typescript
function billingStateMachine(
  currentState: SubscriptionState,
  event: PolarWebhookEvent,
  context: {
    planId: string;
    trialDays?: number;
    paymentStatus?: string;
    // ... other context
  }
): SubscriptionState
```

- Deterministic (same input → same output)
- No side effects in reducer
- Side effects (DB updates, worker triggers) happen after state transition

### Webhook Processing

1. **Idempotency Key**
   - Use Polar webhook ID or subscription ID + timestamp as idempotency key
   - Store processed webhook IDs to prevent duplicate processing

2. **Error Handling**
   - Failed webhook processing → DLQ
   - Retry with backoff
   - Manual intervention for persistent failures

3. **Signature Verification**
   - Verify Polar webhook signatures
   - Reject invalid signatures

### TBD Items

The following are not explicitly documented in Spec v2 or SSOT-V2.md:

1. **Cost Analytics**
   - Spec v2 does not detail cost tracking/analytics implementation
   - TBD — Requires SSOT update if needed

2. **Usage Rollover**
   - Spec v2 does not specify if unused credits roll over to next cycle
   - TBD — Assumed to be NO (limits reset, unused credits do not roll over)

3. **Prorating Details**
   - Spec v2 mentions Polar handles prorating but does not detail Roastr-side logic
   - TBD — Requires clarification or SSOT update

4. **Payment Method Update Flow**
   - Spec v2 does not detail how payment method updates are handled
   - TBD — Requires SSOT update or clarification

5. **Billing History**
   - Spec v2 does not specify billing history storage or retrieval
   - TBD — Requires SSOT update if needed

---

## 11. SSOT References

### Billing Provider (from SSOT-V2.md Section 2.1)

- v2: **Polar** is the only billing provider
- Stripe is **legacy v1**, not used in new flows

### Plan IDs (from SSOT-V2.md Section 1.1)

Valid plans:
- `"starter"` → 30-day trial
- `"pro"` → 7-day trial
- `"plus"` → no trial

**Legacy plans (NOT valid in v2):**
- `"free"`
- `"basic"`
- `"creator_plus"`

### Subscription States (from SSOT-V2.md Section 2.2)

```typescript
type SubscriptionState =
  | "trialing"
  | "expired_trial_pending_payment"  // Internal, can be represented via Polar fields
  | "payment_retry"
  | "active"
  | "canceled_pending"
  | "paused";
```

### Plan Limits (from SSOT-V2.md Section 1.3)

| Plan    | analysis_limit | roast_limit | accounts_per_platform | sponsors_allowed | tone_personal_allowed |
| ------- | -------------- | ----------- | --------------------- | ---------------- | --------------------- |
| starter | 1_000          | 5           | 1                     | false            | false                 |
| pro     | 10_000         | 1_000       | 2                     | false            | true                  |
| plus    | 100_000        | 5_000       | 2                     | true             | true                  |

### Trial Rules (from SSOT-V2.md Section 2.3)

1. Starter: 30 days
2. Pro: 7 days
3. Plus: no trial
4. Trial always requires valid payment method
5. If user cancels during trial → trial ends immediately, account → `paused`

### State Machine Rules (from SSOT-V2.md Section 2.3)

1. **Trial**
   - Starter: 30 days
   - Pro: 7 days
   - Plus: no trial
   - Cancellation during trial → immediate termination, `paused` state

2. **Active**
   - Full service access
   - Cancelation → `canceled_pending`
   - Upgrade → remains `active` with new cycle

3. **Canceled_pending**
   - Service continues until `current_period_end`
   - At period end → `paused`

4. **Paused**
   - Service OFF (Shield, Roasts, Ingestion, Workers)
   - UI accessible (billing, history, settings)
   - Reactivation: before period end (no charge) or after (new checkout)

### Webhook Mappings (from SSOT-V2.md Section 2.4)

- `subscription_created` → `trialing` or `active` (Plus)
- `subscription_active` → `active`
- `subscription_canceled` → `canceled_pending`
- `invoice_payment_failed` → `payment_retry`
- `invoice_payment_succeeded` → `active`
- `subscription_updated` → upgrade/downgrade (state remains `active` unless other rules apply)

### Credit Consumption Rules (from Spec v2 Section 3.6 and SSOT-V2.md)

1. 1 analysis completed → 1 analysis credit consumed
2. 1 roast generated → 1 roast credit consumed
3. 1 roast regenerated → 1 roast credit consumed
4. 1 corrective reply → 1 roast credit consumed

### Limit Exhaustion Rules (from SSOT-V2.md Section 2.5)

**analysis_remaining = 0:**
- Workers OFF (no new ingestion)
- Shield OFF
- Roasts OFF
- UI shows historical data only
- Banner: "Has agotado los análisis"

**roasts_remaining = 0:**
- Shield continues (if analysis available)
- No new roasts generated
- UI shows "Límite de roasts alcanzado"

---

## Subnodes

The `billing` node contains the following subnodes (from system-map-v2.yaml):

1. **polar-integration** — Polar API client, checkout generation, webhook processing
2. **cost-control** — Cost tracking and monitoring
3. **usage-tracking** — Credit consumption tracking and limit enforcement
4. **plan-limits** — Plan limit definitions and enforcement (STRONG concept)
5. **subscription-states** — Billing state machine implementation (STRONG concept)

---

## References

### Primary Sources

1. **Spec v2 Section 3** — "Sistema de Billing (Polar) — v2"
   - Complete billing flow
   - Trial logic
   - State machine definition
   - Webhook processing
   - Edge cases

2. **SSOT-V2.md**
   - Section 1: Plan IDs and limits
   - Section 2: Billing provider, subscription states, state machine rules, webhook mappings, limit exhaustion rules

3. **system-map-v2.yaml**
   - Node definition: `billing`
   - Dependencies: `infraestructura`, `observabilidad`, `ssot-integration`
   - Required by: 7 nodes
   - Subnodes: 5
   - Status: production
   - Priority: critical

### Related Nodes

**Depends on:**

- [`infraestructura.md`](./infraestructura.md)
- [`observabilidad.md`](./observabilidad.md)
- [`ssot-integration.md`](./ssot-integration.md)

**Required by:**

- [`roasting-engine.md`](./roasting-engine.md)
- [`analysis-engine.md`](./analysis-engine.md)
- [`shield-engine.md`](./shield-engine.md)
- [`integraciones-redes-sociales.md`](./integraciones-redes-sociales.md)
- [`observabilidad.md`](./observabilidad.md)
- [`frontend-user-app.md`](./frontend-user-app.md)
- [`frontend-admin.md`](./frontend-admin.md)

---

**Node Completion Checklist**

- [x] Node exists in system-map
- [x] All required sections filled
- [x] No invented behavior
- [x] All content sourced from Spec v2 or SSOT
- [x] Dependencies match system-map
- [x] Subnodes match system-map (5 subnodes listed)
- [x] No V1 contamination
- [x] All mandatory sections present
- [x] TBD sections correctly flagged
- [x] SSOT references documented
