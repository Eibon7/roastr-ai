---
name: cost-control-validation-skill
description: Use when modifying billing, quotas, or cost control logic - validates tier limits match business model, prevents quota bypass, tests edge cases
triggers:
  - "costControl"
  - "billing"
  - "quota"
  - "subscription"
  - "tier"
  - "pricing"
  - "usage"
  - "credit"
used_by:
  - back-end-dev
  - guardian
  - billing-specialist
  - orchestrator
steps:
  - paso1: "Read current tier limits from src/services/costControl.js"
  - paso2: "Verify limits match business model (Free/Starter/Pro/Plus)"
  - paso3: "Test quota enforcement: Create usage that exceeds tier limit"
  - paso4: "Test upgrade path: Free→Starter, verify new quota applies immediately"
  - paso5: "Test downgrade: Pro→Starter, verify quota reduced safely (no data loss)"
  - paso6: "Check edge cases: Exactly at limit, 1 over limit, negative values, zero values"
  - paso7: "Verify costControl integrated in ALL credit-consuming API endpoints"
  - paso8: "Test concurrent requests at quota boundary (race conditions)"
output: |
  - Tier limits match business model documented
  - Quota enforcement tests pass (at-limit, over-limit, edge cases)
  - No bypass vulnerabilities found
  - Upgrade/downgrade paths work safely
  - All credit-consuming endpoints protected
---

# Cost Control Validation Skill

## Purpose

Validates billing, quotas, and cost control logic to protect revenue and ensure fair usage. Prevents quota bypass vulnerabilities and ensures tier limits match the business model.

**Critical:** Errors in cost control = money lost or angry customers.

## When to Use

**Triggers:**
- Modifying `src/services/costControl.js`
- Changing tier limits (Free, Starter, Pro, Plus)
- Adding new credit-consuming features
- Implementing upgrade/downgrade flows
- Security review (Guardian agent)
- Before releasing billing changes

**Guardian agent:** Always invoked when costControl.js is modified.

## Roastr Business Model

### Subscription Tiers

| Tier | Price | Roasts/Month | Target Audience |
|------|-------|--------------|-----------------|
| **Free** | €0 | 100 | Trial users, individuals |
| **Starter** | €5/mo | 1,000 | Small creators |
| **Pro** | €15/mo | 10,000 | Professional creators |
| **Plus** | €50/mo | Unlimited* | Agencies, brands |

*Unlimited = 1,000,000/month (soft cap with alert)

### Credit System

- **1 roast = 1 credit**
- Credits reset monthly on subscription renewal date
- Unused credits do NOT roll over
- Overage: Requests fail with `QUOTA_EXCEEDED` error

## Validation Process

### Step 1: Read Current Tier Limits

```javascript
// src/services/costControl.js
const TIER_LIMITS = {
  free: {
    roastsPerMonth: 100,
    maxConcurrentRequests: 5,
    rateLimitPerHour: 10
  },
  starter: {
    roastsPerMonth: 1000,
    maxConcurrentRequests: 10,
    rateLimitPerHour: 50
  },
  pro: {
    roastsPerMonth: 10000,
    maxConcurrentRequests: 20,
    rateLimitPerHour: 200
  },
  plus: {
    roastsPerMonth: 1000000,  // Soft cap
    maxConcurrentRequests: 50,
    rateLimitPerHour: 500
  }
};
```

**Verify against docs:**
```bash
Read: docs/nodes/cost-control.md
Read: docs/PRICING.md  # If exists
```

### Step 2: Verify Limits Match Business Model

**Checklist:**
- [ ] Free tier: 100 roasts/month
- [ ] Starter tier: 1,000 roasts/month (€5)
- [ ] Pro tier: 10,000 roasts/month (€15)
- [ ] Plus tier: Unlimited/1M roasts/month (€50)
- [ ] Rate limits appropriate per tier
- [ ] No hidden bypass mechanisms

**Compare code vs docs:**
```javascript
// If mismatch found
if (TIER_LIMITS.free.roastsPerMonth !== 100) {
  throw new Error('TIER_MISMATCH: Free tier limit does not match business model (expected 100)');
}
```

### Step 3: Test Quota Enforcement

