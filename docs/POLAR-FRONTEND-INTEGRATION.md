# Polar Frontend Integration Guide

Complete guide for integrating Polar checkout in the Roastr frontend (React/Create React App).

## 🎯 Overview

This integration provides:
- **CheckoutButton** component for creating Polar checkout sessions
- **CheckoutSuccess** page for handling post-payment redirects
- Ready-to-use pricing page example
- Full TypeScript-like prop validation
- Comprehensive error handling and logging

---

## 📁 Files Created

```
frontend/src/
├── components/
│   ├── CheckoutButton.jsx              ← Reusable checkout button
│   └── PolarPricingExample.jsx         ← Complete pricing page example
└── pages/
    └── CheckoutSuccess.jsx             ← Post-payment success page
```

---

## 🚀 Quick Start

### 1. Get Your Polar Price IDs

1. Go to https://polar.sh/dashboard/products
2. Create your products/plans (Starter, Pro, Plus)
3. Copy the **price IDs** for each plan (e.g., `price_xxxxxxxxxxxxx`)

### 2. Add Environment Variables

Edit `frontend/.env.development`:

```bash
# Polar Price IDs
REACT_APP_POLAR_STARTER_PRICE_ID=price_your_starter_id_here
REACT_APP_POLAR_PRO_PRICE_ID=price_your_pro_id_here
REACT_APP_POLAR_PLUS_PRICE_ID=price_your_plus_id_here
```

### 3. Use the CheckoutButton Component

```jsx
import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import CheckoutButton from '../components/CheckoutButton';

function MyPricingPage() {
  const { user } = useContext(AuthContext);

  return (
    <div>
      <h1>Choose Your Plan</h1>

      <div className="plan-card">
        <h2>Pro Plan - €15/month</h2>
        <CheckoutButton
          priceId={process.env.REACT_APP_POLAR_PRO_PRICE_ID}
          planName="Pro"
          customerEmail={user?.email}
          buttonText="Subscribe to Pro"
        />
      </div>
    </div>
  );
}
```

### 4. Test the Flow

```bash
# Terminal 1 - Start backend
npm start

# Terminal 2 - Start frontend
cd frontend
npm start
```

Visit http://localhost:3001/pricing and click a checkout button.

---

## 📘 Component Reference

### CheckoutButton

Creates a Polar checkout session and redirects to payment page.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `priceId` | string | ✅ Yes | Polar price ID (e.g., `price_xxxxx`) |
| `planName` | string | ✅ Yes | Display name (e.g., "Pro", "Starter") |
| `customerEmail` | string | ✅ Yes | User's email address |
| `buttonText` | string | No | Custom button text (default: `Subscribe to {planName}`) |
| `className` | string | No | Additional CSS classes |
| `disabled` | boolean | No | Disable button (default: `false`) |

**Example:**

```jsx
<CheckoutButton
  priceId="price_1234567890"
  planName="Pro"
  customerEmail="user@example.com"
  buttonText="Get Pro Plan"
  className="my-custom-class"
/>
```

**Features:**
- ✅ Loading state with spinner
- ✅ Error handling with user-friendly messages
- ✅ Console logging for debugging
- ✅ Automatic redirect to Polar checkout
- ✅ Inline styles (no CSS imports needed)

---

### CheckoutSuccess

Post-payment success page that handles Polar redirects.

**URL:** `/success?checkout_id={CHECKOUT_ID}`

**Features:**
- ✅ Success animation
- ✅ Checkout ID display
- ✅ Optional: Fetches checkout details from backend
- ✅ Navigation buttons (Dashboard, Billing)
- ✅ Fully styled (no CSS imports needed)

**Example:**

The page automatically displays when Polar redirects after payment. No additional code needed.

---

## 🎨 Complete Pricing Page Example

Use the `PolarPricingExample` component as a starting point:

```jsx
import React from 'react';
import PolarPricingExample from '../components/PolarPricingExample';

function PricingPage() {
  return <PolarPricingExample />;
}

export default PricingPage;
```

Or copy the pattern from `frontend/src/components/PolarPricingExample.jsx` and customize it to your needs.

---

## 🔄 Flow Diagram

