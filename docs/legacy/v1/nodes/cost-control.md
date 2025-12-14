# ⚠️ DEPRECATED - DO NOT USE
# This file is deprecated as of 2025-12-14 (Issue ROA-329)
# Use docs/nodes-v2/ instead

# Cost Control - Usage Tracking & Billing Integration

**Node ID:** `cost-control`
**Owner:** Back-end Dev
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-11-21
**Coverage:** 60%
**Coverage Source:** auto
**Note:** Coverage value updated to match actual test coverage (gdd-status.json validation). Will be auto-updated when tests pass.
**Related Issue:** #396 (Monitoring), #500 (Coverage), #805 (Test fixes), #895 (Assertion fixes)
**Related PRs:** #499, #587, #809 (Monitoring), #821 (Coverage)

## Dependencies

- `multi-tenant` - Row Level Security (RLS) and organization isolation
- `plan-features` - Subscription plan limits and feature gates

## Security Requirements

### Supabase Service Key (CRITICAL)

**⚠️ IMPORTANT**: Cost Control Service **MUST** use `SUPABASE_SERVICE_KEY` for all database operations.

**Why**: Cost control performs privileged operations (usage tracking, billing, limit enforcement) that require admin-level database access. Using `SUPABASE_ANON_KEY` will cause permission errors and security violations.

**Configuration**:

```bash
# Required environment variable
SUPABASE_SERVICE_KEY=your-service-key-here

# ❌ NEVER use ANON key as fallback
# ✅ Fail fast if SERVICE_KEY is missing
```

**Implementation** (`src/services/costControl.js:11-20`):

```javascript
constructor() {
  if (mockMode.isMockMode) {
    this.supabase = mockMode.generateMockSupabaseClient();
  } else {
    // Assign Supabase credentials (CodeRabbit #3353894295 Mi1)
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // Fail fast if SERVICE_KEY is missing
    if (!this.supabaseKey) {
      throw new Error(
        'SUPABASE_SERVICE_KEY is required for CostControlService. ' +
        'This service requires admin privileges for usage tracking, billing, and cost control operations. ' +
        'SUPABASE_ANON_KEY is NOT sufficient and will cause permission errors.'
      );
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }
}
```

**Impact**: If SERVICE_KEY is not configured, the service will throw an error on initialization, preventing silent failures.

**Related**: CodeRabbit Review #3352743882 (Critical Issue C1)

## Overview

Cost Control manages usage tracking, billing integration, and limit enforcement across all Roastr.ai operations. It provides real-time usage monitoring, automatic limit enforcement, and Stripe billing integration.

### Key Capabilities

1. **Usage Tracking** - Record all billable operations (roasts, analyses, API calls)
2. **Limit Enforcement** - Automatic blocking when limits exceeded
3. **Billing Integration** - Stripe subscription and usage-based billing
4. **Cost Optimization** - Operation cost tracking and analytics
5. **Grace Periods** - 10% overage allowance before hard blocking

## Architecture

### Authentication Requirements

**IMPORTANT:** `CostControlService` performs admin operations (usage tracking, billing management) and **requires `SUPABASE_SERVICE_KEY`** to bypass Row Level Security (RLS) for multi-tenant data management.

```javascript
constructor() {
  if (mockMode.isMockMode) {
    this.supabase = mockMode.generateMockSupabaseClient();
  } else {
    // Fail-fast validation for admin operations (CodeRabbit #3353894295 N3)
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required for CostControlService');
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_KEY is required for admin operations in CostControlService');
    }

    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY;  // ✅ Uses SERVICE_KEY, not ANON_KEY
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }
}
```

**Rationale:**

- **ANON_KEY** has limited RLS permissions (user-level access only)
- **SERVICE_KEY** bypasses RLS and allows admin operations across all tenants
- Cost control needs to track usage for ALL organizations, not just one
- Billing operations require cross-tenant visibility

**Related Fix:** CodeRabbit Review #3353722960 (2025-10-18)

### Operation Costs (in cents)

| Operation          | Cost  | Type                    |
| ------------------ | ----- | ----------------------- |
| `fetch_comment`    | $0.00 | Free                    |
| `analyze_toxicity` | $0.01 | Per analysis            |
| `generate_reply`   | $0.05 | Per roast (OpenAI cost) |
| `post_response`    | $0.00 | Free                    |
| `shield_action`    | $0.02 | Per action              |

