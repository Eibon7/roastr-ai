# Migration Guide: PRICE_ID → PRODUCT_ID (Issue #887)

**Issue:** #887 - Migrar PRICE_ID a PRODUCT_ID para Polar  
**Status:** ✅ Completed  
**Date:** 2025-11-19  
**Related:** Issue #808 - Migrar tests de billing de Stripe a Polar

---

## 🎯 Overview

This migration refactors the codebase to use Polar's `product_id` instead of Stripe's legacy `price_id`. The change is **backward compatible** - existing integrations using `price_id` will continue to work during the transition period.

---

## 📋 What Changed

### Code Changes

1. **`src/utils/polarHelpers.js`**
   - `PRICE_ID_TO_PLAN` → `PRODUCT_ID_TO_PLAN`
   - New functions: `getPlanFromProductId()`, `getProductIdFromPlan()`
   - Legacy functions maintained with deprecation warnings

2. **`src/routes/checkout.js`**
   - Parameter: `product_id` (new, preferred)
   - Parameter: `price_id` (legacy, still accepted)
   - Environment variable: `POLAR_ALLOWED_PRODUCT_IDS` (new)

3. **`src/routes/polarWebhook.js`**
   - Handles both `product_id` and `product_price_id` fields
   - Uses `getPlanFromProductId()` with legacy fallback

4. **`src/services/entitlementsService.js`**
   - Updated to use `polarProductId` parameter
   - Logs updated to "Polar Product" terminology

### Environment Variables

**New Variables:**

- `POLAR_STARTER_PRODUCT_ID` (replaces `POLAR_STARTER_PRICE_ID`)
- `POLAR_PRO_PRODUCT_ID` (replaces `POLAR_PRO_PRICE_ID`)
- `POLAR_PLUS_PRODUCT_ID` (replaces `POLAR_PLUS_PRICE_ID`)
- `POLAR_ALLOWED_PRODUCT_IDS` (new, optional, replaces `POLAR_ALLOWED_PRICE_IDS`)

**Note:** The `.env` file should already have these variables configured. If not, see [Environment Setup](#environment-setup).

---

## 🔄 Migration Steps for Existing Integrations

### Step 1: Update Environment Variables

Update your `.env` file:

```bash
# OLD (deprecated):
# POLAR_STARTER_PRICE_ID=price_xxx
# POLAR_PRO_PRICE_ID=price_yyy
# POLAR_PLUS_PRICE_ID=price_zzz

# NEW (required):
POLAR_STARTER_PRODUCT_ID=prod_xxx
POLAR_PRO_PRODUCT_ID=prod_yyy
POLAR_PLUS_PRODUCT_ID=prod_zzz
POLAR_ALLOWED_PRODUCT_IDS=prod_xxx,prod_yyy,prod_zzz
```

### Step 2: Update API Calls

**Checkout Endpoint:**

```javascript
// OLD (still works, but deprecated):
POST /api/checkout
{
  "customer_email": "user@example.com",
  "price_id": "prod_xxx"
}

// NEW (preferred):
POST /api/checkout
{
  "customer_email": "user@example.com",
  "product_id": "prod_xxx"
}
```

**Helper Functions:**

```javascript
// OLD (deprecated, shows warning):
const plan = getPlanFromPriceId('prod_xxx');
const productId = getPriceIdFromPlan('pro');

// NEW (preferred):
const plan = getPlanFromProductId('prod_xxx');
const productId = getProductIdFromPlan('pro');
```

### Step 3: Update Webhook Handlers

Webhooks from Polar may send either `product_id` or `product_price_id`. The code handles both automatically, but you should update your handlers to prefer `product_id`:

```javascript
// OLD:
const priceId = webhookEvent.product_price_id;

// NEW:
const productId = webhookEvent.product_id || webhookEvent.product_price_id;
```

### Step 4: Verify Logs

Check that logs show "Polar Product" terminology (not "Polar Price"):

```bash
# Good:
[Polar] Product ID allowlist configured
[Polar] Entitlements updated from Polar Product

# Deprecated (will show warnings):
[Polar Helpers] getPlanFromPriceId is deprecated, use getPlanFromProductId
```

---

## 🧪 Testing

### Automated Tests

Run the new refactor tests:

```bash
# Unit tests for migration
npm test -- tests/unit/utils/polarHelpers.refactor.test.js

# Integration tests for checkout
npm test -- tests/integration/checkout.product-id.test.js
```

### Manual Testing Checklist

- [ ] **Checkout with `product_id`**

  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"customer_email": "test@example.com", "product_id": "prod_xxx"}'
  ```

- [ ] **Checkout with `price_id` (backward compatibility)**

  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"customer_email": "test@example.com", "price_id": "prod_xxx"}'
  ```

