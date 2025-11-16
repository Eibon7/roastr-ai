import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CreditCard, Download, ExternalLink, Check, Zap, AlertTriangle, Activity, BarChart3, TrendingUp } from 'lucide-react';
import { createMockFetch } from '../lib/mockMode';
import { getDefaultEntitlements, getDefaultUsage } from '../config/planDefaults';
import { formatCurrency } from '../utils/formatUtils';

export default function Billing() {
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const fetchApi = createMockFetch();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, usageRes, entitlementsRes] = await Promise.all([
          fetchApi('/api/user'),
          fetchApi('/api/user/usage'),
          fetchApi('/api/user/entitlements')
        ]);
        
        if (userRes.ok) setUser(await userRes.json());
        if (usageRes.ok) setUsage(await usageRes.json());
        if (entitlementsRes.ok) setEntitlements(await entitlementsRes.json());
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [fetchApi]);

  const handleBillingPortal = async () => {
    try {
      const response = await fetchApi('/api/billing/portal', {
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

  // Helper function to create progress bar component
  const ProgressBar = ({ current, limit, label, icon: Icon, warning = false }) => {
    const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    const isWarning = percentage >= 80;
    const isAtLimit = percentage >= 100;
    
    return (
      <Card className={`${isWarning ? 'border-yellow-200 bg-yellow-50' : ''} ${isAtLimit ? 'border-red-200 bg-red-50' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            {Icon && <Icon className="h-4 w-4" />}
            <span>{label}</span>
            {isWarning && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">
                {current?.toLocaleString() || '0'}
              </span>
              <span className="text-sm text-muted-foreground">
                of {limit?.toLocaleString() || 'unlimited'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isAtLimit ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className={`${isAtLimit ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
                {percentage.toFixed(1)}% used
              </span>
              {isAtLimit && (
                <span className="text-red-600 font-medium">Limit reached!</span>
              )}
              {isWarning && !isAtLimit && (
                <span className="text-yellow-600 font-medium">Approaching limit</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground">Loading your billing information...</p>
        </div>
      </div>
    );
  }

  // Use configurable defaults if data is not available
  const mockEntitlements = entitlements || getDefaultEntitlements(user?.plan);
  const mockUsage = usage || getDefaultUsage(user?.id);

  const formattedCost = formatCurrency(mockUsage?.costCents || 0, mockUsage?.currency || 'USD');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground text-lg">
            Monitor your monthly usage and manage your subscription
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate('/pricing')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Plans
          </Button>
          <Button onClick={handleBillingPortal}>
            <CreditCard className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      </div>

      {/* Current Plan Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Plan</span>
            <Badge className="bg-blue-100 text-blue-800 capitalize">
              {mockEntitlements.plan_name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-3xl font-bold capitalize">{mockEntitlements.plan_name}</div>
              <div className="text-muted-foreground mt-1">
                {mockEntitlements.plan_name === 'starter_trial' ? 'Free Trial' : 
                 mockEntitlements.plan_name === 'starter' ? `${formatCurrency(500, 'USD')}/month` :
                 mockEntitlements.plan_name === 'pro' ? `${formatCurrency(1500, 'USD')}/month` : `${formatCurrency(5000, 'USD')}/month`}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">AI Model</div>
              <div className="font-semibold">{mockEntitlements.model}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Shield: {mockEntitlements.shield_enabled ? '✓ Enabled' : '✗ Disabled'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">RQC Mode</div>
              <div className="font-semibold capitalize">{mockEntitlements.rqc_mode}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Response Quality Control
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Progress Bars */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Monthly Usage
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <ProgressBar
            current={mockUsage.analysis_used}
            limit={mockEntitlements.analysis_limit_monthly}
            label="Analyses Used"
            icon={TrendingUp}
          />
          <ProgressBar
            current={mockUsage.roast_used}
            limit={mockEntitlements.roast_limit_monthly}
            label="Roasts Generated"
            icon={Zap}
          />
        </div>
      </div>

      {/* Usage Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formattedCost}</div>
            <div className="text-xs text-muted-foreground">This month</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()}
            </div>
            <div className="text-xs text-muted-foreground">Until next billing cycle</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockUsage.analysis_used > 0 ? Math.round((mockUsage.roast_used / mockUsage.analysis_used) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Analyses to roasts ratio</div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Change Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Change Plan
            <Button variant="outline" size="sm" onClick={() => navigate('/pricing')}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View All Plans
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Need more or fewer resources? You can upgrade or downgrade your plan at any time.
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleBillingPortal}>
              Manage via Stripe Portal
            </Button>
            <Button variant="outline" onClick={() => navigate('/pricing')}>
              Compare Plans
            </Button>
          </div>
        </CardContent>
      </Card>

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
            {mockEntitlements.plan_name !== 'starter_trial' ? (
              <>
                {[
                  { date: 'Dec 15, 2024', amount: formatCurrency(mockEntitlements.plan_name === 'starter' ? 500 : mockEntitlements.plan_name === 'pro' ? 1500 : 5000, 'USD'), status: 'Paid', invoice: 'INV-001' },
                  { date: 'Nov 15, 2024', amount: formatCurrency(mockEntitlements.plan_name === 'starter' ? 500 : mockEntitlements.plan_name === 'pro' ? 1500 : 5000, 'USD'), status: 'Paid', invoice: 'INV-002' },
                  { date: 'Oct 15, 2024', amount: formatCurrency(mockEntitlements.plan_name === 'starter' ? 500 : mockEntitlements.plan_name === 'pro' ? 1500 : 5000, 'USD'), status: 'Paid', invoice: 'INV-003' },
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
    </div>
  );
}