### Usage Tables

**Table:** `usage_records`

```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID,
  resource_type VARCHAR(50) NOT NULL,  -- 'roasts', 'comment_analysis', 'api_calls'
  quantity INTEGER DEFAULT 1,
  cost_cents INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_usage_org_month (organization_id, DATE_TRUNC('month', created_at))
);
```

**Table:** `monthly_usage_summary`

```sql
CREATE TABLE monthly_usage_summary (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  roasts_used INTEGER DEFAULT 0,
  analysis_used INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, month, year)
);
```

## Core Functions

### Check Operation Permission

```javascript
async canPerformOperation(organizationId, operationType, quantity = 1) {
  // Map operation to resource type
  const resourceTypeMap = {
    'generate_reply': 'roasts',
    'analyze_toxicity': 'comment_analysis',
    'fetch_comment': 'api_calls',
    'shield_action': 'shield_actions'
  };

  const resourceType = resourceTypeMap[operationType];

  // Database function checks limits
  const { data: result } = await supabase.rpc('can_perform_operation', {
    org_id: organizationId,
    resource_type_param: resourceType,
    quantity_param: quantity
  });

  // Result: { allowed: boolean, current_usage: number, limit: number, remaining: number }
  return result;
}
```

### Record Usage

```javascript
async recordUsage(organizationId, platform, operationType, metadata = {}, userId = null, quantity = 1) {
  const cost = this.operationCosts[operationType] * quantity;

  // Record individual usage
  await supabase.from('usage_records').insert({
    organization_id: organizationId,
    user_id: userId,
    resource_type: this.mapOperationToResource(operationType),
    quantity,
    cost_cents: cost,
    metadata: {
      platform,
      operation_type: operationType,
      ...metadata
    }
  });

  // Update monthly summary
  await this.updateMonthlySummary(organizationId, operationType, quantity, cost);

  // Check if approaching limit (90% usage)
  const status = await this.getUsageStatus(organizationId);
  if (status[resourceType].percentage >= 90) {
    await this.sendLimitWarning(organizationId, status);
  }
}
```

### Get Usage Status

```javascript
async getUsageStatus(organizationId) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Get monthly summary
  const { data: summary } = await supabase
    .from('monthly_usage_summary')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .single();

  // Get plan limits
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_limits(*)')
    .eq('id', organizationId)
    .single();

  const limits = org.plan_limits;

  return {
    roasts: {
      used: summary.roasts_used,
      limit: limits.max_roasts,
      remaining: limits.max_roasts - summary.roasts_used,
      percentage: (summary.roasts_used / limits.max_roasts) * 100
    },
    analysis: {
      used: summary.analysis_used,
      limit: limits.monthly_analysis_limit,
      remaining: limits.monthly_analysis_limit - summary.analysis_used,
      percentage: (summary.analysis_used / limits.monthly_analysis_limit) * 100
    },
    reset_date: this.getNextResetDate()
  };
}
```

### Grace Period & Soft Limits

```javascript
async checkLimitWithGrace(organizationId, resourceType, quantity) {
  const status = await this.getUsageStatus(organizationId);
  const resource = status[resourceType];

  // Hard limit: 110% of plan limit (10% grace)
  const hardLimit = resource.limit * 1.1;

  if (resource.used + quantity > hardLimit) {
    return {
      allowed: false,
      reason: 'hard_limit_exceeded',
      usage: resource.used,
      limit: resource.limit,
      hard_limit: hardLimit
    };
  }

  // Soft limit warning: 90-110% of plan limit
  if (resource.used + quantity > resource.limit) {
    return {
      allowed: true,
      warning: 'grace_period_active',
      usage: resource.used,
      limit: resource.limit,
      remaining_grace: hardLimit - resource.used
    };
  }

  return {
    allowed: true,
    usage: resource.used,
    remaining: resource.limit - resource.used
  };
}
```

## Stripe Integration

### Subscription Management

```javascript
async createSubscription(organizationId, planId, stripeCustomerId) {
  const plan = await this.getPlanDetails(planId);

  // Create Stripe subscription
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [
      {
        price: plan.stripePriceId,
        quantity: 1
      }
    ],
    metadata: {
      organization_id: organizationId,
      plan_id: planId
    }
  });

  // Update organization
  await supabase.from('organizations').update({
    plan_id: planId,
    stripe_subscription_id: subscription.id,
    subscription_status: 'active'
  }).eq('id', organizationId);

  return subscription;
}
```

