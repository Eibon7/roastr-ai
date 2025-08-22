# Stripe Configuration and Price Validation

This document covers the configuration of Stripe price lookup keys and the validation system implemented in Issue #171.

## Overview

The billing system uses Stripe Price objects with metadata to automatically configure user entitlements. Each plan (starter, pro, plus) has a corresponding Stripe Price with specific metadata that defines the plan's limits and features.

## Configuration Structure

### Environment Variables

The following environment variables control Stripe price lookup keys:

```bash
# Stripe Price Lookup Keys
STRIPE_PRICE_FREE_LOOKUP=roastr-free-v1
STRIPE_PRICE_STARTER_LOOKUP=roastr-starter-v1
STRIPE_PRICE_PRO_LOOKUP=roastr-pro-v1
STRIPE_PRICE_PLUS_LOOKUP=roastr-plus-v1

# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...  # Test key
STRIPE_SECRET_KEY=sk_live_...  # Production key (in production)
STRIPE_WEBHOOK_SECRET=whsec_...

# Billing URLs
STRIPE_SUCCESS_URL=https://yourdomain.com/billing?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourdomain.com/pricing
STRIPE_PORTAL_RETURN_URL=https://yourdomain.com/billing
```

### Configuration File

The lookup keys are centralized in `src/config/index.js`:

```javascript
billing: {
  stripe: {
    priceLookupKeys: {
      free: process.env.STRIPE_PRICE_FREE_LOOKUP || 'roastr-free-v1',
      starter: process.env.STRIPE_PRICE_STARTER_LOOKUP || 'roastr-starter-v1',
      pro: process.env.STRIPE_PRICE_PRO_LOOKUP || 'roastr-pro-v1',
      plus: process.env.STRIPE_PRICE_PLUS_LOOKUP || 'roastr-plus-v1'
    }
  }
}
```

## Stripe Price Metadata Schema

Each Stripe Price object must include the following metadata for the entitlements system to work correctly:

### Required Fields

| Field | Type | Description | Example Values |
|-------|------|-------------|----------------|
| `plan_name` | string | Plan identifier | `free`, `starter`, `pro`, `plus` |
| `analysis_limit_monthly` | string | Monthly toxicity analysis limit | `100`, `1000`, `10000`, `50000` |
| `roast_limit_monthly` | string | Monthly roast generation limit | `100`, `500`, `1000`, `5000` |
| `shield_limit_monthly` | string | Monthly Shield moderation actions | `0`, `50`, `100`, `500` |
| `model` | string | AI model to use | `gpt-3.5-turbo`, `gpt-4` |
| `shield_enabled` | string | Enable Shield moderation | `true`, `false` |
| `rqc_mode` | string | RQC system mode | `basic`, `advanced`, `premium` |

### Example Metadata

#### Free Plan
```json
{
  "plan_name": "free",
  "analysis_limit_monthly": "100",
  "roast_limit_monthly": "100",
  "shield_limit_monthly": "0",
  "model": "gpt-3.5-turbo",
  "shield_enabled": "false",
  "rqc_mode": "basic"
}
```

#### Starter Plan
```json
{
  "plan_name": "starter",
  "analysis_limit_monthly": "1000",
  "roast_limit_monthly": "500",
  "shield_limit_monthly": "50",
  "model": "gpt-3.5-turbo",
  "shield_enabled": "true",
  "rqc_mode": "basic"
}
```

#### Pro Plan
```json
{
  "plan_name": "pro",
  "analysis_limit_monthly": "10000",
  "roast_limit_monthly": "1000",
  "shield_limit_monthly": "100",
  "model": "gpt-4",
  "shield_enabled": "true",
  "rqc_mode": "advanced"
}
```

#### Plus Plan
```json
{
  "plan_name": "plus",
  "analysis_limit_monthly": "50000",
  "roast_limit_monthly": "5000",
  "shield_limit_monthly": "500",
  "model": "gpt-4",
  "shield_enabled": "true",
  "rqc_mode": "premium"
}
```

## Validation System

### Manual Validation

Run the validation script manually:

```bash
# Validate with current environment
npm run validate:prices

# Validate with specific Stripe key
STRIPE_SECRET_KEY=sk_test_... npm run validate:prices

# CI validation (with billing enabled)
npm run validate:prices:ci
```

### Automated Validation

The system includes automated validation through GitHub Actions:

#### Triggers
- **Push/PR**: Validates when billing-related files change
- **Daily Schedule**: Runs at 6 AM UTC to detect configuration drift
- **Manual Dispatch**: Can be triggered manually for test or production

