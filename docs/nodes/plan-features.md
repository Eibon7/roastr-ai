# Plan Features - Subscription Plan Feature Gates & Limits

**Node ID:** `plan-features`
**Owner:** Back-end Dev
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-10-09
**Coverage:** 70%
**Coverage Source:** auto
**Related PRs:** #499

## Dependencies

- `multi-tenant` - Row Level Security (RLS) and organization isolation

## Overview

Plan Features manages subscription-based feature gating and usage limits across four tiers (Free, Starter, Pro, Plus). It enforces monthly roast/analysis limits, platform access, and premium features like RQC and Shield.

## Plan Tiers

| Feature | Free | Starter (€5/mo) | Pro (€15/mo) | Plus (€50/mo) |
|---------|------|-----------------|--------------|---------------|
| **Monthly Roasts** | 10 | 10 | 1,000 | 5,000 |
| **Monthly Analysis** | 100 | 1,000 | 10,000 | 100,000 |
| **Max Platforms** | 1 | 2 | 5 | 10 |
| **AI Model** | GPT-3.5 | GPT-4o/GPT-5 | GPT-4o/GPT-5 | GPT-4o/GPT-5 |
| **RQC (Quality Control)** | ❌ | ❌ | ✅ | ✅ Advanced |
| **Shield (Moderation)** | ❌ | ✅ Basic | ✅ Full | ✅ Advanced |
| **Custom Styles** | ❌ | ❌ | ❌ | ✅ |
| **Persona Fields** | ❌ | 1 field | 3 fields | 3 fields |
| **Priority Support** | ❌ | ❌ | ✅ | ✅ 24/7 |

## Database Schema

### Table: plan_limits

```sql
CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id VARCHAR(50) NOT NULL UNIQUE,  -- 'free', 'starter', 'pro', 'plus'
  plan_name VARCHAR(100) NOT NULL,
  plan_description TEXT,

  -- Usage limits
  max_roasts INTEGER NOT NULL,
  monthly_responses_limit INTEGER NOT NULL,
  monthly_analysis_limit INTEGER NOT NULL,
  max_platforms INTEGER NOT NULL,

  -- Feature gates
  rqc_enabled BOOLEAN DEFAULT FALSE,
  shield_enabled BOOLEAN DEFAULT FALSE,

  -- Feature list (JSONB array)
  features JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Plan Data

```sql
-- Free Plan
('free', 'Free', 'Basic plan', 10, 10, 100, 1, FALSE, FALSE,
 '["basic_roasts", "single_platform"]')

-- Starter Plan
('starter', 'Starter', 'Entry plan with GPT-5 and Shield', 10, 10, 1000, 2, FALSE, TRUE,
 '["gpt5_roasts", "shield_basic", "basic_integrations", "email_support"]')

-- Pro Plan
('pro', 'Pro', 'Professional plan', 1000, 1000, 10000, 5, TRUE, TRUE,
 '["advanced_rqc", "shield_full", "priority_support", "custom_styles", "analytics"]')

-- Plus Plan
('plus', 'Plus', 'Premium tier', 5000, 5000, 100000, 10, TRUE, TRUE,
 '["advanced_rqc", "shield_advanced", "custom_styles", "24_7_support"]')
```

## Feature Gating

### Check Plan Access

```javascript
const { supabaseServiceClient } = require('./config/supabase');

async function canUseFeature(organizationId, feature) {
  const { data: org } = await supabaseServiceClient
    .from('organizations')
    .select('plan_id, plan_limits(*)')
    .eq('id', organizationId)
    .single();

  if (!org) return { allowed: false, reason: 'organization_not_found' };

  const { plan_limits } = org;
  const features = plan_limits.features || [];

  // Check feature in features array
  if (!features.includes(feature)) {
    return {
      allowed: false,
      reason: 'plan_restriction',
      required_plan: getMinimumPlanForFeature(feature),
      current_plan: org.plan_id
    };
  }

  return { allowed: true };
}
```

### Usage Limit Enforcement

```javascript
const { CostControlService } = require('./services/costControl');

