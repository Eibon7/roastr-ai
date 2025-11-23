# Polar Environment Variables - Configuration Guide

**Issue:** #594 - Polar Payment Integration  
**Created:** 2025-11-11  
**Status:** Production Ready

---

## Required Environment Variables

### Polar API Configuration

```bash
# Polar Access Token (Required)
# Get this from: https://polar.sh/dashboard/settings/api
POLAR_ACCESS_TOKEN=your_polar_access_token_here

# Polar Webhook Secret (Highly Recommended for Security)
# Get this from: https://polar.sh/dashboard/webhooks
# Used to verify webhook signatures (HMAC SHA-256)
POLAR_WEBHOOK_SECRET=your_webhook_secret_here
```

### Polar Price IDs

Configure these with your actual Price IDs from Polar Dashboard:

```bash
# Starter Trial Plan (Free with trial features)
POLAR_STARTER_PRICE_ID=your_starter_price_id

# Pro Plan (€15/month)
POLAR_PRO_PRICE_ID=your_pro_price_id

# Plus/Creator Plus Plan (€50/month)
POLAR_PLUS_PRICE_ID=your_plus_price_id
```

### Security: Price ID Allowlist

```bash
# Comma-separated list of allowed price IDs (prevents unauthorized purchases)
# This prevents attackers from purchasing arbitrary products
POLAR_ALLOWED_PRICE_IDS=your_starter_price_id,your_pro_price_id,your_plus_price_id
```

### Success URL (Optional - has default)

```bash
# URL to redirect after successful checkout
# Default: {protocol}://{host}/success?checkout_id={CHECKOUT_ID}
POLAR_SUCCESS_URL=https://yourapp.com/success?checkout_id={CHECKOUT_ID}
```

---

## Plan Mapping

Polar Price IDs map to internal plan names:

| Polar Price ID           | Internal Plan   | Database Value  | Description                   |
| ------------------------ | --------------- | --------------- | ----------------------------- |
| `POLAR_STARTER_PRICE_ID` | `starter_trial` | `starter_trial` | Free tier with trial features |
| `POLAR_PRO_PRICE_ID`     | `pro`           | `pro`           | Professional plan (€15/mo)    |
| `POLAR_PLUS_PRICE_ID`    | `creator_plus`  | `creator_plus`  | Premium plan (€50/mo)         |

**Mapping Logic:** Handled by `src/utils/polarHelpers.js`

---

## Security Notes

### ⚠️ CRITICAL: Never Expose in Frontend

```javascript
// ❌ NEVER do this:
const token = process.env.POLAR_ACCESS_TOKEN;
fetch('https://api.polar.sh/...', { headers: { Authorization: `Bearer ${token}` } });

// ✅ Always proxy through backend:
fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ price_id }) });
```

### Webhook Signature Verification

```javascript
// In src/routes/polarWebhook.js
function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

**Why:** Prevents fake webhook events from attackers.

---

## Setup Instructions

### 1. Get Polar Credentials

1. Sign up at https://polar.sh
2. Create products and prices in Dashboard
3. Go to Settings → API → Generate Access Token
4. Go to Webhooks → Create Webhook → Copy Secret

### 2. Configure Environment

```bash
# Copy example file (if not using .env.example)
cp .env .env.local

# Add Polar variables
echo "POLAR_ACCESS_TOKEN=your_token" >> .env.local
echo "POLAR_WEBHOOK_SECRET=your_secret" >> .env.local
# ... add price IDs
```

### 3. Test Configuration

```bash
# Verify environment variables are loaded
node -e "console.log(process.env.POLAR_ACCESS_TOKEN ? 'OK' : 'Missing')"

# Test checkout creation (with valid price_id)
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","price_id":"your_starter_price_id"}'
```

### 4. Configure Webhook Endpoint in Polar

1. Go to Polar Dashboard → Webhooks
2. Add endpoint: `https://yourapp.com/api/polar/webhook`
3. Select events:
   - `checkout.created`
   - `order.created` (payment confirmed)
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
4. Copy webhook secret to `POLAR_WEBHOOK_SECRET`

---

## Troubleshooting

### "Invalid price_id" Error

**Problem:** Price ID not in allowlist  
**Solution:** Add to `POLAR_ALLOWED_PRICE_IDS`

```bash
# Check current allowlist
echo $POLAR_ALLOWED_PRICE_IDS

# Add missing price ID
POLAR_ALLOWED_PRICE_IDS="existing_ids,new_price_id"
```

### Webhook Signature Verification Failing

**Problem:** Invalid signature  
**Solution:** Verify secret matches Polar dashboard

```bash
# Test signature locally
node scripts/test-polar-webhook-signature.js
```

### "POLAR_ACCESS_TOKEN not configured"

**Problem:** Missing environment variable  
**Solution:** Add to `.env` or `.env.local`

```bash
# Verify token is set
printenv | grep POLAR_ACCESS_TOKEN
```

---

## Migration from Stripe

If migrating from existing Stripe integration:

### 1. Keep Both Initially

```bash
# Stripe (legacy)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Polar (new)
POLAR_ACCESS_TOKEN=polar_xxx
POLAR_WEBHOOK_SECRET=whsec_yyy
```

### 2. Feature Flag

```bash
ENABLE_POLAR_BILLING=true  # Use Polar
ENABLE_STRIPE_BILLING=false  # Disable Stripe
```

### 3. Migrate Subscriptions

```bash
# Export active Stripe subscriptions
node scripts/export-stripe-subscriptions.js > subscriptions.json

# Manually create in Polar Dashboard
# No automated migration available
```

### 4. Remove Stripe Variables

After full migration:

```bash
# Remove Stripe vars from .env
sed -i '/STRIPE/d' .env
```

---

## References

- **Polar API Docs:** https://docs.polar.sh
- **Webhook Events:** https://docs.polar.sh/webhooks
- **Implementation:** `src/routes/checkout.js`, `src/routes/polarWebhook.js`
- **Helpers:** `src/utils/polarHelpers.js`
- **Tests:** `tests/unit/routes/polarWebhook.business.test.js`

---

**Last Updated:** 2025-11-11  
**Maintained By:** Backend Developer
