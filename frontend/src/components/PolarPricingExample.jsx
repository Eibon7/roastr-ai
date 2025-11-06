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
      '10 roasts per month',
      '1,000 analyses',
      '1 platform integration',
      'Shield protection',
      'Email support',
    ],
    priceId: POLAR_PRICE_IDS.starter,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€12',
    period: '/month',
    description: 'Best for growing creators',
    features: [
      '1,000 roasts per month',
      '2 platform integrations',
      'Shield protection',
      'Priority support',
      'Advanced analytics',
    ],
    priceId: POLAR_PRICE_IDS.pro,
    popular: true,
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '€24',
    period: '/month',
    description: 'For professional teams',
    features: [
      '5,000 roasts per month',
      '2 platform integrations',
      'Shield protection',
      'Custom tones',
      'API access',
      '24/7 support',
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

  // PII protection: Do not log user email in production (CodeRabbit C3)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Polar Pricing] Debug: User authenticated:', !!userEmail);
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto">
          Select the perfect plan for your needs. Start protecting your community today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`
              relative bg-white rounded-2xl p-8 flex flex-col
              transition-all duration-300 ease-in-out
              border-2
              ${plan.popular
                ? 'border-indigo-500 shadow-xl shadow-indigo-200'
                : 'border-gray-200 hover:-translate-y-1 hover:shadow-2xl'
              }
            `}
          >
            {plan.popular && (
              <div className="absolute -top-3 right-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                Most Popular
              </div>
            )}

            <div className="text-center mb-8 pb-8 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {plan.name}
              </h2>
              <div className="mb-3">
                <span className="text-4xl md:text-5xl font-extrabold text-gray-800">
                  {plan.price}
                </span>
                <span className="text-base text-gray-500">{plan.period}</span>
              </div>
              <p className="text-base text-gray-500">{plan.description}</p>
            </div>

            <div className="flex-1 mb-8">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0"
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

            <div className="mt-auto">
              <CheckoutButton
                priceId={plan.priceId}
                planName={plan.name}
                customerEmail={userEmail}
                buttonText={`Get ${plan.name}`}
                className="w-full"
                disabled={!userEmail}
              />

              {!userEmail && (
                <p className="text-center mt-3 text-sm text-gray-500">
                  Please{' '}
                  <a
                    href="/login"
                    className="text-indigo-500 font-semibold no-underline hover:underline"
                  >
                    log in
                  </a>{' '}
                  to subscribe
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PolarPricingExample;