### Usage-Based Billing (Metered)

```javascript
async reportUsageToStripe(organizationId, quantity, resourceType) {
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_subscription_id')
    .eq('id', organizationId)
    .single();

  if (!org.stripe_subscription_id) return;

  // Get subscription item for metered billing
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  const meteredItem = subscription.items.data.find(item => item.price.recurring.usage_type === 'metered');

  if (meteredItem) {
    await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment'
    });
  }
}
```

### Webhook Handling

```javascript
async handleStripeWebhook(event) {
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await this.resetMonthlyUsage(event.data.object.customer);
      break;

    case 'invoice.payment_failed':
      await this.suspendOrganization(event.data.object.customer);
      break;

    case 'customer.subscription.deleted':
      await this.downgradeToFree(event.data.object.customer);
      break;

    case 'customer.subscription.updated':
      await this.updateOrganizationPlan(event.data.object);
      break;
  }
}
```

## Zod Validation for Billing Endpoints (Issue #945)

**Migration:** Express-validator → Zod (P0 Critical Security)

### Why Zod for Billing

- **Dinero real involucrado** - Datos corruptos → activaciones incorrectas
- **Event spoofing prevention** - Validación estricta de estructura + firma
- **Type-safe validation** - Composable schemas, better error messages
- **NO dependency on Express** - Can validate anywhere (workers, services)

### Checkout Validation

**Endpoint:** `POST /api/checkout`

```javascript
const { validateZodSchema, checkoutSchema } = require('../validators/zod/billing.schema');

router.post('/checkout', validateZodSchema(checkoutSchema, 'body'), async (req, res) => {
  // req.validatedData contains validated + type-safe data
  const { customer_email, product_id, metadata } = req.validatedData;

  // Email already validated as valid format
  // product_id already validated as UUID
  // ...
});
```

**Validated fields:**

- `customer_email` - Valid email format (Zod .email())
- `product_id` - Valid UUID v4 format
- `price_id` - Legacy fallback (UUID v4)
- `metadata` - Optional flexible object

**Rejection examples:**

- Invalid email → 400 with `{ field: "customer_email", message: "Invalid email format" }`
- Invalid UUID → 400 with `{ field: "product_id", message: "Invalid UUID format" }`
- Missing both IDs → 400 with `{ message: "Either product_id or price_id must be provided" }`

### Webhook Event Validation

**Endpoint:** `POST /api/polar/webhook`

```javascript
const { validateWebhook } = require('../validators/zod/billing.schema');

router.post('/', async (req, res) => {
  // 1. Verify HMAC signature (security)
  const isValid = verifyWebhookSignature(rawBody, signature, secret);
  if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

  // 2. Parse + validate event structure (Zod)
  const validation = validateWebhook(event);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid event structure',
      details: validation.errors
    });
  }

  // 3. Use validated data
  const validatedEvent = validation.data;
  // validatedEvent.type is type-safe enum
  // validatedEvent.data is validated by specific event schema
});
```

**Validated event types:**

- `checkout.created` - New checkout session
- `order.created` - **CRITICAL** - Payment confirmed
- `subscription.created` - New subscription
- `subscription.updated` - Plan/status change
- `subscription.canceled` / `subscription.cancelled` - Cancellation (both spellings)

**Validation per event:**

- `order.created`:
  - `customer_email` - Valid email
  - `product_id` - Valid UUID
  - `amount` - Positive integer (cents)
  - `currency` - 3-char ISO 4217 code (USD, EUR, etc.)
- `subscription.created`:
  - `status` - Enum: active, trialing, past_due, canceled, incomplete
  - `current_period_start` - ISO 8601 datetime
  - `current_period_end` - ISO 8601 datetime
- ALL events:
  - `id` - Valid UUID (event ID)
  - `type` - Valid event type enum

**Security benefits:**

- ✅ Invalid events rejected **before** database access
- ✅ Corrupted data cannot activate subscriptions
- ✅ Type coercion prevented (e.g., amount: "-100" → rejected)
- ✅ Unknown event types rejected early
- ✅ Missing required fields caught immediately

### Testing Zod Validation

**Unit Tests:** `tests/unit/validators/billing.schema.test.js` (36 tests)

