/**
 * CheckoutSuccess Page
 *
 * Displays a success message after completing a Polar checkout.
 * This page is redirected to from Polar after successful payment.
 *
 * URL format: /success?checkout_id={CHECKOUT_ID}
 *
 * Features:
 * - Displays success message
 * - Shows checkout details (optional)
 * - Provides navigation back to dashboard
 * - Logs checkout ID for debugging
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [checkoutDetails, setCheckoutDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkoutId = searchParams.get('checkout_id');

  useEffect(() => {
    console.log('[Checkout Success] Page loaded', { checkoutId });

    if (!checkoutId) {
      console.warn('[Checkout Success] No checkout_id in URL');
      setLoading(false);
      return;
    }

    // Optionally fetch checkout details from backend
    fetchCheckoutDetails(checkoutId);
  }, [checkoutId]);

  /**
   * Fetch checkout details from backend
   * This is optional - you can skip this if you don't need the details
   */
  const fetchCheckoutDetails = async (id) => {
    try {
      console.log('[Checkout Success] Fetching checkout details...');

      const response = await fetch(`/api/checkout/${id}`);
      const data = await response.json();

      console.log('[Checkout Success] Checkout details:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch checkout details');
      }

      setCheckoutDetails(data.checkout);
    } catch (err) {
      console.error('[Checkout Success] Error fetching details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate back to dashboard
   */
  const handleBackToDashboard = () => {
    console.log('[Checkout Success] Navigating to dashboard');
    navigate('/dashboard');
  };

  /**
   * Navigate to billing page to view subscription
   */
  const handleViewBilling = () => {
    console.log('[Checkout Success] Navigating to billing');
    navigate('/billing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl p-12 shadow-2xl text-center">
        {/* Success Icon */}
        <div className="mx-auto mb-6 animate-bounce">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="40" cy="40" r="40" fill="#10B981" />
            <path
              d="M25 40L35 50L55 30"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
          Payment Successful! 🎉
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          Thank you for your purchase. Your subscription has been activated.
        </p>

        {/* Checkout ID */}
        {checkoutId && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-gray-500 mb-2">Checkout ID:</p>
            <code className="inline-block bg-white border border-gray-300 rounded-md px-4 py-2 font-mono text-sm text-gray-700 break-all">
              {checkoutId}
            </code>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-8 text-gray-500">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <p>Loading checkout details...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 text-left">
            <p className="text-red-600 font-medium mb-2">
              ⚠️ Could not load checkout details: {error}
            </p>
            <p className="text-gray-500 text-sm">
              Don't worry! Your payment was successful. You can view your subscription in the billing section.
            </p>
          </div>
        )}

        {/* Checkout Details (Optional) */}
        {checkoutDetails && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Details</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-500">Status:</span>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold capitalize">
                  {checkoutDetails.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-500">Email:</span>
                <span className="text-gray-800">{checkoutDetails.customer_email}</span>
              </div>
              {checkoutDetails.amount && (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-500">Amount:</span>
                  <span className="text-gray-800">
                    {(checkoutDetails.amount / 100).toFixed(2)} {checkoutDetails.currency?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8 flex-wrap justify-center">
          <button
            onClick={handleBackToDashboard}
            className="
              flex-1 min-w-[140px] px-6 py-3 text-base font-semibold text-white
              bg-gradient-to-br from-indigo-500 to-purple-600
              border-0 rounded-lg cursor-pointer transition-all duration-200
              shadow-md hover:shadow-lg hover:-translate-y-0.5
            "
            type="button"
          >
            Go to Dashboard
          </button>
          <button
            onClick={handleViewBilling}
            className="
              flex-1 min-w-[140px] px-6 py-3 text-base font-semibold text-gray-700
              bg-gray-100 border border-gray-300 rounded-lg cursor-pointer
              transition-all duration-200 hover:bg-gray-200
            "
            type="button"
          >
            View Billing
          </button>
        </div>

        {/* Additional Information */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-gray-500 text-sm mb-2">
            📧 A confirmation email has been sent to your inbox.
          </p>
          <p className="text-gray-500 text-sm">
            💼 Your premium features are now active and ready to use.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccess;