async function checkRoastLimit(organizationId) {
  const costControl = new CostControlService();

  // Get usage this month
  const usage = await costControl.getMonthlyUsage(organizationId, 'roast');

  // Get plan limits
  const { data: org } = await supabaseServiceClient
    .from('organizations')
    .select('plan_limits(max_roasts)')
    .eq('id', organizationId)
    .single();

  const limit = org.plan_limits.max_roasts;

  if (usage.count >= limit) {
    return {
      allowed: false,
      reason: 'monthly_limit_exceeded',
      usage: usage.count,
      limit: limit,
      reset_date: usage.reset_date
    };
  }

  return {
    allowed: true,
    remaining: limit - usage.count,
    usage: usage.count,
    limit: limit
  };
}
```

## Feature Flags by Plan

### RQC (Roast Quality Control)

- **Free/Starter:** ❌ Disabled
- **Pro/Plus:** ✅ Enabled
- **Plus Advanced:** 3 parallel reviewers, higher quality threshold

### Shield (Automated Moderation)

- **Free:** ❌ Disabled
- **Starter:** ✅ Basic (essential actions only)
- **Pro:** ✅ Full (all Shield features)
- **Plus:** ✅ Advanced (priority actions, custom rules)

### AI Models

- **Free:** GPT-3.5 Turbo only
- **Starter/Pro/Plus:** GPT-4o (auto-upgrades to GPT-5 when available)

### Persona Fields

- **Free:** ❌ No persona customization
- **Starter:** ✅ 1 field ("Lo que me define")
- **Pro/Plus:** ✅ All 3 fields (identity, intolerance, tolerance)

## Integration with Cost Control

**Dependency:** `cost-control` node

```javascript
// Record usage and check limits
await costControl.recordUsage(
  organizationId,
  platform,
  'roast',
  { tokens: 500, model: 'gpt-4o' },
  userId,
  1  // quantity
);

// Check if approaching limit
const status = await costControl.getUsageStatus(organizationId);

if (status.roasts.percentage >= 90) {
  // Send warning email
  await sendLimitWarning(organizationId, status);
}

if (status.roasts.percentage >= 100) {
  // Block new roasts
  throw new Error('Monthly roast limit exceeded');
}
```

## Plan Upgrade Flow

```javascript
async function upgradePlan(organizationId, newPlanId) {
  // Validate new plan
  const { data: newPlan } = await supabaseServiceClient
    .from('plan_limits')
    .select('*')
    .eq('plan_id', newPlanId)
    .single();

  if (!newPlan) {
    throw new Error(`Invalid plan: ${newPlanId}`);
  }

  // Update organization
  const { error } = await supabaseServiceClient
    .from('organizations')
    .update({
      plan_id: newPlanId,
      updated_at: new Date().toISOString()
    })
    .eq('id', organizationId);

  if (error) throw error;

  // Reset usage counters (optional, based on billing cycle)
  await costControl.resetUsageCounters(organizationId);

  // Audit log
  await auditLog({
    organization_id: organizationId,
    action: 'plan_upgraded',
    details: {
      new_plan: newPlanId,
      previous_plan: currentPlanId,
      features_added: newPlan.features
    }
  });

  return { success: true, new_plan: newPlan };
}
```

## Testing

```javascript
describe('Plan Features', () => {
  test('Free plan blocks RQC access', async () => {
    const result = await canUseFeature(freeOrgId, 'advanced_rqc');

    expect(result.allowed).toBe(false);
    expect(result.required_plan).toBe('pro');
  });

  test('Pro plan allows Shield full access', async () => {
    const result = await canUseFeature(proOrgId, 'shield_full');

    expect(result.allowed).toBe(true);
  });

  test('Monthly limit enforced correctly', async () => {
    // Simulate 10 roasts used (Free plan limit)
    await simulateUsage(freeOrgId, 'roast', 10);

    const result = await checkRoastLimit(freeOrgId);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('monthly_limit_exceeded');
    expect(result.usage).toBe(10);
    expect(result.limit).toBe(10);
  });

  test('Plus plan has 5,000 roasts/month', async () => {
    const result = await checkRoastLimit(plusOrgId);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5000);
  });
});
```

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `plan_restriction` | Feature not available on current plan | Upgrade to required plan |
| `monthly_limit_exceeded` | Usage limit reached | Wait for reset or upgrade plan |
| `invalid_plan` | Plan ID not found | Use valid plan ID from plan_limits |
| `downgrade_not_allowed` | Attempt to downgrade with active features | Disable features first |

## Future Enhancements

- [ ] Usage-based pricing (pay-as-you-go)
- [ ] Custom enterprise plans
- [ ] Feature add-ons (à la carte)
- [ ] Team collaboration features
- [ ] Annual billing discounts


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer**
- **Documentation Agent**
- **Product Manager**
- **Test Engineer**


## Related Nodes

- **multi-tenant** - Organization isolation for plan data
- **cost-control** - Usage tracking and limit enforcement
- **persona** - Feature gates for persona fields
- **roast** - Model selection and RQC based on plan
- **shield** - Shield tier based on plan

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** On pricing changes or new features
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0
