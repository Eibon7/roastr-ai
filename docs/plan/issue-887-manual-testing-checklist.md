# Manual Testing Checklist - Issue #887

**PR:** #888  
**Issue:** #887 - Migrar PRICE_ID a PRODUCT_ID para Polar  
**Date:** 2025-11-19  
**Status:** ⏳ Pending Manual Testing

---

## 🎯 Testing Objectives

Validate that the PRICE_ID → PRODUCT_ID migration works correctly while maintaining backward compatibility.

---

## ✅ Pre-Testing Setup

- [ ] Environment variables configured:
  ```bash
  POLAR_STARTER_PRODUCT_ID=prod_xxx
  POLAR_PRO_PRODUCT_ID=prod_yyy
  POLAR_PLUS_PRODUCT_ID=prod_zzz
  POLAR_ALLOWED_PRODUCT_IDS=prod_xxx,prod_yyy,prod_zzz
  ```
- [ ] Server running: `npm start`
- [ ] Polar dashboard access (for webhook testing)
- [ ] Test user account created

---

## 1. Checkout Flow with `product_id` ✅

### Test Case 1.1: Create Checkout with `product_id`

- [ ] **Action:** POST `/api/checkout` with `product_id`
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "customer_email": "test@example.com",
      "product_id": "prod_pro_test"
    }'
  ```
- [ ] **Expected:** Status 200, `checkout_url` returned
- [ ] **Verify:** Logs show "Polar Product" terminology (not "Polar Price")
- [ ] **Result:** ✅ / ❌

### Test Case 1.2: Checkout with Invalid `product_id`

- [ ] **Action:** POST with unauthorized `product_id`
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "customer_email": "test@example.com",
      "product_id": "prod_unauthorized"
    }'
  ```
- [ ] **Expected:** Status 400, error "Unauthorized product"
- [ ] **Verify:** Warning logged about unauthorized product_id
- [ ] **Result:** ✅ / ❌

### Test Case 1.3: Checkout with Missing `product_id`

- [ ] **Action:** POST without `product_id` or `price_id`
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "customer_email": "test@example.com"
    }'
  ```
- [ ] **Expected:** Status 400, error "Missing required fields"
- [ ] **Result:** ✅ / ❌

---

## 2. Backward Compatibility with `price_id` ✅

### Test Case 2.1: Create Checkout with `price_id` (Legacy)

- [ ] **Action:** POST `/api/checkout` with `price_id` (legacy parameter)
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "customer_email": "test@example.com",
      "price_id": "prod_pro_test"
    }'
  ```
- [ ] **Expected:** Status 200, checkout created successfully
- [ ] **Verify:** Functionality works (backward compatibility maintained)
- [ ] **Result:** ✅ / ❌

### Test Case 2.2: Both `product_id` and `price_id` Provided

- [ ] **Action:** POST with both parameters
  ```bash
  curl -X POST http://localhost:3000/api/checkout \
    -H "Content-Type: application/json" \
    -d '{
      "customer_email": "test@example.com",
      "product_id": "prod_pro_test",
      "price_id": "prod_starter_test"
    }'
  ```
- [ ] **Expected:** Status 200, `product_id` takes precedence
- [ ] **Verify:** `product_id` value used (not `price_id`)
- [ ] **Result:** ✅ / ❌

---

## 3. Webhook Processing with `product_id` ✅

### Test Case 3.1: Webhook with `product_id` Field

- [ ] **Action:** Send test webhook from Polar dashboard with `product_id`
- [ ] **Expected:** Webhook processed successfully
- [ ] **Verify:**
  - [ ] Webhook event logged
  - [ ] Logs show "Polar Product" terminology
  - [ ] Entitlements updated correctly
- [ ] **Result:** ✅ / ❌

### Test Case 3.2: Webhook with `product_price_id` Field (Legacy)

- [ ] **Action:** Send test webhook with `product_price_id` (legacy field)
- [ ] **Expected:** Webhook processed successfully (backward compatibility)
- [ ] **Verify:**
  - [ ] Webhook event logged
  - [ ] Fallback to `product_price_id` works
  - [ ] Entitlements updated correctly
- [ ] **Result:** ✅ / ❌

### Test Case 3.3: Webhook with Both Fields