- Happy path for all schemas
- Error cases (invalid email, UUID, currency, etc.)
- Edge cases (null, undefined, empty objects)
- Helper functions (formatZodError, middleware)

**Integration Tests:** `tests/integration/polarWebhook.test.js` (22 tests)

- POST /api/checkout with valid/invalid data
- POST /api/polar/webhook with valid/invalid events
- Security: Signature verification + structure validation
- Critical: Corrupted data does NOT activate subscriptions

**Coverage:** ≥90% on billing endpoints + validators

### Migration Notes (Issue #945)

**Before (express-validator):**

```javascript
router.post('/checkout', [body('customer_email').isEmail(), body('product_id').isUUID()], handler);
// Manual validation + error handling in every endpoint
```

**After (Zod):**

```javascript
router.post('/checkout', validateZodSchema(checkoutSchema, 'body'), handler);
// Automatic validation + formatted errors + type-safe data
```

**Benefits:**

- ✅ Consistent error format across all endpoints
- ✅ Reusable schemas (can validate in workers, services)
- ✅ Type-safe access to validated data
- ✅ Better error messages for debugging
- ✅ Composable schemas (reuse event structures)

**Breaking changes:** None - API contracts unchanged

## Usage Analytics

### Cost Breakdown

```javascript
async getCostBreakdown(organizationId, startDate, endDate) {
  const { data: usage } = await supabase
    .from('usage_records')
    .select('resource_type, SUM(quantity) as total_quantity, SUM(cost_cents) as total_cost')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .group('resource_type');

  return {
    by_resource: usage,
    total_cost: usage.reduce((sum, r) => sum + r.total_cost, 0),
    total_operations: usage.reduce((sum, r) => sum + r.total_quantity, 0)
  };
}
```

### Optimization Recommendations

```javascript
async getOptimizationRecommendations(organizationId) {
  const breakdown = await this.getCostBreakdown(organizationId);
  const recommendations = [];

  // High roast generation cost
  if (breakdown.by_resource.roasts?.total_cost > 1000) {
    recommendations.push({
      type: 'high_roast_cost',
      message: 'Consider enabling RQC to reduce failed generations',
      potential_savings: breakdown.by_resource.roasts.total_cost * 0.15  // 15% savings
    });
  }

  // Excessive analysis
  if (breakdown.by_resource.comment_analysis?.total_quantity > 5000) {
    recommendations.push({
      type: 'excessive_analysis',
      message: 'Use Shield automated filtering to reduce manual analysis',
      potential_savings: breakdown.by_resource.comment_analysis.total_cost * 0.30
    });
  }

  return recommendations;
}
```

## Plan Upgrade Flow

```javascript
async upgradePlan(organizationId, newPlanId) {
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_id, stripe_customer_id')
    .eq('id', organizationId)
    .single();

  // Update Stripe subscription
  if (org.stripe_customer_id) {
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPlan.stripePriceId
      }],
      proration_behavior: 'create_prorations'
    });
  }

  // Update organization
  await supabase.from('organizations').update({
    plan_id: newPlanId,
    updated_at: new Date().toISOString()
  }).eq('id', organizationId);

  // Reset usage counters (optional)
  await this.resetMonthlyUsage(organizationId);

  return { success: true, new_plan: newPlanId };
}
```

## Testing

```javascript
describe('CostControlService', () => {
  test('blocks operation when hard limit exceeded', async () => {
    await simulateUsage(orgId, 'roasts', 110); // 110% of limit

    const result = await costControl.canPerformOperation(orgId, 'generate_reply');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hard_limit_exceeded');
  });

  test('allows operation in grace period', async () => {
    await simulateUsage(orgId, 'roasts', 105); // 105% of limit (in grace)

    const result = await costControl.canPerformOperation(orgId, 'generate_reply');

    expect(result.allowed).toBe(true);
    expect(result.warning).toBe('grace_period_active');
  });

  test('records usage and updates monthly summary', async () => {
    await costControl.recordUsage(orgId, 'twitter', 'generate_reply');

    const status = await costControl.getUsageStatus(orgId);
    expect(status.roasts.used).toBe(1);
  });

  test('sends warning at 90% usage', async () => {
    await simulateUsage(orgId, 'roasts', 90);

    await costControl.recordUsage(orgId, 'twitter', 'generate_reply');

    expect(mockEmailService).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'limit_warning' })
    );
  });
});
```

