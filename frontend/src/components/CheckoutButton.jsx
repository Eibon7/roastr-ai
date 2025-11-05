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
  disabled = false,
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
      customerEmail,
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
          'Content-Type': 'application/json',
          // If you have auth tokens, add them here:
          // 'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          customer_email: customerEmail,
          price_id: priceId,
          metadata: {
            plan: planName,
            timestamp: new Date().toISOString(),
          },
        }),
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
    <div className="checkout-button-container">
      <button
        onClick={handleCheckout}
        disabled={loading || disabled}
        className={`checkout-button ${className} ${loading ? 'loading' : ''} ${disabled ? 'disabled' : ''}`}
        type="button"
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Creating checkout...
          </>
        ) : (
          buttonText || `Subscribe to ${planName}`
        )}
      </button>

      {error && (
        <div className="checkout-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      <style jsx>{`
        .checkout-button-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checkout-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .checkout-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .checkout-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .checkout-button.loading,
        .checkout-button.disabled,
        .checkout-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .checkout-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background-color: #fee;
          border: 1px solid #fcc;
          border-radius: 0.375rem;
          color: #c33;
          font-size: 0.875rem;
        }

        .error-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .error-message {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

export default CheckoutButton;