- [ ] **Action:** Send webhook with both `product_id` and `product_price_id`
- [ ] **Expected:** `product_id` takes precedence
- [ ] **Verify:** Correct product ID used for plan mapping
- [ ] **Result:** ✅ / ❌

---

## 4. Deprecation Warnings ✅

### Test Case 4.1: Legacy Function Calls

- [ ] **Action:** Call `getPlanFromPriceId()` in code/logs
- [ ] **Expected:** Warning logged: "getPlanFromPriceId is deprecated"
- [ ] **Verify:** Function still works (backward compatibility)
- [ ] **Result:** ✅ / ❌

### Test Case 4.2: Legacy Helper Functions

- [ ] **Action:** Call `getPriceIdFromPlan()` or `getConfiguredPriceIds()`
- [ ] **Expected:** Deprecation warnings in logs
- [ ] **Verify:** Functions return correct values
- [ ] **Result:** ✅ / ❌

---

## 5. Logging Verification ✅

### Test Case 5.1: "Polar Product" Terminology

- [ ] **Action:** Review logs after checkout/webhook operations
- [ ] **Expected:** Logs use "Polar Product" (not "Polar Price")
- [ ] **Verify:**
  - [ ] "Product ID allowlist configured"
  - [ ] "Entitlements updated from Polar Product"
  - [ ] No "Polar Price" terminology (except in deprecation warnings)
- [ ] **Result:** ✅ / ❌

### Test Case 5.2: Error Messages

- [ ] **Action:** Trigger errors (invalid product_id, missing config)
- [ ] **Expected:** Error messages use "product_id" terminology
- [ ] **Verify:** Messages are clear and actionable
- [ ] **Result:** ✅ / ❌

---

## 6. Environment Variable Validation ✅

### Test Case 6.1: Missing `POLAR_*_PRODUCT_ID`

- [ ] **Action:** Remove `POLAR_PRO_PRODUCT_ID` from `.env`
- [ ] **Expected:** Error when calling `getProductIdFromPlan('pro')`
- [ ] **Verify:** Error message mentions missing environment variable
- [ ] **Result:** ✅ / ❌

### Test Case 6.2: `POLAR_ALLOWED_PRODUCT_IDS` Not Configured

- [ ] **Action:** Remove `POLAR_ALLOWED_PRODUCT_IDS` from `.env`
- [ ] **Expected:** Warning logged: "product validation disabled (INSECURE!)"
- [ ] **Verify:** Checkout still works (validation disabled)
- [ ] **Result:** ✅ / ❌

### Test Case 6.3: Fallback to `POLAR_ALLOWED_PRICE_IDS`

- [ ] **Action:** Remove `POLAR_ALLOWED_PRODUCT_IDS`, keep `POLAR_ALLOWED_PRICE_IDS`
- [ ] **Expected:** Code uses `POLAR_ALLOWED_PRICE_IDS` as fallback
- [ ] **Verify:** Validation still works with legacy variable
- [ ] **Result:** ✅ / ❌

---

## 📊 Test Results Summary

| Category                   | Tests  | Passed | Failed | Notes |
| -------------------------- | ------ | ------ | ------ | ----- |
| Checkout with `product_id` | 3      |        |        |       |
| Backward Compatibility     | 2      |        |        |       |
| Webhook Processing         | 3      |        |        |       |
| Deprecation Warnings       | 2      |        |        |       |
| Logging Verification       | 2      |        |        |       |
| Environment Variables      | 3      |        |        |       |
| **TOTAL**                  | **15** |        |        |       |

---

## 🐛 Issues Found

### Critical Issues

- [ ] None

### Minor Issues

- [ ] None

### Observations

- [ ] None

---

## ✅ Sign-Off

- [ ] All critical tests passing
- [ ] Backward compatibility verified
- [ ] Logging terminology correct
- [ ] Documentation reviewed
- [ ] Ready for merge

**Tester:** **\*\*\*\***\_**\*\*\*\***  
**Date:** **\*\*\*\***\_**\*\*\*\***  
**Status:** ✅ APPROVED / ❌ NEEDS FIXES

---

## 📝 Notes

_Add any additional observations or issues found during testing here._

---

**Last Updated:** 2025-11-19  
**Related:** PR #888, Issue #887, `docs/plan/issue-887-migration-guide.md`