## Error Handling

| Error                    | Cause                      | Resolution                            |
| ------------------------ | -------------------------- | ------------------------------------- |
| `monthly_limit_exceeded` | Usage >= hard limit (110%) | Block operation, upgrade prompt       |
| `stripe_payment_failed`  | Card declined              | Suspend features, retry payment       |
| `invalid_plan`           | Plan ID not found          | Use valid plan from plan_limits table |
| `usage_record_failed`    | Database error             | Retry with backoff, alert ops         |

## Monitoring & Alerts

### Key Metrics

- **Usage percentage** - % of plan limit used (alert at 90%)
- **Cost per operation** - Average cost tracking
- **Grace period usage** - Organizations in 100-110% range
- **Payment failures** - Failed Stripe charges
- **Upgrade conversion** - Users upgrading due to limits

### Grafana Dashboard

```javascript
{
  organizations_at_limit: { type: 'gauge', value: 45 },
  monthly_revenue: { type: 'counter', value: 15420 },
  avg_cost_per_roast: { type: 'gauge', value: 0.05 },
  grace_period_active: { type: 'gauge', value: 12 },
  payment_failure_rate: { type: 'gauge', value: 0.02 }
}
```

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer**
- **Billing Specialist**
- **Documentation Agent**
- **Orchestrator**
- **Test Engineer**

## Related Nodes

- **plan-features** - Plan limits and feature gates
- **multi-tenant** - Organization isolation for usage
- **roast** - Billable roast generation
- **shield** - Billable shield actions
- **queue-system** - Job execution tracking

---

## Tests

### Ubicación de Tests

**Unit Tests** (5 archivos):

- `tests/unit/services/costControl.test.js` - Core cost tracking functionality
- `tests/unit/services/costControl.enhanced.test.js` - Enhanced features and edge cases
- `tests/unit/services/costControl-alerts.test.js` - Alert system and notifications
- `tests/unit/services/entitlementsService.test.js` - Plan limits and entitlements
- `tests/unit/services/stripeWrapper.test.js` - Stripe API integration wrapper

**Integration Tests** (1 archivo):

- `tests/integration/entitlementsFlow.test.js` - Full entitlements and cost control flow

### Cobertura de Tests

- **Unit Test Coverage**: ~90% del código de cost control
- **Integration Tests**: Flujo completo de entitlements
- **Total Tests**: 6 archivos con múltiples escenarios

### Casos de Prueba Cubiertos

**Cost Tracking:**

- ✅ Usage increment per operation (roasts, análisis)
- ✅ Organization-scoped usage tracking
- ✅ Monthly usage reset
- ✅ Real-time usage queries
- ✅ Cost calculation per plan tier

**Entitlements & Limits:**

- ✅ Plan-based limits enforcement (Free, Starter, Pro, Plus)
- ✅ Feature flag checks per plan
- ✅ Roast limit validation (100, 500, 1000, unlimited)
- ✅ Análisis limit validation (100, 500, 2000, unlimited)
- ✅ Platform access restrictions per plan
- ✅ Over-limit prevention

**Alerts & Notifications:**

- ✅ 80% usage warning emails
- ✅ 100% limit reached notifications
- ✅ Alert throttling (no spam)
- ✅ Organization admin notifications

**Stripe Integration:**

- ✅ Stripe API wrapper methods
- ✅ Error handling and retries
- ✅ Webhook payload validation
- ✅ Subscription status sync

**Edge Cases:**

- ✅ Invalid organization_id handling
- ✅ Missing subscription data
- ✅ Concurrent usage increments
- ✅ Negative usage values
- ✅ Plan tier downgrades

### Tests Pendientes

- [ ] Load tests con alto volumen de operaciones (>10,000/min)
- [ ] Billing accuracy tests (revenue reconciliation)
- [ ] Concurrent usage increment stress tests
- [ ] Plan transition edge cases (mid-month upgrades/downgrades)
- [ ] Stripe webhook retry logic tests

### Comandos de Test

```bash
# Run all cost-control tests
npm test -- costControl

# Run entitlements tests
npm test -- entitlements

# Run specific test file
npm test -- tests/unit/services/costControl.test.js

# Run integration flow
npm test -- tests/integration/entitlementsFlow.test.js
```

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on billing changes
**Last Reviewed:** 2025-10-06
**Version:** 1.0.0
