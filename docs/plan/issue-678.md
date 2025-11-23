# Plan Implementation - Issue #678: Free → Starter Trial Migration

**Issue:** [Issue #678](https://github.com/Eibon7/roastr-ai/issues/678)  
**Status:** 🟡 Planning  
**Assigned to:** Orchestrator + Back-end Dev  
**Labels:** `billing`  
**Created:** 2025-10-28

## Context

Eliminar el plan **Free** y sustituirlo por **"Starter Trial 30 días (requiere tarjeta)"**. Tras el trial, el usuario pasa a **Starter de pago automáticamente** salvo cancelación.

**Objetivo:** Migración completa de Free → Trial, eliminación total de Stripe, y preparación para integración con Polar.

---

## Estado Actual

### Plan Tiers Existentes

- **Free** (10 roasts/mo, 100 analysis, 1 platform) - A ELIMINAR
- **Starter** (€5/mo, 10 roasts, 1000 analysis, 2 platforms) - Modificar para incluir trial
- **Pro** (€15/mo, 1000 roasts, 10000 analysis, 5 platforms)
- **Plus** (€50/mo, 5000 roasts, 100000 analysis, 10 platforms)

### Referencias a Stripe

- `src/routes/billing.js`
- `src/routes/billingController.js`
- `src/routes/billingFactory.js`
- `src/services/stripeWebhookService.js`
- `src/workers/BillingWorker.js`
- Webhook handlers en `src/routes/billing.js`
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

### Referencias a "free"

- 41 archivos encontrados (grep pattern `plan.*free|free.*plan`)
- Principalmente en: services, routes, config, middleware

---

## Plan de Implementación

### FASE 1: Entitlements & Database

#### 1.1 Database Schema Changes

**Archivo:** `database/migrations/XXX_add_trial_to_starter.sql`

```sql
-- Add trial fields to user_subscriptions
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Add computed column for trial status
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS is_in_trial BOOLEAN GENERATED ALWAYS AS (
  trial_ends_at IS NOT NULL AND trial_ends_at > NOW()
) STORED;

-- Update plan_limits to remove 'free' plan
UPDATE plan_limits SET plan_id = 'starter_trial' WHERE plan_id = 'free';

-- OR create new migration if we need to preserve data
-- Insert new trial-enabled starter plan
INSERT INTO plan_limits (
  plan_id, plan_name, plan_description, max_roasts,
  monthly_responses_limit, monthly_analysis_limit, max_platforms,
  rqc_enabled, shield_enabled, features
) VALUES (
  'starter_trial', 'Starter Trial', '30-day trial (card required)',
  10, 10, 1000, 2,
  FALSE, TRUE,
  '["gpt5_roasts", "shield_basic", "basic_integrations", "trial"]'
)
ON CONFLICT (plan_id) DO NOTHING;
```

#### 1.2 Remove "Free" References

**Archivos afectados:**

- `src/config/tierConfig.js` - Eliminar 'free' de TIER_NAMES
- `src/config/planMappings.js` - Eliminar mapeo 'free' → Stripe
- `database/schema.sql` - Actualizar comentarios y valores por defecto

**Cambios:**

```javascript
// ANTES
const TIER_NAMES = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  PLUS: 'plus'
};

// DESPUÉS
const TIER_NAMES = {
  STARTER_TRIAL: 'starter_trial',
  STARTER: 'starter',
  PRO: 'pro',
  PLUS: 'plus'
};
```

#### 1.3 Add Trial Helper Methods

**Archivo:** `src/services/entitlementsService.js`

```javascript
/**
 * Check if user is in trial period
 */
async isInTrial(userId) {
  const subscription = await this.getSubscription(userId);
  return subscription?.is_in_trial || false;
}

/**
 * Start trial for user
 */
async startTrial(userId, durationDays = 30) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);

  await this.supabase
    .from('user_subscriptions')
    .update({
      plan_id: 'starter_trial',
      trial_starts_at: new Date().toISOString(),
      trial_ends_at: trialEndsAt.toISOString()
    })
    .eq('organization_id', userId);
}

/**
 * Check if trial has expired and needs conversion
 */
async checkTrialExpiration(userId) {
  const subscription = await this.getSubscription(userId);
  if (!subscription?.trial_ends_at) return false;

  const now = new Date();
  const trialEnd = new Date(subscription.trial_ends_at);

  return trialEnd < now;
}

/**
 * Convert trial to paid starter
 */
async convertTrialToPaid(userId) {
  // TODO: Integrate with Polar billing when ready
  await this.supabase
    .from('user_subscriptions')
    .update({
      plan_id: 'starter',
      trial_starts_at: null,
      trial_ends_at: null
    })
    .eq('organization_id', userId);
}
```

---

### FASE 2: Billing Cleanup (Stripe → Polar-ready)

#### 2.1 Remove Stripe Dependencies

**Archivos a modificar:**

**`src/routes/billing.js`**

```javascript
// Remove ALL Stripe webhook handlers
// Replace with no-ops + logs

router.post('/webhook', async (req, res) => {
  logger.info('TODO:Polar - Billing webhook received', { body: req.body });
  // No-op: Return success to prevent Stripe retries
  res.status(200).json({ received: true });
});

router.post('/checkout', async (req, res) => {
  logger.info('TODO:Polar - Checkout initiated', req.body);
  // Return mock session for now
  res.json({
    session_id: 'mock_session',
    checkout_url: 'https://app.polar.sh/checkout/mock'
  });
});
```

**`src/services/stripeWebhookService.js`**

```javascript
// Replace all methods with no-ops
class StripeWebhookService {
  async handleCheckoutCompleted(event) {
    logger.info('TODO:Polar - Handle checkout completed', { event });
    return { processed: true };
  }

  async handleSubscriptionUpdated(event) {
    logger.info('TODO:Polar - Handle subscription updated', { event });
    return { processed: true };
  }

  // ... all other methods
}
```

#### 2.2 Create Billing Interface Abstraction

**Archivo:** `src/services/billingInterface.js` (NEW)

```javascript
/**
 * Billing Interface - Abstraction for payment providers
 * Currently: TODO:Polar integration
 * Previously: Stripe (removed)
 */
class BillingInterface {
  constructor(config) {
    this.config = config;
    this.logger = require('../utils/logger');
  }

  async createCheckoutSession(params) {
    this.logger.info('TODO:Polar - Create checkout session', params);
    // Placeholder for Polar integration
    throw new Error('Billing integration not yet implemented');
  }

  async getCustomer(subscriptionId) {
    this.logger.info('TODO:Polar - Get customer', { subscriptionId });
    // Placeholder
  }

  async cancelSubscription(subscriptionId) {
    this.logger.info('TODO:Polar - Cancel subscription', { subscriptionId });
    // Placeholder
  }

  // ... more methods as needed
}

module.exports = BillingInterface;
```

#### 2.3 Remove Stripe from Tests

**Archivos:** `tests/integration/billing*.test.js`, `tests/unit/billing*.test.js`

```javascript
// Replace all Stripe mocks with BillingInterface mocks
const BillingInterface = require('../../src/services/billingInterface');

const mockBillingInterface = {
  createCheckoutSession: jest.fn(),
  cancelSubscription: jest.fn()
  // ...
};
```

#### 2.4 Clean .env and CI

**Archivos:** `.env.example`, `README.md`, `.github/workflows/*.yml`

**Remove:**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Add:**

```
# TODO: Polar integration
POLAR_API_KEY=
POLAR_WEBHOOK_SECRET=
```

---

### FASE 3: Frontend Updates

#### 3.1 Update Pricing Page

**Archivo:** `frontend/src/pages/Pricing.jsx`

**Cambios:**

```jsx
// ELIMINAR: Plan Free
// ANTES
const plans = [
  { id: 'free', name: 'Free', price: 0, ... },
  { id: 'starter', name: 'Starter', price: 5, ... },
  { id: 'pro', name: 'Pro', price: 15, ... },
  { id: 'plus', name: 'Plus', price: 50, ... }
];

// DESPUÉS
const plans = [
  {
    id: 'starter_trial',
    name: 'Starter Trial',
    price: 0,
    trialDays: 30,
    requiresCard: true,
    afterTrial: 'Starter (€5/mo)',
    features: [...]
  },
  { id: 'starter', name: 'Starter', price: 5, ... },
  { id: 'pro', name: 'Pro', price: 15, ... },
  { id: 'plus', name: 'Plus', price: 50, ... }
];

// Render with trial badge
{plan.id === 'starter_trial' && (
  <div className="trial-badge">
    30-day trial • Card required
  </div>
)}
```

#### 3.2 Update Trial Flow

**Archivo:** `frontend/src/pages/Pricing.jsx`

```jsx
const handleStartTrial = async (planId) => {
  if (planId === 'starter_trial') {
    // Show card requirement modal
    const confirmed = await showCardRequirementModal();
    if (!confirmed) return;

    // Call API to start trial
    const response = await fetch('/api/subscriptions/start-trial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      window.location.href = '/dashboard';
    }
  } else {
    // Regular subscription flow (Pro, Plus)
    handleSubscribe(planId);
  }
};
```

#### 3.3 Add Trial Status UI

**Archivo:** `frontend/src/pages/Dashboard.jsx`

```jsx
const TrialBadge = ({ subscription }) => {
  if (!subscription.is_in_trial) return null;

  const daysLeft = Math.ceil(
    (new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="trial-badge">
      ⏳ Trial ends in {daysLeft} days
      <button onClick={handleCancelTrial}>Cancel</button>
    </div>
  );
};
```

---

### FASE 4: Migration Script

#### 4.1 Script: Free → Starter Trial

**Archivo:** `scripts/migrate-free-to-trial.js` (NEW)

```javascript
#!/usr/bin/env node
/**
 * Migration: Free Plan → Starter Trial
 *
 * Converts all users on 'free' plan to 'starter_trial' with:
 * - trial_ends_at = NOW() + 30 days
 * - trial_starts_at = NOW()
 * - plan_id = 'starter_trial'
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrateFreeToTrial() {
  console.log('🔄 Starting migration: Free → Starter Trial');

  // Get all users on 'free' plan
  const { data: freeUsers, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('id, organization_id, plan_id')
    .eq('plan_id', 'free');

  if (fetchError) {
    console.error('❌ Error fetching users:', fetchError);
    process.exit(1);
  }

  console.log(`📊 Found ${freeUsers.length} users on 'free' plan`);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  // Update each user
  for (const user of freeUsers) {
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_id: 'starter_trial',
        trial_starts_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ Error updating user ${user.id}:`, updateError);
    } else {
      console.log(`✅ Migrated user ${user.organization_id}`);
    }
  }

  console.log('✅ Migration completed');
}