**Test template:**
```javascript
// tests/integration/cost-control.test.js
describe('Cost control - quota enforcement', () => {
  let org;

  beforeEach(async () => {
    org = await createOrganization({ tier: 'free' });
  });

  it('should enforce Free tier quota (100 roasts)', async () => {
    // Use exactly 100 roasts (at limit)
    for (let i = 0; i < 100; i++) {
      const result = await generateRoast({
        orgId: org.id,
        comment: `Test comment ${i}`
      });
      expect(result.status).toBe('success');
    }

    // Verify usage
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(100);
    expect(usage.roastsLimit).toBe(100);

    // 101st roast should fail with QUOTA_EXCEEDED
    await expect(
      generateRoast({ orgId: org.id, comment: 'Over limit' })
    ).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
      message: expect.stringContaining('exceeded'),
      tier: 'free',
      used: 100,
      limit: 100
    });
  });

  it('should allow usage exactly at limit', async () => {
    // Use 99 roasts
    await useRoasts(org.id, 99);

    // 100th roast should succeed (at limit, not over)
    const result = await generateRoast({ orgId: org.id, comment: 'At limit' });
    expect(result.status).toBe('success');

    // 101st should fail
    await expect(
      generateRoast({ orgId: org.id, comment: 'Over limit' })
    ).rejects.toThrow('QUOTA_EXCEEDED');
  });

  it('should prevent negative usage manipulation', async () => {
    // Attempt to set negative usage (bypass attempt)
    await expect(
      setUsage(org.id, -10)
    ).rejects.toThrow('INVALID_USAGE');

    // Verify usage unchanged
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(0);
  });

  it('should handle zero usage correctly', async () => {
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(0);
    expect(usage.roastsLimit).toBe(100);
    expect(usage.remainingRoasts).toBe(100);
  });
});
```

### Step 4: Test Upgrade Path

```javascript
describe('Cost control - tier upgrades', () => {
  it('should apply new quota immediately on upgrade', async () => {
    const org = await createOrganization({ tier: 'free' });

    // Exhaust Free tier quota
    await useRoasts(org.id, 100);

    // Verify quota exhausted
    await expect(
      generateRoast({ orgId: org.id, comment: 'Should fail' })
    ).rejects.toThrow('QUOTA_EXCEEDED');

    // Upgrade to Starter (€5/mo, 1000 roasts)
    await upgradeTier(org.id, 'starter');

    // Verify new quota applied
    const usage = await getUsage(org.id);
    expect(usage.tier).toBe('starter');
    expect(usage.roastsLimit).toBe(1000);
    expect(usage.roastsUsed).toBe(100);  // Carried over
    expect(usage.remainingRoasts).toBe(900);

    // Should work now
    const result = await generateRoast({ orgId: org.id, comment: 'After upgrade' });
    expect(result.status).toBe('success');
  });

  it('should carry over usage on upgrade', async () => {
    const org = await createOrganization({ tier: 'free' });

    // Use 50 roasts on Free tier
    await useRoasts(org.id, 50);

    // Upgrade to Starter
    await upgradeTier(org.id, 'starter');

    // Verify usage carried over
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(50);
    expect(usage.roastsLimit).toBe(1000);
    expect(usage.remainingRoasts).toBe(950);
  });

  it('should reset usage on billing cycle after upgrade', async () => {
    const org = await createOrganization({ tier: 'starter' });

    // Use 500 roasts
    await useRoasts(org.id, 500);

    // Simulate billing cycle reset (monthly)
    await simulateBillingCycle(org.id);

    // Verify usage reset
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(0);
    expect(usage.roastsLimit).toBe(1000);
    expect(usage.remainingRoasts).toBe(1000);
  });
});
```

### Step 5: Test Downgrade Path

```javascript
describe('Cost control - tier downgrades', () => {
  it('should reduce quota on downgrade but not lose data', async () => {
    const org = await createOrganization({ tier: 'pro' });

    // Use 5000 roasts on Pro tier
    await useRoasts(org.id, 5000);

    // Downgrade to Starter (1000 limit)
    await downgradeTier(org.id, 'starter');

    // Verify new quota
    const usage = await getUsage(org.id);
    expect(usage.tier).toBe('starter');
    expect(usage.roastsLimit).toBe(1000);
    expect(usage.roastsUsed).toBe(5000);  // Usage NOT reset (prevents gaming)
    expect(usage.remainingRoasts).toBe(0);  // Over new limit

    // Should fail (over downgraded limit)
    await expect(
      generateRoast({ orgId: org.id, comment: 'After downgrade' })
    ).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
      message: expect.stringContaining('downgraded'),
      tier: 'starter'
    });

    // Wait for billing cycle reset
    await simulateBillingCycle(org.id);

    // Should work now (usage reset to 0)
    const result = await generateRoast({ orgId: org.id, comment: 'After reset' });
    expect(result.status).toBe('success');
  });

  it('should warn user before downgrade if usage > new limit', async () => {
    const org = await createOrganization({ tier: 'pro' });
    await useRoasts(org.id, 5000);

    // Attempt downgrade
    const warning = await checkDowngradeImpact(org.id, 'starter');

    expect(warning.canDowngrade).toBe(true);
    expect(warning.warning).toBe(true);
    expect(warning.message).toContain('current usage (5000) exceeds Starter limit (1000)');
    expect(warning.nextResetDate).toBeDefined();
  });
});
```

