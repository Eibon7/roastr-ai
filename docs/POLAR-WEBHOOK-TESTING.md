# Testing Polar Webhook Locally

This guide shows you how to test the Polar webhook integration in your local development environment.

## Quick Start

### Method 1: Using the Helper Script (Recommended)

```bash
# Terminal 1 - Start your backend
npm start

# Terminal 2 - Expose webhook with ngrok
./scripts/test-polar-webhook.sh
```

The script will:

- ✅ Check if ngrok is installed
- ✅ Verify the server is running
- ✅ Expose your local webhook publicly
- ✅ Show you step-by-step instructions

---

## Method 2: Manual Setup

### Step 1: Install ngrok

**macOS:**

```bash
brew install ngrok
```

**Linux:**

```bash
snap install ngrok
```

**Windows:**
Download from https://ngrok.com/download

**Alternative - localtunnel:**

```bash
npm install -g localtunnel
```

### Step 2: Start Your Backend

```bash
npm start
# Server runs on http://localhost:3000
```

### Step 3: Expose Webhook Publicly

**Using ngrok:**

```bash
ngrok http 3000
```

**Using localtunnel:**

```bash
lt --port 3000 --subdomain roastr-polar
```

You'll see output like:

```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

Copy the **HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 4: Register Webhook in Polar Dashboard

1. Go to https://polar.sh/dashboard/webhooks

2. Click **"Add Webhook"**

3. Configure:
   - **URL**: `https://abc123.ngrok.io/api/polar/webhook`
   - **Events**: Select all events (or specific ones):
     - `checkout.created`
     - `checkout.updated`
     - `order.created` ⭐ (most important - payment confirmed)
     - `subscription.created`
     - `subscription.updated`
     - `subscription.canceled`

4. Click **"Create Webhook"**

5. Copy the **Webhook Secret** shown (looks like `whsec_xxxxxxxxxxxxx`)

### Step 5: Add Secret to .env

```bash
# Add to .env file
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 6: Restart Server

```bash
# Stop the server (Ctrl+C) and restart
npm start
```

---

## Testing the Webhook

### Test 1: Create a Checkout

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@example.com",
    "price_id": "your_polar_price_id"
  }'
```

**Expected response:**

```json
{
  "success": true,
  "checkout": {
    "id": "checkout_xxxxx",
    "url": "https://polar.sh/checkout/xxxxx",
    ...
  }
}
```

### Test 2: Complete the Checkout