```
User clicks "Subscribe"
         ↓
CheckoutButton creates session
         ↓
POST /api/checkout
  {
    customer_email: "user@example.com",
    price_id: "price_xxxxx"
  }
         ↓
Backend returns checkout URL
         ↓
Redirect to Polar payment page
         ↓
User completes payment
         ↓
Polar redirects to:
/success?checkout_id=checkout_xxxxx
         ↓
CheckoutSuccess page displays
         ↓
User clicks "Go to Dashboard"
```

---

## 🧪 Testing Locally

### Test 1: Simulate Checkout Flow

1. Start backend and frontend:
   ```bash
   npm start                    # Backend
   cd frontend && npm start     # Frontend
   ```

2. Visit: http://localhost:3001

3. Import and use CheckoutButton:
   ```jsx
   <CheckoutButton
     priceId="price_test_123"
     planName="Pro"
     customerEmail="test@example.com"
   />
   ```

4. Click button and check console logs:
   ```
   [Polar Checkout] Button clicked
   [Polar Checkout] Creating checkout session...
   [Polar Checkout] Response status: 200
   [Polar Checkout] Redirecting to checkout: https://polar.sh/checkout/...
   ```

### Test 2: Test Success Page

1. Navigate directly to:
   ```
   http://localhost:3001/success?checkout_id=checkout_test_123
   ```

2. Verify:
   - ✅ Success icon displays
   - ✅ Checkout ID shows
   - ✅ Buttons work (Dashboard, Billing)
   - ✅ Console logs checkout details

### Test 3: Full End-to-End

1. Complete a real checkout with Polar test card
2. Verify redirect to `/success?checkout_id=...`
3. Check backend webhook receives `order.created` event
4. Verify user subscription activated in database

---

## 🎯 Integration Patterns

### Pattern 1: In Existing Pricing Page

If you already have a pricing page (like `pages/Pricing.jsx`):

```jsx
import CheckoutButton from '../components/CheckoutButton';

// Inside your plan card render:
<CheckoutButton
  priceId={plan.polarPriceId}
  planName={plan.name}
  customerEmail={user?.email}
  buttonText={`Get ${plan.name}`}
/>
```

### Pattern 2: Conditional Payment Provider

Support both Stripe and Polar:

```jsx
import CheckoutButton from '../components/CheckoutButton';

function PlanCard({ plan, user }) {
  const useStripe = process.env.REACT_APP_USE_STRIPE === 'true';

  if (useStripe) {
    return <StripeCheckoutButton {...plan} />;
  }

  return (
    <CheckoutButton
      priceId={plan.polarPriceId}
      planName={plan.name}
      customerEmail={user.email}
    />
  );
}
```

### Pattern 3: Modal/Popup Checkout

Wrap CheckoutButton in a modal:

```jsx
import { useState } from 'react';
import CheckoutButton from '../components/CheckoutButton';

function PricingWithModal({ plan, user }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        View Plan Details
      </button>

      {showModal && (
        <div className="modal">
          <h2>{plan.name}</h2>
          <p>{plan.description}</p>
          <CheckoutButton
            priceId={plan.polarPriceId}
            planName={plan.name}
            customerEmail={user.email}
          />
        </div>
      )}
    </>
  );
}
```

---

## 🛠️ Customization

### Custom Button Styling

Override the default gradient with your own styles:

```jsx
<CheckoutButton
  priceId="price_xxxxx"
  planName="Pro"
  customerEmail={user.email}
  className="my-custom-button"
/>
```

```css
/* In your CSS file */
.my-custom-button.checkout-button {
  background: #3b82f6 !important;
  border-radius: 0.25rem !important;
  padding: 1rem 2rem !important;
}

.my-custom-button.checkout-button:hover {
  background: #2563eb !important;
}
```

### Custom Success Page

Modify `pages/CheckoutSuccess.jsx` to match your brand:

```jsx
// Change colors
<style jsx>{`
  .checkout-success-page {
    background: linear-gradient(135deg, #your-color-1, #your-color-2);
  }

  .btn-primary {
    background: #your-brand-color;
  }
`}</style>
```

### Add Analytics Tracking

Track checkout events:

```jsx
// In CheckoutButton.jsx, add to handleCheckout():

const handleCheckout = async () => {
  // Track button click
  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      items: [{ name: planName, price: priceId }]
    });
  }

  // ... rest of checkout logic
};
```

---

## 🐛 Troubleshooting

### Issue: Button does nothing when clicked

**Check:**
1. ✅ Backend is running on port 3000
2. ✅ `customerEmail` prop is not empty
3. ✅ `priceId` is valid
4. ✅ Console for error messages

**Solution:**
```bash
# Check backend
curl http://localhost:3000/health

# Check browser console
# Open DevTools → Console tab
```

### Issue: "Missing required fields" error

**Cause:** `customerEmail` or `priceId` is empty.

**Solution:**
```jsx
// Ensure user is authenticated
const { user } = useContext(AuthContext);

if (!user || !user.email) {
  return <p>Please log in to subscribe</p>;
}

<CheckoutButton
  priceId={process.env.REACT_APP_POLAR_PRO_PRICE_ID}
  planName="Pro"
  customerEmail={user.email}  // ← Must be valid email
/>
```

### Issue: CORS errors

**Cause:** Frontend and backend on different ports without proxy.

**Solution:**

Ensure `frontend/package.json` has:
```json
{
  "proxy": "http://localhost:3000"
}
```

Restart frontend after adding proxy.

### Issue: Success page doesn't show checkout details

**Cause:** Backend endpoint `/api/checkout/:id` not working.

**Solution:**

This is optional. The success page works without fetching details. If you want to fetch them, ensure:

1. Backend route exists (`src/routes/checkout.js`)
2. Checkout ID is valid
3. No authentication required for GET endpoint

---

## 🚀 Production Deployment

### 1. Update Environment Variables

**Backend (.env):**
```bash
POLAR_ACCESS_TOKEN=polar_oat_your_production_token
POLAR_SUCCESS_URL=https://app.yourdomain.com/success?checkout_id={CHECKOUT_ID}
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Frontend (.env.production):**
```bash
REACT_APP_POLAR_STARTER_PRICE_ID=price_production_starter_id
REACT_APP_POLAR_PRO_PRICE_ID=price_production_pro_id
REACT_APP_POLAR_PLUS_PRICE_ID=price_production_plus_id
```

### 2. Update Webhook URL in Polar

1. Go to Polar dashboard
2. Update webhook URL to: `https://api.yourdomain.com/api/polar/webhook`
3. Verify events are being received

### 3. Test in Production

1. Create a test checkout with real price ID
2. Use Polar test card to complete payment
3. Verify redirect to production success URL
4. Check webhook events in backend logs

---

## 📊 Analytics & Monitoring

### Track Checkout Events

```jsx
// In CheckoutButton.jsx

const handleCheckout = async () => {
  // Track checkout started
  analytics.track('Checkout Started', {
    plan: planName,
    priceId: priceId,
    email: customerEmail,
  });

  try {
    // ... checkout logic

    // Track checkout success
    analytics.track('Checkout Succeeded', {
      plan: planName,
      checkoutUrl: data.checkout.url,
    });

  } catch (error) {
    // Track checkout error
    analytics.track('Checkout Failed', {
      plan: planName,
      error: error.message,
    });
  }
};
```

### Monitor Success Rate

```jsx
// In CheckoutSuccess.jsx

useEffect(() => {
  if (checkoutId) {
    analytics.track('Checkout Completed', {
      checkoutId,
      timestamp: new Date().toISOString(),
    });
  }
}, [checkoutId]);
```

---

## 🔗 Related Documentation

- **Backend Integration**: [POLAR-INTEGRATION.md](./POLAR-INTEGRATION.md)
- **Webhook Testing**: [POLAR-WEBHOOK-TESTING.md](./POLAR-WEBHOOK-TESTING.md)
- **Polar Documentation**: https://docs.polar.sh/

---

## ✅ Checklist

Before going live, ensure:

- [ ] Price IDs configured in `.env.production`
- [ ] CheckoutButton tested with all plans
- [ ] Success page displays correctly
- [ ] Webhook receives `order.created` events
- [ ] User subscription activated after payment
- [ ] Error handling works (invalid email, network errors)
- [ ] Analytics tracking implemented
- [ ] Mobile responsive design tested
- [ ] Browser console has no errors
- [ ] Success URL matches production domain

---

## 🆘 Support

For issues:
- **Polar API**: https://docs.polar.sh/
- **Roastr Support**: support@roastr.ai
- **Check logs**: Browser console + Backend logs