- [ ] **Webhook processing with `product_id`**
  - Send test webhook from Polar dashboard
  - Verify webhook is processed correctly
  - Check logs show "Polar Product" terminology

- [ ] **Deprecation warnings**
  - Call legacy functions (`getPlanFromPriceId()`)
  - Verify warning appears in logs
  - Verify functionality still works

---

## ⏰ Timeline

### Phase 1: Migration (Current - Issue #887) ✅

- **Status:** Completed
- **Duration:** 2025-11-19
- **Changes:** Code refactored, backward compatibility maintained
- **Action Required:** Update environment variables and API calls

### Phase 2: Testing (Issue #808) 🔄

- **Status:** In Progress
- **Duration:** TBD
- **Changes:** Comprehensive test migration from Stripe to Polar
- **Action Required:** Run full test suite, validate all flows

### Phase 3: Legacy Removal (Future)

- **Status:** Planned
- **Timeline:** After Issue #808 completion + 30 days grace period
- **Changes:** Remove deprecated functions (`getPlanFromPriceId()`, etc.)
- **Action Required:** Update all integrations to use new API

**Estimated Legacy Removal Date:** ~2026-01-19 (30 days after Issue #808)

---

## 🔙 Rollback Plan

If issues arise post-merge, you can rollback by:

### Option 1: Revert PR #888

```bash
git revert <merge-commit-hash>
git push origin main
```

### Option 2: Temporary Workaround (if partial rollback needed)

Keep using `price_id` parameter in API calls (still supported):

```javascript
// This still works during transition:
POST /api/checkout
{
  "price_id": "prod_xxx"  // Legacy parameter, still accepted
}
```

### Option 3: Environment Variable Fallback

The code supports both variable names during transition:

```bash
# Both work (product_id preferred):
POLAR_STARTER_PRODUCT_ID=prod_xxx
POLAR_STARTER_PRICE_ID=prod_xxx  # Fallback (if PRODUCT_ID not set)
```

---

## 📚 Related Documentation

- **Issue #887:** [PR #888](https://github.com/Eibon7/roastr-ai/pull/888)
- **Issue #808:** Migration summary in `docs/plan/issue-808-migration-summary.md`
- **Polar Setup:** `docs/plan/issue-808-credenciales-polar.md`
- **Environment Variables:** `.env.example`

---

## ❓ FAQ

**Q: Do I need to update my code immediately?**  
A: No. The migration is backward compatible. Legacy `price_id` parameters will continue to work, but you'll see deprecation warnings in logs.

**Q: When will legacy support be removed?**  
A: Estimated ~30 days after Issue #808 completion. We'll provide advance notice before removal.

**Q: What if I see "Unknown product_id" errors?**  
A: Check that your `.env` file has `POLAR_*_PRODUCT_ID` variables set (not `POLAR_*_PRICE_ID`).

**Q: Can I use both `product_id` and `price_id` in the same request?**  
A: Yes, but `product_id` takes precedence if both are provided.

---

**Last Updated:** 2025-11-19  
**Maintained By:** Development Team
