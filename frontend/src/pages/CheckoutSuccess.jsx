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
    <div className="checkout-success-page">
      <div className="success-container">
        {/* Success Icon */}
        <div className="success-icon">
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
        <h1 className="success-title">Payment Successful! 🎉</h1>
        <p className="success-description">
          Thank you for your purchase. Your subscription has been activated.
        </p>

        {/* Checkout ID */}
        {checkoutId && (
          <div className="checkout-id-box">
            <p className="checkout-id-label">Checkout ID:</p>
            <code className="checkout-id-code">{checkoutId}</code>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading checkout details...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-box">
            <p className="error-message">
              ⚠️ Could not load checkout details: {error}
            </p>
            <p className="error-note">
              Don't worry! Your payment was successful. You can view your subscription in the billing section.
            </p>
          </div>
        )}

        {/* Checkout Details (Optional) */}
        {checkoutDetails && !loading && (
          <div className="details-box">
            <h2 className="details-title">Order Details</h2>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value status-badge">
                  {checkoutDetails.status}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{checkoutDetails.customer_email}</span>
              </div>
              {checkoutDetails.amount && (
                <div className="detail-item">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value">
                    {(checkoutDetails.amount / 100).toFixed(2)} {checkoutDetails.currency?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="actions-container">
          <button
            onClick={handleBackToDashboard}
            className="btn btn-primary"
            type="button"
          >
            Go to Dashboard
          </button>
          <button
            onClick={handleViewBilling}
            className="btn btn-secondary"
            type="button"
          >
            View Billing
          </button>
        </div>

        {/* Additional Information */}
        <div className="info-box">
          <p className="info-text">
            📧 A confirmation email has been sent to your inbox.
          </p>
          <p className="info-text">
            💼 Your premium features are now active and ready to use.
          </p>
        </div>
      </div>

      <style jsx>{`
        .checkout-success-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
        }

        .success-container {
          max-width: 600px;
          width: 100%;
          background: white;
          border-radius: 1rem;
          padding: 3rem 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .success-icon {
          margin: 0 auto 1.5rem;
          animation: scaleIn 0.5s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .success-title {
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 0.75rem;
        }

        .success-description {
          font-size: 1.125rem;
          color: #6b7280;
          margin-bottom: 2rem;
        }

        .checkout-id-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 2rem;
        }

        .checkout-id-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .checkout-id-code {
          display: inline-block;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.5rem 1rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          color: #374151;
          word-break: break-all;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          color: #6b7280;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          text-align: left;
        }

        .error-message {
          color: #dc2626;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .error-note {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .details-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          text-align: left;
        }

        .details-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 1rem;
        }

        .details-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          font-weight: 500;
          color: #6b7280;
        }

        .detail-value {
          color: #1f2937;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #d1fae5;
          color: #065f46;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .actions-container {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn {
          flex: 1;
          min-width: 140px;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-secondary {
          color: #374151;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .info-box {
          border-top: 1px solid #e5e7eb;
          padding-top: 1.5rem;
        }

        .info-text {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .info-text:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 640px) {
          .success-container {
            padding: 2rem 1.5rem;
          }

          .success-title {
            font-size: 1.5rem;
          }

          .actions-container {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default CheckoutSuccess;