### Step 6: Test Edge Cases

```javascript
describe('Cost control - edge cases', () => {
  it('should handle concurrent requests at quota boundary', async () => {
    const org = await createOrganization({ tier: 'free' });
    await useRoasts(org.id, 99);  // 1 remaining

    // Send 10 concurrent requests (only 1 should succeed)
    const promises = Array(10).fill(null).map(() =>
      generateRoast({ orgId: org.id, comment: 'Concurrent test' })
        .catch(err => err)
    );

    const results = await Promise.all(promises);

    // Exactly 1 should succeed
    const successes = results.filter(r => r.status === 'success');
    const failures = results.filter(r => r.code === 'QUOTA_EXCEEDED');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);

    // Verify final usage
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(100);  // Not 109 (race condition prevented)
  });

  it('should handle large numbers correctly (Plus tier)', async () => {
    const org = await createOrganization({ tier: 'plus' });

    // Use 999,999 roasts (1 below soft cap)
    await useRoasts(org.id, 999999);

    // Should still work
    const result = await generateRoast({ orgId: org.id, comment: 'Near limit' });
    expect(result.status).toBe('success');

    // At soft cap (1M)
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(1000000);

    // Should trigger alert (but not block)
    const alerts = await getAlerts(org.id);
    expect(alerts).toContainEqual(
      expect.objectContaining({
        type: 'SOFT_CAP_REACHED',
        tier: 'plus',
        usage: 1000000
      })
    );
  });

  it('should prevent quota manipulation via direct DB access', async () => {
    const org = await createOrganization({ tier: 'free' });
    await useRoasts(org.id, 100);

    // Attempt direct DB manipulation (simulating attack)
    await expect(
      db.query('UPDATE organizations SET roasts_used = 0 WHERE id = $1', [org.id])
    ).rejects.toThrow();  // Should be prevented by DB constraints/triggers

    // Or if allowed, verify app still enforces
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(100);  // Not reset
  });
});
```

### Step 7: Verify All Endpoints Protected

**Check credit-consuming endpoints:**
```bash
# Find all endpoints that generate roasts
grep -r "generateRoast\|createRoast\|postReply" src/routes/
```

**Endpoints that MUST check quota:**
- `POST /api/roast/generate`
- `POST /api/roast/preview`
- `POST /api/reply` (if auto-reply enabled)
- `POST /api/analyze` (if counts towards quota)

**Validation:**
```javascript
// Example: src/routes/roast.js
router.post('/generate', authenticateJWT, async (req, res) => {
  const { organizationId } = req.user;

  // CRITICAL: Check quota BEFORE generating
  const canProceed = await costControl.checkQuota(organizationId, 'roast');

  if (!canProceed.allowed) {
    return res.status(429).json({
      error: 'QUOTA_EXCEEDED',
      message: 'Monthly roast limit exceeded',
      tier: canProceed.tier,
      used: canProceed.used,
      limit: canProceed.limit,
      resetDate: canProceed.resetDate
    });
  }

  // Generate roast
  const roast = await roastService.generate(req.body.comment);

  // CRITICAL: Increment usage AFTER success
  await costControl.incrementUsage(organizationId, 'roast', 1);

  return res.json({ roast });
});
```

**Test endpoint protection:**
```javascript
it('should block roast generation when quota exceeded', async () => {
  const org = await createOrganization({ tier: 'free' });
  const token = generateJWT({ organizationId: org.id });

  // Exhaust quota
  await useRoasts(org.id, 100);

  // Attempt API call
  const response = await request(app)
    .post('/api/roast/generate')
    .set('Authorization', `Bearer ${token}`)
    .send({ comment: 'Test comment' });

  expect(response.status).toBe(429);
  expect(response.body.error).toBe('QUOTA_EXCEEDED');
  expect(response.body.tier).toBe('free');
  expect(response.body.used).toBe(100);
  expect(response.body.limit).toBe(100);
  expect(response.body.resetDate).toBeDefined();
});
```

