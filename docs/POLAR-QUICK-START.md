# Polar Integration - Quick Start Guide

**Get Polar payments working in 5 minutes.**

---

## ✅ Prerequisites

- [x] Node.js installed
- [x] Polar account created (https://polar.sh)
- [x] Backend and frontend code from this repo

---

## 🚀 Setup (5 Steps)

### Step 1: Get Polar Access Token

1. Go to https://polar.sh/dashboard/settings/api
2. Create a new **Personal Access Token**
3. Copy the token (starts with `polar_oat_...`)

### Step 2: Get Price IDs

1. Go to https://polar.sh/dashboard/products
2. Create products for your plans (Starter, Pro, Plus)
3. Copy each **Price ID** (starts with `price_...`)

### Step 3: Configure Backend

Edit `.env` in root directory:

```bash
# Add these lines
POLAR_ACCESS_TOKEN=polar_oat_your_token_here
POLAR_SUCCESS_URL=http://localhost:3001/success?checkout_id={CHECKOUT_ID}
POLAR_ALLOWED_PRICE_IDS=price_your_starter_id,price_your_pro_id,price_your_plus_id
```

**Important:** The `POLAR_ALLOWED_PRICE_IDS` list must match the price IDs you configure in the frontend (Step 4). This server-side allowlist prevents unauthorized price_id values from being used.

### Step 4: Configure Frontend

Edit `frontend/.env.development`:

```bash
# Add these lines
REACT_APP_POLAR_STARTER_PRICE_ID=price_your_starter_id
REACT_APP_POLAR_PRO_PRICE_ID=price_your_pro_id
REACT_APP_POLAR_PLUS_PRICE_ID=price_your_plus_id
```

### Step 5: Start Servers

```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```

---

## 🧪 Test It

### Test 1: Checkout Button

Create a test page: `frontend/src/pages/TestPolar.jsx`

```jsx
import React from 'react';
import CheckoutButton from '../components/CheckoutButton';

function TestPolar() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Test Polar Checkout</h1>

      <CheckoutButton
        priceId={process.env.REACT_APP_POLAR_PRO_PRICE_ID}
        planName="Pro"
        customerEmail="test@example.com"
        buttonText="Test Checkout"
      />
    </div>
  );
}

export default TestPolar;
```

Add route in `App.js`:

```jsx
import TestPolar from './pages/TestPolar';

// Inside <Routes>:
<Route path="/test-polar" element={<TestPolar />} />
```

Visit: http://localhost:3001/test-polar

### Test 2: Complete Flow

1. Click "Test Checkout" button
2. Console should show:
   ```
   [Polar Checkout] Button clicked
   [Polar Checkout] Creating checkout session...
   [Polar Checkout] Response status: 200
   [Polar Checkout] Redirecting to checkout: https://polar.sh/checkout/...
   ```
3. You'll be redirected to Polar payment page
4. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
5. Complete payment
6. You'll be redirected to: `http://localhost:3001/success?checkout_id=...`
7. Success page should display with green checkmark

### Test 3: Webhook

```bash
# In a new terminal, simulate payment webhook
node scripts/simulate-polar-webhook.js order.created
```

Check backend logs for:
```
[Polar Webhook] Received event { type: 'order.created', ... }
[Polar Webhook] Order created - Payment confirmed
```

---

## 🎯 Integration Points

Now that it works, integrate into your app:

### Option 1: Add to Existing Pricing Page

Edit `frontend/src/pages/Pricing.jsx`:

```jsx
import CheckoutButton from '../components/CheckoutButton';
import { AuthContext } from '../contexts/AuthContext';

// Inside your component:
const { user } = useContext(AuthContext);

// In your plan card JSX:
<CheckoutButton
  priceId={plan.polarPriceId}
  planName={plan.name}
  customerEmail={user?.email}
  buttonText={`Get ${plan.name}`}
/>
```

### Option 2: Use Complete Example

Replace your pricing page with the example:

```jsx
// In App.js
import PolarPricingExample from './components/PolarPricingExample';

<Route path="/pricing" element={<PolarPricingExample />} />
```

---

## 📋 Verify Everything Works

Run these checks:

```bash
# 1. Backend health
curl http://localhost:3000/health
# Should return: {"status":"ok",...}

# 2. Checkout endpoint
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","price_id":"price_xxxxx"}'
# Should return: {"success":true,"checkout":{...}}

# 3. Webhook endpoint
node scripts/simulate-polar-webhook.js order.created
# Check backend logs for success

# 4. Frontend
# Visit: http://localhost:3001/test-polar
# Click button, should redirect to Polar
```

---

## 🐛 Common Issues

### "Configuration error" when creating checkout

**Fix:**
```bash
# Check .env has POLAR_ACCESS_TOKEN
cat .env | grep POLAR_ACCESS_TOKEN

# Restart backend
npm start
```

### Button does nothing

**Fix:**
```bash
# Check browser console for errors
# Ensure backend is running
curl http://localhost:3000/health

# Check customerEmail is not empty
console.log(user?.email); // In your component
```

### CORS error

**Fix:**
```json
// Ensure frontend/package.json has:
{
  "proxy": "http://localhost:3000"
}
```

Restart frontend after adding proxy.

---

## 📚 Next Steps

1. ✅ **Implement webhook logic**
   - Edit `src/routes/polarWebhook.js`
   - Update user subscription in database
   - Send confirmation email

2. ✅ **Add to production**
   - Get production Polar tokens
   - Update `.env.production`
   - Deploy backend + frontend
   - Update webhook URL in Polar dashboard

3. ✅ **Customize UI**
   - Style CheckoutButton to match your brand
   - Customize success page
   - Add your logo/colors

---

## 🔗 Full Documentation

- [Backend Integration](./POLAR-INTEGRATION.md)
- [Frontend Integration](./POLAR-FRONTEND-INTEGRATION.md)
- [Webhook Testing](./POLAR-WEBHOOK-TESTING.md)
- [Polar Docs](https://docs.polar.sh/)

---

## 🆘 Need Help?

1. Check backend logs: `npm start`
2. Check browser console: DevTools → Console
3. Test webhook: `node scripts/simulate-polar-webhook.js order.created`
4. Read full docs above
5. Contact: support@roastr.ai

---

**That's it! You now have Polar payments fully integrated.** 🎉
