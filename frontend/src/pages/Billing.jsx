import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CreditCard, Download, ExternalLink, Check, Zap } from 'lucide-react';

export default function Billing() {
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, usageRes] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/usage')
        ]);
        
        if (userRes.ok) setUser(await userRes.json());
        if (usageRes.ok) setUsage(await usageRes.json());
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleBillingPortal = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'month',
      features: [
        '100 AI calls/month',
        '1 platform integration',
        'Basic toxicity detection',
        'Community support'
      ],
      current: user?.plan === 'free'
    },
    {
      name: 'Pro',
      price: '$19',
      period: 'month',
      features: [
        '2,000 AI calls/month',
        '3 platform integrations',
        'Advanced toxicity detection',
        'Shield protection',
        'Priority support',
        'Analytics dashboard'
      ],
      current: user?.plan === 'pro',
      popular: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: 'month',
      features: [
        'Unlimited AI calls',
        'All platform integrations',
        'Custom roast models',
        'Advanced Shield rules',
        'Dedicated support',
        'Custom integrations',
        'White-label options'
      ],
      current: user?.plan === 'enterprise'
    }
  ];

  const costInDollars = usage?.costCents ? (usage.costCents / 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and view usage statistics
          </p>
        </div>
        <Button onClick={handleBillingPortal}>
          <CreditCard className="h-4 w-4 mr-2" />
          Manage Billing
        </Button>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold capitalize">{user?.plan || 'free'}</div>
              <div className="text-muted-foreground">
                {user?.plan === 'free' ? 'Free forever' : `$${user?.plan === 'pro' ? '19' : '99'}/month`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Next billing date</div>
              <div className="font-medium">
                {user?.plan === 'free' ? 'No billing' : 'January 15, 2025'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${costInDollars}</div>
            <div className="text-xs text-muted-foreground">This month</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.aiCalls?.toLocaleString() || '0'}</div>
            <div className="text-xs text-muted-foreground">
              of {usage?.limits?.aiCallsLimit?.toLocaleString() || '1,000'} limit
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage?.aiCalls && usage?.limits?.aiCallsLimit 
                ? Math.round((usage.aiCalls / usage.limits.aiCallsLimit) * 100) 
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Of monthly limit</div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={`relative ${plan.current ? 'border-primary' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}
              {plan.current && (
                <div className="absolute -top-2 right-4">
                  <Badge variant="success">Current Plan</Badge>
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {plan.current && <Check className="h-5 w-5 text-green-500" />}
                </CardTitle>
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.current ? "outline" : "default"}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : plan.name === 'Free' ? 'Downgrade' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Billing History</CardTitle>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {user?.plan !== 'free' ? (
              <>
                {[
                  { date: 'Dec 15, 2024', amount: '$19.00', status: 'Paid', invoice: 'INV-001' },
                  { date: 'Nov 15, 2024', amount: '$19.00', status: 'Paid', invoice: 'INV-002' },
                  { date: 'Oct 15, 2024', amount: '$19.00', status: 'Paid', invoice: 'INV-003' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">{item.invoice}</div>
                      <div className="text-sm text-muted-foreground">{item.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{item.amount}</div>
                      <Badge variant="success" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div className="text-sm">No billing history</div>
                <div className="text-xs">Upgrade to a paid plan to see invoices</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          {user?.plan !== 'free' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-medium">•••• •••• •••• 4242</div>
                    <div className="text-sm text-muted-foreground">Expires 12/28</div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Badge variant="outline">Default</Badge>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              </div>
              <Button variant="outline" size="sm">
                + Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-sm">No payment methods required</div>
              <div className="text-xs">You're on the free plan</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}