// Run migration
migrateFreeToTrial()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
```

#### 4.2 Run Migration

```bash
# Run migration
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-free-to-trial.js

# Verify migration
psql $DATABASE_URL -c "SELECT plan_id, COUNT(*) FROM user_subscriptions GROUP BY plan_id;"
```

---

### FASE 5: Tests

#### 5.1 Trial Gating Tests

**Archivo:** `tests/unit/entitlements-trial.test.js` (NEW)

```javascript
describe('Entitlements Trial', () => {
  test('isInTrial returns true when user has active trial', async () => {
    // Mock subscription with trial
    const mockSub = {
      plan_id: 'starter_trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_in_trial: true
    };

    const isInTrial = await entitlementsService.isInTrial('user_123');
    expect(isInTrial).toBe(true);
  });

  test('Trial has same limits as Starter', async () => {
    const limits = await planLimitsService.getLimits('starter_trial');
    const starterLimits = await planLimitsService.getLimits('starter');

    expect(limits.max_roasts).toBe(starterLimits.max_roasts);
    expect(limits.max_platforms).toBe(starterLimits.max_platforms);
  });
});
```

#### 5.2 Trial Conversion Tests

**Archivo:** `tests/integration/trial-conversion.test.js` (NEW)

```javascript
describe('Trial Conversion', () => {
  test('Trial converts to paid Starter after expiration', async () => {
    // Start trial
    await entitlementsService.startTrial('user_123');

    // Simulate expiration
    await supabase
      .from('user_subscriptions')
      .update({ trial_ends_at: new Date(Date.now() - 1000).toISOString() })
      .eq('organization_id', 'user_123');

    // Check conversion
    const converted = await entitlementsService.checkTrialExpiration('user_123');
    expect(converted).toBe(true);

    // Convert to paid
    await entitlementsService.convertTrialToPaid('user_123');

    // Verify plan change
    const sub = await entitlementsService.getSubscription('user_123');
    expect(sub.plan_id).toBe('starter');
    expect(sub.is_in_trial).toBe(false);
  });

  test('Cancelled trial does not convert', async () => {
    // User cancels trial
    await entitlementsService.cancelTrial('user_123');

    // Check no conversion
    const converted = await entitlementsService.checkTrialExpiration('user_123');
    expect(converted).toBe(false);
  });
});
```

#### 5.3 Remove Stripe Tests

**Archivos:** `tests/integration/billing*.test.js`

```javascript
// Remove or update all tests that depend on Stripe
// Replace with BillingInterface mocks
```

---

## Checklist de Entrega

### Entitlements

- [ ] Database migration creada y testada
- [ ] Trial fields añadidos (trial_starts_at, trial_ends_at, is_in_trial)
- [ ] Helper methods implementados (isInTrial, startTrial, etc.)
- [ ] Todos los archivos libres de referencias a "free"

### Billing

- [ ] Stripe eliminado completamente de código
- [ ] Webhook handlers convertidos a no-ops con logs
- [ ] BillingInterface creado para abstracción
- [ ] Tests actualizados sin Stripe
- [ ] Env vars limpiados (STRIPE\_\* removidos)
- [ ] CI actualizado sin Stripe

### Frontend

- [ ] Pricing page actualizado (Free → Trial)
- [ ] Trial flow implementado (card requirement)
- [ ] Trial status UI en dashboard
- [ ] Cancel trial flow funcional
- [ ] Auto-conversion messaging

### Migración

- [ ] Script de migración Free → Trial
- [ ] Documentación de política de trial
- [ ] Dry-run testado en staging

### Tests

- [ ] Trial gating tests (mismos límites que Starter)
- [ ] Trial conversion tests (auto después de expiration)
- [ ] Trial cancellation tests
- [ ] Coverage >80% para cambios
- [ ] Integration tests actualizados

### Documentación

- [ ] CHANGELOG.md actualizado
- [ ] README.md actualizado (env vars)
- [ ] GDD nodes actualizados (billing, plan-features)
- [ ] Migration guide para usuarios

---

## Archivos a Modificar (41 archivos encontrados)

### Database (2)

- `database/schema.sql`
- `database/migrations/XXX_add_trial_to_starter.sql` (NEW)

### Backend - Services (15)

- `src/services/entitlementsService.js`
- `src/services/planService.js`
- `src/services/planLimitsService.js`
- `src/services/billingInterface.js` (NEW)
- `src/services/stripeWebhookService.js` (REMOVE/REPLACE)
- `src/services/tierValidationService.js`
- `src/services/planValidation.js`
- `src/services/creditsService.js`
- `src/services/subscriptionService.js`
- `src/services/costControl.js`
- `src/services/triageService.js`
- `src/services/modelAvailabilityService.js`
- `src/services/roastGeneratorEnhanced.js`
- `src/services/roastEngine.js`
- `src/services/authService.js`

### Backend - Routes (8)

- `src/routes/billing.js`
- `src/routes/billingController.js`
- `src/routes/billingFactory.js`
- `src/routes/auth.js`
- `src/routes/user.js`
- `src/routes/plan.js`
- `src/routes/roast.js`
- `src/routes/dashboard.js`
- `src/routes/admin.js`

### Backend - Config (6)

- `src/config/tierConfig.js`
- `src/config/planMappings.js`
- `src/config/tierMessages.js`
- `src/config/supabase.js`
- `src/config/modelAvailability.js`

### Backend - Middleware (2)

- `src/middleware/requirePlan.js`
- `src/middleware/inputValidation.js`

### Frontend (5+)

- `frontend/src/pages/Pricing.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/PlanBadge.jsx` (NEW)
- `frontend/src/components/TrialStatus.jsx` (NEW)

### Tests (15+)

- `tests/integration/billing*.test.js`
- `tests/unit/entitlements*.test.js`
- `tests/integration/trial-conversion.test.js` (NEW)
- `tests/unit/entitlements-trial.test.js` (NEW)

### Scripts (3)

- `scripts/migrate-free-to-trial.js` (NEW)
- `scripts/user-manager.js`

### Docs (2)

- `CHANGELOG.md`
- `README.md`

### CI/Env (5)

- `.env.example`
- `.github/workflows/*.yml`
- `docker-compose.yml`

---

## Success Criteria

✅ Zero references to "free" plan  
✅ Zero references to Stripe (except logs "TODO:Polar")  
✅ Trial behaves EXACTLY like Starter (same limits)  
✅ All users migrated: Free → Starter Trial  
✅ Tests passing with >80% coverage  
✅ Frontend shows "Starter Trial 30 days"  
✅ BillingInterface ready for Polar integration  
✅ GDD health maintained (≥87)  
✅ No breaking changes in production

---

## Estimated Effort

- **Phase 1 (Entitlements):** 2-3 hours
- **Phase 2 (Billing Cleanup):** 3-4 hours
- **Phase 3 (Frontend):** 2-3 hours
- **Phase 4 (Migration):** 1 hour
- **Phase 5 (Tests):** 3-4 hours

**Total:** ~12-15 hours

---

## Rollback Plan

Si algo falla:

1. Revert database migration
2. Restore Stripe references (temporalmente)
3. Run reverse migration: Starter Trial → Free
4. Investigate logs y fix issues
5. Re-attempt migration

---

**Next Steps:** Comenzar con FASE 1 (Entitlements) después de aprobación.
