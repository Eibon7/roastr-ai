/**
 * PolarPricingExample Component
 *
 * Example implementation of Polar checkout integration in a pricing page.
 * This component shows how to use the CheckoutButton component with different plans.
 *
 * Usage:
 * Import this component and use it in your pricing page, or copy the pattern
 * to integrate Polar checkout buttons into your existing pricing UI.
 */

import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import CheckoutButton from './CheckoutButton';

// Polar Price IDs - Configured for Roastr plans
// These can be overridden with environment variables if needed
const POLAR_PRICE_IDS = {
  starter: process.env.REACT_APP_POLAR_STARTER_PRICE_ID || 'e242580e-41df-4997-aebe-604492249f39',
  pro: process.env.REACT_APP_POLAR_PRO_PRICE_ID || 'c1787586-00b7-4790-ba43-1f1e6a60b095',
  plus: process.env.REACT_APP_POLAR_PLUS_PRICE_ID || '176df9af-337f-4607-9524-48978eae8bea',
};

// Plan configurations
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '€5',
    period: '/month',
    description: 'Perfect for individuals getting started',
    features: [
      'Up to 100 roasts/month',
      'Basic toxicity detection',
      '1 social media account',
      'Email support',
    ],
    priceId: POLAR_PRICE_IDS.starter,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€15',
    period: '/month',
    description: 'Best for growing creators',
    features: [
      'Up to 1,000 roasts/month',
      'Advanced AI models',
      '3 social media accounts',
      'Style profiles',
      'Priority support',
    ],
    priceId: POLAR_PRICE_IDS.pro,
    popular: true,
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '€50',
    period: '/month',
    description: 'For professional teams',
    features: [
      'Unlimited roasts',
      'Premium AI models',
      'Unlimited accounts',
      'Custom personas',
      'API access',
      '24/7 priority support',
    ],
    priceId: POLAR_PRICE_IDS.plus,
    popular: false,
  },
];

function PolarPricingExample() {
  // Get user from AuthContext (adjust based on your auth implementation)
  const { user } = useContext(AuthContext);

  // Get user email (fallback to empty string if not authenticated)
  const userEmail = user?.email || '';

  console.log('[Polar Pricing] User email:', userEmail);

  return (
    <div className="polar-pricing-container">
      <div className="pricing-header">
        <h1 className="pricing-title">Choose Your Plan</h1>
        <p className="pricing-subtitle">
          Select the perfect plan for your needs. All plans include a 14-day free trial.
        </p>
      </div>

      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`pricing-card ${plan.popular ? 'popular' : ''}`}
          >
            {plan.popular && <div className="popular-badge">Most Popular</div>}

            <div className="plan-header">
              <h2 className="plan-name">{plan.name}</h2>
              <div className="plan-price">
                <span className="price-amount">{plan.price}</span>
                <span className="price-period">{plan.period}</span>
              </div>
              <p className="plan-description">{plan.description}</p>
            </div>

            <div className="plan-features">
              <ul className="features-list">
                {plan.features.map((feature, index) => (
                  <li key={index} className="feature-item">
                    <svg
                      className="check-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="plan-action">
              <CheckoutButton
                priceId={plan.priceId}
                planName={plan.name}
                customerEmail={userEmail}
                buttonText={`Get ${plan.name}`}
                className="pricing-cta"
                disabled={!userEmail}
              />

              {!userEmail && (
                <p className="login-notice">
                  Please <a href="/login">log in</a> to subscribe
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .polar-pricing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 4rem;
        }

        .pricing-title {
          font-size: 3rem;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 1rem;
        }

        .pricing-subtitle {
          font-size: 1.25rem;
          color: #6b7280;
          max-width: 600px;
          margin: 0 auto;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          align-items: stretch;
        }

        .pricing-card {
          position: relative;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 1rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .pricing-card.popular {
          border-color: #667eea;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.2);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .plan-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .plan-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 1rem;
        }

        .plan-price {
          margin-bottom: 0.75rem;
        }

        .price-amount {
          font-size: 3rem;
          font-weight: 800;
          color: #1f2937;
        }

        .price-period {
          font-size: 1rem;
          color: #6b7280;
        }

        .plan-description {
          font-size: 1rem;
          color: #6b7280;
        }

        .plan-features {
          flex: 1;
          margin-bottom: 2rem;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          color: #374151;
        }

        .check-icon {
          width: 1.25rem;
          height: 1.25rem;
          color: #10b981;
          flex-shrink: 0;
        }

        .plan-action {
          margin-top: auto;
        }

        .pricing-cta {
          width: 100%;
        }

        .login-notice {
          text-align: center;
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .login-notice a {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
        }

        .login-notice a:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .pricing-title {
            font-size: 2rem;
          }

          .pricing-subtitle {
            font-size: 1rem;
          }

          .pricing-grid {
            grid-template-columns: 1fr;
          }

          .price-amount {
            font-size: 2.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default PolarPricingExample;
