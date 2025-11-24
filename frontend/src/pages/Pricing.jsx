import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Check, Crown, Zap, Star, Shield, Sparkles } from 'lucide-react';
import { createMockFetch } from '../lib/mockMode';

const PLAN_ICONS = {
  starter_trial: <Sparkles className="h-8 w-8" />, // Trial with sparkles
  starter: <Star className="h-8 w-8" />,
  pro: <Shield className="h-8 w-8" />,
  plus: <Crown className="h-8 w-8" />
};

const PLAN_COLORS = {
  starter_trial: 'text-purple-600', // Purple for trial
  starter: 'text-blue-600',
  pro: 'text-purple-600',
  plus: 'text-yellow-600'
};

export default function Pricing() {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const fetchApi = createMockFetch();

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetchApi('/api/user');
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan || 'starter_trial');
      }
    } catch (error) {
      // Error fetching plan
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    setError(null); // Clear any previous errors

    try {
      if (planId === 'starter_trial') {
        // Handle trial start (card required)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetchApi('/api/billing/start-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          // Trial started successfully, refresh the page
          window.location.reload();
        } else {
          if (response.status === 401) {
            setError('Your session has expired. Please log in again.');
            return;
          } else if (response.status >= 500) {
            setError('Service temporarily unavailable. Please try again later.');
            return;
          }
          throw new Error('Failed to start trial');
        }
      } else {
        // Handle upgrade through checkout with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetchApi('/api/billing/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planId }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          window.location.href = data.url;
        } else {
          // Check for specific error conditions
          if (response.status === 401) {
            setError('Your session has expired. Please log in again.');
            return;
          } else if (response.status >= 500) {
            setError('Service temporarily unavailable. Please try again later.');
            return;
          }
          throw new Error('Failed to create checkout session');
        }
      }
    } catch (error) {
      // Enhanced error handling
      if (error.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.');
      } else if (
        error.message.includes('NetworkError') ||
        error.message.includes('Failed to fetch')
      ) {
        setError('Network error. Please check your internet connection.');
      } else if (error.message.includes('session has expired')) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Failed to process upgrade. Please try again.');
      }
    } finally {
      setUpgrading(null);
    }
  };

  const plans = [
    {
      id: 'starter_trial',
      name: 'Starter Trial',
      price: 0,
      currency: '€',
      period: '30 days',
      description: '30-day trial (card required)',
      trial: true,
      requiresCard: true,
      features: [
        'GPT-4 model',
        'Shield protection',
        '1,000 analyses per month',
        '10 roasts per month',
        'Advanced toxicity detection',
        'Email support',
        '1 platform integration',
        'Trial period - auto converts to Starter'
      ],
      limitations: ['Trial ends after 30 days', 'Card required to start']
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 5,
      currency: '€',
      period: 'month',
      description: 'Great for regular users',
      popular: true,
      features: [
        'GPT-4 model',
        'Shield protection',
        '1,000 analyses per month',
        '10 roasts per month',
        'Advanced toxicity detection',
        'Email support',
        '1 platform integration'
      ],
      limitations: ['No RQC embedded', 'Standard response time']
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 15,
      currency: '€',
      period: 'month',
      description: 'Best for power users',
      popular: true,
      features: [
        'GPT-4 model',
        'Shield protection',
        '10,000 analyses per month',
        '1,000 roasts per month',
        'Priority toxicity analysis',
        'Priority support',
        '5 platform integrations',
        'Custom prompts',
        'Analytics dashboard'
      ],
      limitations: ['No RQC embedded']
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 50,
      currency: '€',
      period: 'month',
      description: 'Enterprise-grade features',
      enterprise: true,
      features: [
        'GPT-4 model',
        'Shield protection',
        '100,000 analyses per month',
        '5,000 roasts per month',
        'RQC embedded mode',
        'Dedicated support',
        'Unlimited platform integrations',
        'Custom prompts & styles',
        'Advanced analytics',
        'API access',
        'White-label options'
      ],
      limitations: []
    }
  ];

  const formatPrice = (price, currency) => {
    return price === 0 ? 'Free' : `${currency}${price}`;
  };

  const getPlanBadge = (plan) => {
    if (plan.id === currentPlan) {
      return (
        <Badge variant="success" className="absolute -top-2 right-4">
          Current Plan
        </Badge>
      );
    }
    if (plan.popular) {
      return (
        <Badge className="absolute -top-2 right-4 bg-purple-100 text-purple-800">
          Most Popular
        </Badge>
      );
    }
    if (plan.enterprise) {
      return (
        <Badge className="absolute -top-2 right-4 bg-yellow-100 text-yellow-800">Enterprise</Badge>
      );
    }
    return null;
  };

  const getButtonText = (plan) => {
    if (upgrading === plan.id) return 'Processing...';
    if (plan.id === currentPlan) return 'Current Plan';
    if (plan.id === 'starter_trial') return 'Start Trial';
    return `Upgrade to ${plan.name}`;
  };

  const getButtonVariant = (plan) => {
    if (plan.id === currentPlan) return 'outline';
    if (plan.popular) return 'default';
    if (plan.enterprise) return 'default';
    return 'outline';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Pricing Plans</h1>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your roasting needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 font-semibold"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const canUpgrade = !isCurrentPlan;

            return (
              <Card
                key={plan.id}
                className={`relative transform transition-all duration-200 hover:scale-105 ${
                  plan.popular ? 'border-purple-200 shadow-xl' : ''
                } ${plan.enterprise ? 'border-yellow-200 shadow-xl' : ''} ${
                  isCurrentPlan ? 'ring-2 ring-green-500' : ''
                }`}
              >
                {getPlanBadge(plan)}

                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto mb-4 ${PLAN_COLORS[plan.id]}`}>
                    {PLAN_ICONS[plan.id]}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold mt-2">
                    {formatPrice(plan.price, plan.currency)}
                    {plan.price > 0 && (
                      <span className="text-lg font-normal text-muted-foreground">
                        /{plan.period}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-green-700">✓ Included Features</h4>
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Limitations */}
                  {plan.limitations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-gray-500">✗ Not Included</h4>
                      {plan.limitations.map((limitation, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-gray-400 flex-shrink-0">✗</span>
                          <span className="text-sm text-gray-500">{limitation}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-4">
                    <Button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isCurrentPlan || upgrading === plan.id}
                      className={`w-full ${
                        plan.popular ? 'bg-purple-600 hover:bg-purple-700' : ''
                      } ${plan.enterprise ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                      variant={getButtonVariant(plan)}
                    >
                      {getButtonText(plan)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Feature Comparison</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-semibold">Feature</th>
                      {plans.map((plan) => (
                        <th key={plan.id} className="text-center p-4 font-semibold">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-4 font-medium">AI Model</td>
                      <td className="p-4 text-center">GPT-4</td>
                      <td className="p-4 text-center">GPT-4</td>
                      <td className="p-4 text-center">GPT-4</td>
                      <td className="p-4 text-center">GPT-4</td>
                    </tr>
                    <tr className="border-t bg-gray-25">
                      <td className="p-4 font-medium">Monthly Analyses</td>
                      <td className="p-4 text-center">1,000</td>
                      <td className="p-4 text-center">1,000</td>
                      <td className="p-4 text-center">10,000</td>
                      <td className="p-4 text-center">100,000</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-4 font-medium">Monthly Roasts</td>
                      <td className="p-4 text-center">10</td>
                      <td className="p-4 text-center">10</td>
                      <td className="p-4 text-center">1,000</td>
                      <td className="p-4 text-center">5,000</td>
                    </tr>
                    <tr className="border-t bg-gray-25">
                      <td className="p-4 font-medium">Shield Protection</td>
                      <td className="p-4 text-center">✓</td>
                      <td className="p-4 text-center">✓</td>
                      <td className="p-4 text-center">✓</td>
                      <td className="p-4 text-center">✓</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-4 font-medium">RQC Embedded</td>
                      <td className="p-4 text-center">✗</td>
                      <td className="p-4 text-center">✗</td>
                      <td className="p-4 text-center">✗</td>
                      <td className="p-4 text-center">✓</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RQC Embedded Highlight */}
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 mb-16">
          <CardContent className="p-8">
            <div className="flex items-start space-x-6">
              <div className="bg-yellow-100 p-4 rounded-lg">
                <Sparkles className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-2xl mb-3">RQC Embedded Mode</h3>
                <p className="text-muted-foreground mb-6 text-lg">
                  Exclusive to Plus plan. Advanced response quality control with embedded semantic
                  analysis for superior roast generation and contextual understanding.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-yellow-600" />
                    <span>Semantic context analysis</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-yellow-600" />
                    <span>Enhanced response quality</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-yellow-600" />
                    <span>Multi-language optimization</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-yellow-600" />
                    <span>Advanced prompt engineering</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
            <div>
              <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect
                immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens to unused credits?</h3>
              <p className="text-sm text-muted-foreground">
                Monthly credits reset at the beginning of each billing cycle and don't roll over.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! Start with the Starter Trial plan to test all features. Upgrade to a paid plan
                when you need more capacity.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How does billing work?</h3>
              <p className="text-sm text-muted-foreground">
                All paid plans are billed monthly. You can manage your billing through our secure
                portal.
              </p>
            </div>
          </div>
          <div className="mt-12">
            <Button onClick={() => navigate('/billing')} size="lg" variant="outline">
              View Current Usage & Billing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