1. Open the `checkout.url` from the response above
2. Complete the test payment (use Polar's test card)
3. Check your backend logs for webhook events

**Expected logs:**

```
[Polar Webhook] Received event { type: 'checkout.created', id: 'evt_xxxxx' }
[Polar Webhook] Checkout created { checkout_id: 'checkout_xxxxx', customer_email: 'test@example.com' }

[Polar Webhook] Received event { type: 'order.created', id: 'evt_yyyyy' }
[Polar Webhook] Order created - Payment confirmed { order_id: 'order_xxxxx', customer_email: 'test@example.com', amount: 1500, currency: 'usd' }
```

### Test 3: Simulate Webhook Event (Without Payment)

You can also test by sending a mock webhook event directly:

```bash
curl -X POST http://localhost:3000/api/polar/webhook \
  -H "Content-Type: application/json" \
  -H "Polar-Signature: dummy_signature_for_dev" \
  -d '{
    "type": "order.created",
    "id": "evt_test_123",
    "data": {
      "id": "order_test_123",
      "customer_email": "test@example.com",
      "amount": 1500,
      "currency": "usd"
    }
  }'
```

**Note:** If `POLAR_WEBHOOK_SECRET` is not set, signature validation is skipped (development mode).

---

## Webhook Events Reference

### checkout.created

Fired when a new checkout session is created.

**Payload example:**

```json
{
  "type": "checkout.created",
  "id": "evt_xxxxx",
  "data": {
    "id": "checkout_xxxxx",
    "customer_email": "user@example.com",
    "status": "open",
    "product_price_id": "price_xxxxx"
  }
}
```

**Handler:** `handleCheckoutCreated()` in `/src/routes/polarWebhook.js`

**Action:** Create pending order in database (optional)

---

### order.created ⭐

Fired when payment is confirmed. **This is the most important event.**

**Payload example:**

```json
{
  "type": "order.created",
  "id": "evt_yyyyy",
  "data": {
    "id": "order_xxxxx",
    "customer_email": "user@example.com",
    "amount": 1500,
    "currency": "usd",
    "product_price_id": "price_xxxxx"
  }
}
```

**Handler:** `handleOrderCreated()` in `/src/routes/polarWebhook.js`

**Action:**

1. Update user's subscription in database
2. Activate premium features
3. Send confirmation email

---

### subscription.created

Fired when a new subscription is created.

**Payload example:**

```json
{
  "type": "subscription.created",
  "id": "evt_zzzzz",
  "data": {
    "id": "sub_xxxxx",
    "customer_email": "user@example.com",
    "status": "active",
    "product_price_id": "price_xxxxx"
  }
}
```

**Handler:** `handleSubscriptionCreated()` in `/src/routes/polarWebhook.js`

**Action:** Update subscription record in database

---

### subscription.canceled

Fired when a subscription is canceled.

**Payload example:**

```json
{
  "type": "subscription.canceled",
  "id": "evt_aaaaa",
  "data": {
    "id": "sub_xxxxx",
    "customer_email": "user@example.com",
    "status": "canceled"
  }
}
```

**Handler:** `handleSubscriptionCanceled()` in `/src/routes/polarWebhook.js`

**Action:**

1. Update subscription status to 'canceled'
2. Schedule access revocation
3. Send cancellation email

---

## Implementing Business Logic

The webhook handlers are currently empty with `// TODO` comments. Here's how to implement them:

### Example: Activate Subscription on Payment

Edit `/src/routes/polarWebhook.js`:

```javascript
async function handleOrderCreated(event) {
  logger.info('[Polar Webhook] Order created - Payment confirmed', {
    order_id: event.data.id,
    customer_email: event.data.customer_email,
    amount: event.data.amount,
    currency: event.data.currency
  });

  // Get user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', event.data.customer_email)
    .single();

  if (error || !user) {
    logger.error('[Polar Webhook] User not found', { email: event.data.customer_email });
    return;
  }

  // Determine plan from price_id (you'll need to map your price IDs)
  const planMapping = {
    price_starter_xxxxx: 'starter',
    price_pro_xxxxx: 'pro',
    price_plus_xxxxx: 'plus'
  };

  const plan = planMapping[event.data.product_price_id] || 'free';

  // Update user subscription
  const { error: updateError } = await supabase.from('subscriptions').upsert({
    user_id: user.id,
    plan: plan,
    status: 'active',
    polar_order_id: event.data.id,
    amount: event.data.amount,
    currency: event.data.currency,
    updated_at: new Date().toISOString()
  });

  if (updateError) {
    logger.error('[Polar Webhook] Failed to update subscription', { error: updateError });
    return;
  }

  // Send confirmation email (optional)
  // await sendSubscriptionConfirmationEmail(user.email, plan);

  logger.info('[Polar Webhook] Subscription activated', { user_id: user.id, plan });
}
```

---

## Troubleshooting

### Webhook not receiving events

**Check:**

1. ✅ ngrok is running and forwarding to port 3000
2. ✅ Webhook URL in Polar dashboard is correct
3. ✅ Server is running and accessible at `http://localhost:3000/health`
4. ✅ Firewall is not blocking incoming connections

**Test manually:**

```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/polar/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{}}'
```

### Signature validation fails

**Check:**

1. ✅ `POLAR_WEBHOOK_SECRET` is set correctly in `.env`
2. ✅ Secret matches the one in Polar dashboard
3. ✅ Server was restarted after adding the secret

**Temporary fix for development:**
Comment out the secret in `.env` to skip validation:

```bash
# POLAR_WEBHOOK_SECRET=whsec_xxxxx
```

### Events not logging

**Check:**

1. ✅ Event type is spelled correctly
2. ✅ Handler function is defined for the event type
3. ✅ Logs are being written (check console output)

**Enable verbose logging:**

```javascript
// In polarWebhook.js, add at the top of the POST handler:
console.log('[DEBUG] Raw webhook body:', rawBody);
console.log('[DEBUG] Parsed event:', event);
```

---

## Production Deployment

When deploying to production:

1. **Use your real domain** instead of ngrok:

   ```
   https://api.yourdomain.com/api/polar/webhook
   ```

2. **Always set POLAR_WEBHOOK_SECRET** for security

3. **Monitor webhook deliveries** in Polar dashboard

4. **Set up alerting** for failed webhook events

5. **Implement retry logic** for transient failures

6. **Log all events** for debugging and auditing

---

## Next Steps

1. ✅ Test webhook locally with ngrok
2. ✅ Verify events are received and logged
3. ✅ Implement business logic in handler functions
4. ✅ Add database integration (Supabase)
5. ✅ Send confirmation emails
6. ✅ Deploy to production
7. ✅ Update webhook URL in Polar dashboard
8. ✅ Monitor and test in production

---

## Support

- **Polar Documentation**: https://docs.polar.sh/
- **Webhook Reference**: https://docs.polar.sh/webhooks
- **ngrok Documentation**: https://ngrok.com/docs
- **Roastr Support**: support@roastr.ai