### Step 8: Test Race Conditions

```javascript
describe('Cost control - race condition protection', () => {
  it('should prevent double-charging on retry', async () => {
    const org = await createOrganization({ tier: 'free' });

    let attempts = 0;
    const mockGenerate = jest.fn(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('TRANSIENT_ERROR');  // Retry
      }
      return { roast: 'Test roast' };
    });

    // Generate with retry logic
    await generateRoastWithRetry(org.id, mockGenerate);

    // Verify only charged once (not twice for retry)
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(1);  // NOT 2
  });

  it('should use database transactions for usage increment', async () => {
    const org = await createOrganization({ tier: 'free' });

    // Simulate failure after increment (transaction should rollback)
    await expect(async () => {
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Increment usage
        await client.query(
          'UPDATE organizations SET roasts_used = roasts_used + 1 WHERE id = $1',
          [org.id]
        );

        // Simulate failure
        throw new Error('GENERATION_FAILED');

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');  // Should rollback increment
        throw error;
      } finally {
        client.release();
      }
    }).rejects.toThrow('GENERATION_FAILED');

    // Verify usage NOT incremented (transaction rolled back)
    const usage = await getUsage(org.id);
    expect(usage.roastsUsed).toBe(0);
  });
});
```

## Bypass Prevention

### Common Bypass Attempts

1. **Negative usage manipulation**
   ```javascript
   // PREVENT: Validate usage >= 0
   if (newUsage < 0) {
     throw new Error('INVALID_USAGE: Usage cannot be negative');
   }
   ```

2. **Direct database manipulation**
   ```sql
   -- PREVENT: Add DB constraint
   ALTER TABLE organizations
   ADD CONSTRAINT roasts_used_positive CHECK (roasts_used >= 0);

   -- PREVENT: Add trigger to log suspicious changes
   CREATE TRIGGER audit_usage_changes
   AFTER UPDATE ON organizations
   FOR EACH ROW EXECUTE FUNCTION log_usage_change();
   ```

3. **Time manipulation (billing cycle)**
   ```javascript
   // PREVENT: Use server time, not client time
   const resetDate = new Date(org.billingCycleStart);
   resetDate.setMonth(resetDate.getMonth() + 1);

   // NEVER trust client-provided dates
   ```

4. **Concurrent request flooding**
   ```javascript
   // PREVENT: Use database row locking
   await db.query('SELECT * FROM organizations WHERE id = $1 FOR UPDATE', [orgId]);
   ```

## Success Criteria

✅ Tier limits match business model exactly
✅ Quota enforcement tests pass (at-limit, over-limit)
✅ Edge cases handled (negative, zero, concurrent, large numbers)
✅ Upgrade path works (quota applied immediately)
✅ Downgrade path works (no data loss, usage carried over)
✅ All credit-consuming endpoints protected
✅ Race conditions prevented (transactions, locking)
✅ Bypass attempts blocked (negative usage, DB manipulation)
✅ Error messages clear and actionable
✅ Guardian agent approval obtained (for sensitive changes)

## References

- **Cost control logic:** `src/services/costControl.js`
- **Architecture:** `docs/nodes/cost-control.md`
- **Database schema:** `database/schema.sql` - Usage tracking tables
- **Test examples:** `tests/integration/cost-control.test.js`

## Related Skills

- **multi-tenant-context-skill** - Ensure usage tracked per org
- **security-audit-skill** - Security review for billing changes
- **test-generation-skill** - Generate edge case tests

## Reglas de Oro

### ❌ NEVER

1. Modify tier limits without Product Owner approval
2. Allow quota bypass (even for admins - create explicit override flag)
3. Skip edge case testing (at-limit, over-limit, negative, concurrent)
4. Trust client-provided usage data (always server-side validation)
5. Merge billing changes without Guardian agent review
6. Deploy billing changes without rollback plan

### ✅ ALWAYS

1. Test at-limit and over-limit scenarios
2. Test upgrade/downgrade paths thoroughly
3. Verify all credit-consuming endpoints protected
4. Use database transactions for usage updates
5. Prevent negative usage manipulation
6. Log all billing-related changes for audit
7. Get Product Owner approval for tier limit changes
8. Document changes in changelog
9. Test with real payment flow in staging (if possible)
10. Have rollback plan ready before deploying
