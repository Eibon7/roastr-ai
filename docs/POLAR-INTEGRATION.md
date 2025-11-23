# Polar Integration Guide

This guide explains how to use the Polar checkout integration in Roastr.

## Overview

Polar is integrated as an alternative payment processor alongside Stripe. It provides a simple checkout flow for subscription and one-time payments.

## Backend Setup

### Environment Variables

Add these variables to your `.env` file:

```bash
# Polar Configuration
POLAR_ACCESS_TOKEN=your_access_token_here
POLAR_SUCCESS_URL=http://localhost:3000/success?checkout_id={CHECKOUT_ID}
POLAR_WEBHOOK_SECRET=your_webhook_secret_here  # Optional but highly recommended
POLAR_ALLOWED_PRICE_IDS=price_id_1,price_id_2,price_id_3  # Server-side price validation (security)
```

**Security Note:** `POLAR_ALLOWED_PRICE_IDS` is a comma-separated allowlist of valid price IDs. The backend will reject any checkout requests with price IDs not in this list, preventing price manipulation attacks. This is a server-side security control that prevents users from modifying price IDs in the frontend to access unauthorized plans.

### Available Endpoints

#### 1. Create Checkout Session

**POST** `/api/checkout`

Creates a new checkout session with Polar.

**Request Body:**

```json
{
  "customer_email": "user@example.com",
  "price_id": "price_xxxxxxxxxxxxx",
  "metadata": {
    "user_id": "123",
    "plan": "pro"
  }
}
```

**Response:**

```json
{
  "success": true,
  "checkout": {
    "id": "checkout_xxxxxxxxxxxxx",
    "url": "https://polar.sh/checkout/xxxxxxxxxxxxx",
    "customer_email": "user@example.com",
    "price_id": "price_xxxxxxxxxxxxx",
    "status": "open"
  }
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "user@example.com",
    "price_id": "price_xxxxxxxxxxxxx"
  }'
```

#### 2. Get Checkout Session

**GET** `/api/checkout/:id`

Retrieves a checkout session by ID.

**Response:**

```json
{
  "success": true,
  "checkout": {
    "id": "checkout_xxxxxxxxxxxxx",
    "status": "confirmed",
    "customer_email": "user@example.com",
    "price_id": "price_xxxxxxxxxxxxx",
    "amount": 1500,
    "currency": "usd"
  }
}
```

#### 3. Webhook Endpoint

**POST** `/api/polar/webhook`

Receives webhook events from Polar for payment confirmations and subscription updates.

**Supported Events:**

- `checkout.created` - New checkout session created
- `order.created` - Payment confirmed (most important)
- `subscription.created` - New subscription created
- `subscription.updated` - Subscription updated
- `subscription.canceled` - Subscription canceled

---

## Frontend Integration

### React Example (Create React App)

Here's how to integrate Polar checkout in your React frontend:

#### 1. Create a Checkout Button Component

```jsx
// src/components/PolarCheckoutButton.jsx
import React, { useState } from 'react';

function PolarCheckoutButton({ priceId, customerEmail, planName = 'Pro Plan' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call your backend to create checkout session
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Add auth token if required
          // 'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          customer_email: customerEmail,
          price_id: priceId,
          metadata: {
            plan: planName
            // Add any additional metadata you need
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout');
      }

      // Redirect user to Polar checkout page
      if (data.checkout && data.checkout.url) {
        window.location.href = data.checkout.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating checkout...' : `Subscribe to ${planName}`}
      </button>

      {error && <div className="mt-2 text-red-600 text-sm">Error: {error}</div>}
    </div>
  );
}

export default PolarCheckoutButton;
```

#### 2. Use the Component in Your Pricing Page

```jsx
// src/pages/PricingPage.jsx
import React from 'react';
import PolarCheckoutButton from '../components/PolarCheckoutButton';

function PricingPage() {
  // Get user email from your auth context/state
  const userEmail = 'user@example.com'; // Replace with actual user email

  return (
    <div className="pricing-page">
      <h1>Choose Your Plan</h1>

      <div className="pricing-cards">
        {/* Starter Plan */}
        <div className="pricing-card">
          <h2>Starter</h2>
          <p className="price">€5/month</p>
          <PolarCheckoutButton
            priceId="price_starter_monthly_id"
            customerEmail={userEmail}
            planName="Starter"
          />
        </div>

        {/* Pro Plan */}
        <div className="pricing-card">
          <h2>Pro</h2>
          <p className="price">€15/month</p>
          <PolarCheckoutButton
            priceId="price_pro_monthly_id"
            customerEmail={userEmail}
            planName="Pro"
          />
        </div>

        {/* Plus Plan */}
        <div className="pricing-card">
          <h2>Plus</h2>
          <p className="price">€50/month</p>
          <PolarCheckoutButton
            priceId="price_plus_monthly_id"
            customerEmail={userEmail}
            planName="Plus"
          />
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
```

#### 3. Create Success Page

