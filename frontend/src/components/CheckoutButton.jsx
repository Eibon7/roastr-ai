/**
 * CheckoutButton Component
 *
 * Renders a button that creates a Polar checkout session and redirects
 * the user to complete payment.
 *
 * Props:
 * - priceId: Polar price ID for the product/plan
 * - planName: Display name of the plan (e.g., "Starter", "Pro", "Plus")
 * - customerEmail: Email address of the customer
 * - buttonText: Custom button text (optional, defaults to "Subscribe to {planName}")
 * - className: Additional CSS classes for styling
 * - disabled: Disable button (optional)
 */

import React, { useState } from 'react';

function CheckoutButton({
  priceId,
  planName = 'Plan',
  customerEmail,
  buttonText,
  className = '',
  disabled = false
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle checkout button click
   * Creates a checkout session via backend and redirects to Polar
   */
  const handleCheckout = async () => {
    console.log('[Polar Checkout] Button clicked', {
      priceId,
      planName,
      customerEmail
    });

    // Validation
    if (!priceId) {
      setError('Price ID is required');
      console.error('[Polar Checkout] Missing priceId');
      return;
    }

    if (!customerEmail) {
      setError('Customer email is required');
      console.error('[Polar Checkout] Missing customerEmail');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[Polar Checkout] Creating checkout session...');

      // Call backend to create checkout session
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // If you have auth tokens, add them here:
          // 'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          customer_email: customerEmail,
          price_id: priceId,
          metadata: {
            plan: planName,
            timestamp: new Date().toISOString()
          }
        })
      });

      console.log('[Polar Checkout] Response status:', response.status);

      const data = await response.json();
      console.log('[Polar Checkout] Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`);
      }

      // Validate response has checkout URL
      if (!data.checkout || !data.checkout.url) {
        throw new Error('No checkout URL returned from server');
      }

      console.log('[Polar Checkout] Redirecting to checkout:', data.checkout.url);

      // Redirect user to Polar checkout page
      window.location.href = data.checkout.url;
    } catch (err) {
      console.error('[Polar Checkout] Error:', err);
      setError(err.message || 'Failed to create checkout session');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleCheckout}
        disabled={loading || disabled}
        className={`
          inline-flex items-center justify-center gap-2
          px-6 py-3 text-base font-semibold text-white
          bg-gradient-to-br from-indigo-500 to-purple-600
          border-0 rounded-lg cursor-pointer
          transition-all duration-200 ease-in-out
          shadow-md
          hover:shadow-lg hover:-translate-y-0.5
          active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
          ${className}
        `}
        type="button"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Creating checkout...
          </>
        ) : (
          buttonText || `Subscribe to ${planName}`
        )}
      </button>

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm"
          role="alert"
        >
          <span className="text-xl flex-shrink-0">⚠️</span>
          <span className="flex-1">{error}</span>
        </div>
      )}
    </div>
  );
}

export default CheckoutButton;