#### Environments
- **Test Environment**: Validates using `STRIPE_TEST_SECRET_KEY`
- **Production Environment**: Validates using `STRIPE_LIVE_SECRET_KEY` (main branch only)

### Validation Outputs

#### Success Example
```
🚀 Starting Stripe Price metadata validation...

🔑 Stripe client initialized
📍 Using lookup keys from config:
   starter: price_starter_v1_eur_500
   pro: price_pro_v1_eur_1500
   plus: price_plus_v1_eur_5000

🔍 Validating starter plan (lookup_key: price_starter_v1_eur_500)...
✅ Found price: price_1234567890
✅ All metadata is valid for starter plan
📊 Metadata summary:
   plan_name: starter
   analysis_limit_monthly: 500
   roast_limit_monthly: 500
   model: gpt-3.5-turbo
   shield_enabled: false
   rqc_mode: basic

📋 Validation Summary:
✅ All configured Stripe prices have valid metadata
🎉 Entitlements system is properly configured
```

#### Failure Example
```
🔍 Validating pro plan (lookup_key: price_pro_v1_eur_1500)...
✅ Found price: price_1234567890
❌ Missing required metadata fields: shield_enabled, rqc_mode
❌ Incorrect metadata values:
   model: expected "gpt-4", got "gpt-3.5-turbo"

📋 Validation Summary:
❌ Some Stripe prices have invalid or missing metadata
🔧 Please update your Stripe prices and try again
```

## Setting Up Stripe Prices

### 1. Create Prices in Stripe Dashboard

1. Go to Stripe Dashboard → Products
2. Create a new product for each plan
3. Add prices with the correct lookup keys
4. Set metadata according to the schema above

### 2. Configure Lookup Keys

Update your environment variables or `.env` file:

```bash
STRIPE_PRICE_STARTER_LOOKUP=your_actual_starter_lookup_key
STRIPE_PRICE_PRO_LOOKUP=your_actual_pro_lookup_key
STRIPE_PRICE_PLUS_LOOKUP=your_actual_plus_lookup_key
```

### 3. Validate Configuration

Run validation to ensure everything is configured correctly:

```bash
npm run validate:prices
```

## Troubleshooting

### Common Issues

#### "No price found with lookup_key"
- Verify the lookup key exists in Stripe Dashboard
- Check that you're using the correct Stripe environment (test/live)
- Ensure environment variables are set correctly

#### "Missing required metadata fields"
- Add the missing fields to the Stripe Price metadata
- Ensure all field names match exactly (case-sensitive)
- All values must be strings, even numbers and booleans

#### "Incorrect metadata values"
- Check the expected values in the validation script
- Update Stripe Price metadata to match expectations
- Ensure boolean values are strings: `"true"` or `"false"`

### Debug Steps

1. **Check Configuration**:
   ```bash
   node -e "console.log(require('./src/config').billing.stripe.priceLookupKeys)"
   ```

2. **Verify Stripe Connection**:
   ```bash
   STRIPE_SECRET_KEY=sk_test_... node -e "
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   stripe.prices.list({limit: 1}).then(console.log).catch(console.error);
   "
   ```

3. **Check Specific Price**:
   ```bash
   STRIPE_SECRET_KEY=sk_test_... node -e "
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   stripe.prices.list({lookup_keys: ['your_lookup_key']}).then(console.log);
   "
   ```

## Security Considerations

- **Never commit real API keys** to version control
- **Use test keys** in development and CI
- **Restrict API key permissions** in Stripe Dashboard
- **Monitor validation failures** as they may indicate security issues

## Integration with Entitlements System

The validation system ensures that:

1. **EntitlementsService** can properly read price metadata
2. **Webhook processing** works correctly for subscription events
3. **Plan changes** apply the correct limits and features
4. **Billing flow** maintains consistency across environments

## Monitoring and Alerts

### Automated Monitoring
- Daily validation runs detect configuration drift
- Failed validations create GitHub issues automatically
- PR comments alert developers to validation failures

### Manual Monitoring
- Run validation before deployments
- Check after manual Stripe configuration changes
- Validate both test and production environments

## Related Documentation

- [Entitlements System](./entitlements.md) - How the metadata is used
- [Webhook Processing](./webhooks.md) - Subscription lifecycle handling
- [CLAUDE.md](../../CLAUDE.md) - General project documentation

## Version History

- **v1.0** (Issue #171) - Initial implementation
  - Centralized lookup key configuration
  - Validation script with comprehensive checks
  - GitHub Actions CI integration
  - Configuration drift detection