```jsx
// src/pages/CheckoutSuccess.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [checkoutDetails, setCheckoutDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkoutId = searchParams.get('checkout_id');

  useEffect(() => {
    if (!checkoutId) return;

    // Optionally fetch checkout details from your backend
    fetch(`/api/checkout/${checkoutId}`)
      .then((res) => res.json())
      .then((data) => {
        setCheckoutDetails(data.checkout);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching checkout details:', error);
        setLoading(false);
      });
  }, [checkoutId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="success-page">
      <h1>✅ Payment Successful!</h1>
      <p>Thank you for your purchase.</p>

      {checkoutDetails && (
        <div className="checkout-details">
          <p>Order ID: {checkoutDetails.id}</p>
          <p>Status: {checkoutDetails.status}</p>
        </div>
      )}

      <a href="/dashboard">Go to Dashboard</a>
    </div>
  );
}

export default CheckoutSuccess;
```

#### 4. Add Route in Your Router

```jsx
// src/App.jsx or your router configuration
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CheckoutSuccess from './pages/CheckoutSuccess';
import PricingPage from './pages/PricingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/success" element={<CheckoutSuccess />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Vanilla JavaScript Example

If you're not using React, here's a vanilla JavaScript example:

```html
<!-- pricing.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Pricing - Roastr</title>
  </head>
  <body>
    <div class="pricing-container">
      <div class="plan">
        <h2>Pro Plan - €15/month</h2>
        <button
          id="checkout-btn"
          data-price-id="price_pro_monthly_id"
          data-customer-email="user@example.com"
        >
          Subscribe Now
        </button>
      </div>
    </div>

    <script>
      document.getElementById('checkout-btn').addEventListener('click', async (e) => {
        const button = e.target;
        const priceId = button.dataset.priceId;
        const customerEmail = button.dataset.customerEmail;

        button.disabled = true;
        button.textContent = 'Creating checkout...';

        try {
          const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customer_email: customerEmail,
              price_id: priceId
            })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to create checkout');
          }

          // Redirect to Polar checkout
          window.location.href = data.checkout.url;
        } catch (error) {
          alert('Error: ' + error.message);
          button.disabled = false;
          button.textContent = 'Subscribe Now';
        }
      });
    </script>
  </body>
</html>
```

---

## Testing Locally

1. **Start your backend:**

   ```bash
   npm start
   # or
   npm run dev
   ```

2. **Start your frontend (in another terminal):**

   ```bash
   cd frontend
   npm start
   ```

3. **Test the checkout endpoint with cURL:**

   ```bash
   curl -X POST http://localhost:3000/api/checkout \
     -H "Content-Type: application/json" \
     -d '{
       "customer_email": "test@example.com",
       "price_id": "your_polar_price_id"
     }'
   ```

4. **Expected response:**

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

5. **Visit the checkout URL** in your browser to complete the test payment.

---

## Webhook Testing

### Quick Test with Simulator

The easiest way to test webhooks locally is using the included simulator:

```bash
# Start your backend
npm start

# In another terminal, simulate a payment confirmation
node scripts/simulate-polar-webhook.js order.created

# Or simulate a subscription cancelation
node scripts/simulate-polar-webhook.js subscription.canceled
```

**Available event types:**

- `checkout.created`
- `order.created` (payment confirmed)
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`

See **[POLAR-WEBHOOK-TESTING.md](./POLAR-WEBHOOK-TESTING.md)** for complete webhook testing guide.

---

## Webhook Configuration

### Setup Webhook in Polar Dashboard

1. Go to your Polar dashboard
2. Navigate to **Webhooks** settings
3. Add a new webhook endpoint: `https://yourdomain.com/api/polar/webhook`
4. Select events to subscribe to (recommended: all events)
5. Copy the webhook secret and add it to your `.env`:
   ```
   POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

### Testing Webhooks Locally

For local development, use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok
ngrok http 3000

# Use the ngrok URL in Polar webhook settings
# Example: https://abc123.ngrok.io/api/polar/webhook
```

---

## Security Notes

1. **Always validate webhook signatures** - The webhook endpoint includes signature validation when `POLAR_WEBHOOK_SECRET` is set.

2. **Use HTTPS in production** - Polar requires HTTPS for webhook endpoints in production.

3. **Store sensitive data securely** - Never commit API tokens to version control.

4. **Implement rate limiting** - The checkout endpoint should have rate limiting in production (already configured in `src/index.js`).

---

## Common Issues

### Issue: "Configuration error" when creating checkout

**Solution:** Ensure `POLAR_ACCESS_TOKEN` is set in your `.env` file.

### Issue: Webhook signature validation fails

**Solution:** Verify that `POLAR_WEBHOOK_SECRET` matches the secret in your Polar dashboard.

### Issue: CORS errors in frontend

**Solution:** The backend is already configured with CORS. Ensure your frontend proxy is set correctly in `frontend/package.json`:

```json
"proxy": "http://localhost:3000"
```

---

## Next Steps

1. Replace placeholder `price_id` values with your actual Polar price IDs
2. Implement the webhook handlers in `/src/routes/polarWebhook.js` to:
   - Update user subscriptions in your database
   - Activate premium features
   - Send confirmation emails
3. Add proper error handling and user feedback in the frontend
4. Set up monitoring and alerts for failed payments

---

## Support

For issues with the Polar integration:

- Check server logs for detailed error messages
- Review Polar dashboard for webhook delivery status
- Consult [Polar Documentation](https://docs.polar.sh/)

For Roastr-specific issues, contact: support@roastr.ai
