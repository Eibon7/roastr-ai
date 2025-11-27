import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  CreditCard,
  Loader2,
  Check,
  Zap,
  Target,
  Crown,
  Shield,
  AlertCircle,
  RefreshCw,
  X,
  Calendar,
  Trash2
} from 'lucide-react';
import { getBillingInfo, cancelSubscription } from '../../lib/api/billing';
import { useAuth } from '../../contexts/AuthContext';
import { normalizePlanId, getPlanDisplayName, getPlanBadgeColor } from '../../utils/planHelpers';
import { getAllPlanConfigs } from '../../utils/planConfig';
import { formatDate } from '../../utils/shopFormatters';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/**
 * BillingPanel - Panel component for billing settings
 * 
 * Displays:
 * - Current payment method (last 4 digits)
 * - Plan information: name, next billing date
 * - If plan cancelled: "Roastr.AI estará activo hasta [fecha]"
 * - Upgrade plan button → navigation to /app/plans
 * - Cancel subscription button → confirmation and API call
 * 
 * Issue #1056: Implementar tab de Billing (/app/settings/billing)
 */
const BillingPanel = () => {
  const { userData: user } = useAuth();
  const navigate = useNavigate();
  const [billingInfo, setBillingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadBillingInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBillingInfo = async (isRetry = false) => {
    try {
      setLoading(true);
      setError(false);
      const response = await getBillingInfo();
      setBillingInfo(response.data);
      if (isRetry) {
        setRetryCount(0);
        toast.success('Billing information loaded successfully');
      }
    } catch (error) {
      console.warn('Could not load billing info:', error);
      setError(true);
      setBillingInfo(null);
      
      // Enhanced error handling with retry logic
      if (retryCount < 3) {
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        toast.error(`Failed to load billing information. Retrying... (${newRetryCount}/3)`, {
          duration: 3000
        });
        // Auto-retry with exponential backoff
        setTimeout(() => {
          loadBillingInfo(true);
        }, Math.min(1000 * Math.pow(2, newRetryCount), 5000));
      } else {
        toast.error('Failed to load billing information. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const response = await cancelSubscription(false); // Cancel at period end
      
      if (response.data) {
        toast.success(
          response.data.message || 'Subscription will be canceled at the end of the billing period'
        );
        setShowCancelDialog(false);
        // Reload billing info to reflect cancellation
        await loadBillingInfo();
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const getPlanIcon = (plan) => {
    const normalized = normalizePlanId(plan);
    switch (normalized) {
      case 'starter_trial':
        return <Zap className="w-4 h-4" />;
      case 'starter':
        return <Zap className="w-4 h-4" />;
      case 'pro':
        return <Target className="w-4 h-4" />;
      case 'plus':
        return <Crown className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your subscription and usage overview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error || !billingInfo ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Unable to load billing information. Please try again later.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setRetryCount(0);
                  loadBillingInfo(true);
                }} 
                className="mt-4"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Retrying...' : 'Retry'}
              </Button>
              {retryCount > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Retry attempt {retryCount}/3
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Plan Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getPlanIcon(user?.plan || 'starter_trial')}
                  <div>
                    <h3 className="font-semibold capitalize">
                      {getPlanDisplayName(user?.plan || 'starter_trial')} Plan
                    </h3>
                    <p className="text-sm text-gray-600">
                      {(() => {
                        const plan = normalizePlanId(user?.plan || 'starter_trial');
                        return plan === 'starter_trial'
                          ? 'Free Trial'
                          : plan === 'starter'
                            ? '€5/month'
                            : plan === 'pro'
                              ? '€15/month'
                              : plan === 'plus'
                                ? '€50/month'
                                : 'Custom';
                      })()}
                    </p>
                  </div>
                </div>
                <Badge className={getPlanBadgeColor(user?.plan || 'starter_trial')}>
                  {billingInfo?.subscriptionStatus === 'canceled' || billingInfo?.cancelAtPeriodEnd
                    ? 'Cancelling'
                    : 'Active'}
                </Badge>
              </div>

              {/* Cancelled Plan Message */}
              {(billingInfo?.subscriptionStatus === 'canceled' || billingInfo?.cancelAtPeriodEnd) && billingInfo?.activeUntil && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        Roastr.AI estará activo hasta {formatDate(billingInfo.activeUntil)}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Tu suscripción se cancelará al final del período de facturación actual.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {billingInfo?.paymentMethod && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                      <div>
                        <h4 className="font-medium text-sm text-gray-600">Payment Method</h4>
                        <p className="text-sm font-semibold">
                          •••• •••• •••• {billingInfo.paymentMethod.last4}
                        </p>
                        {billingInfo.paymentMethod.brand && (
                          <p className="text-xs text-gray-500 capitalize">
                            {billingInfo.paymentMethod.brand}
                            {billingInfo.paymentMethod.expMonth && billingInfo.paymentMethod.expYear && (
                              <> • Expires {billingInfo.paymentMethod.expMonth}/{billingInfo.paymentMethod.expYear}</>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Billing Date */}
              {billingInfo?.nextBillingDate && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-sm text-gray-600">Next Billing Date</h4>
                      <p className="text-sm font-semibold">
                        {formatDate(billingInfo.nextBillingDate)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-600">Roasts Generated</h4>
                  <p className="text-2xl font-bold">
                    {billingInfo?.usage?.roastsUsed ?? 0}
                    <span className="text-sm text-gray-500 font-normal">
                      /
                      {billingInfo?.limits?.roastsPerMonth ??
                        (() => {
                          const plan = normalizePlanId(user?.plan || 'starter_trial');
                          return plan === 'starter_trial' || plan === 'starter'
                            ? '5'
                            : plan === 'pro'
                              ? '1000'
                              : plan === 'plus'
                                ? '5000'
                                : '∞';
                        })()}
                    </span>
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          billingInfo?.usage?.roastsUsed && billingInfo?.limits?.roastsPerMonth
                            ? Math.min(
                                (billingInfo.usage.roastsUsed /
                                  billingInfo.limits.roastsPerMonth) *
                                  100,
                                100
                              )
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-600">API Calls</h4>
                  <p className="text-2xl font-bold">
                    {billingInfo?.usage?.apiCalls ?? 0}
                    <span className="text-sm text-gray-500 font-normal">
                      /
                      {billingInfo?.limits?.apiCallsPerMonth ??
                        (() => {
                          const plan = normalizePlanId(user?.plan || 'starter_trial');
                          return plan === 'starter_trial' || plan === 'starter'
                            ? '10'
                            : plan === 'pro'
                              ? '1000'
                              : plan === 'plus'
                                ? '5000'
                                : '∞';
                        })()}
                    </span>
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-gray-600">This Month</h4>
                  <p className="text-2xl font-bold">
                    €
                    {(() => {
                      const plan = normalizePlanId(user?.plan || 'starter_trial');
                      return plan === 'starter_trial'
                        ? '0.00'
                        : plan === 'starter'
                          ? '5.00'
                          : plan === 'pro'
                            ? '15.00'
                            : plan === 'plus'
                              ? '50.00'
                              : '0.00';
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/app/billing')}
                >
                  View Full Billing
                </Button>
                {normalizePlanId(user?.plan || 'starter_trial') === 'starter_trial' && (
                  <Button className="flex-1" onClick={() => navigate('/app/pricing')}>
                    Upgrade Plan
                  </Button>
                )}
                {normalizePlanId(user?.plan || 'starter_trial') !== 'starter_trial' &&
                  billingInfo?.subscriptionStatus !== 'canceled' &&
                  !billingInfo?.cancelAtPeriodEnd && (
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {getAllPlanConfigs().map((plan) => {
              const currentPlanId = normalizePlanId(user?.plan || 'starter_trial');
              const isCurrentPlan = currentPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`p-4 border rounded-lg ${
                    isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <h3 className="font-semibold">{plan.displayName}</h3>
                  <p className="text-2xl font-bold text-blue-600">{plan.price}</p>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isCurrentPlan ? (
                    <Badge className="mt-2 w-full justify-center">Current</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => navigate('/app/pricing')}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Subscription Dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onCancel={() => setShowCancelDialog(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription"
        message={
          <>
            Are you sure you want to cancel your subscription? Your subscription will remain active until{' '}
            {billingInfo?.nextBillingDate ? formatDate(billingInfo.nextBillingDate) : 'the end of the billing period'}
            , and you'll continue to have access to all features until then.
            <br />
            <br />
            <strong>This action cannot be undone.</strong> You can resubscribe at any time.
          </>
        }
        confirmText={cancelling ? 'Cancelling...' : 'Cancel Subscription'}
        cancelText="Keep Subscription"
        variant="danger"
      />
    </div>
  );
};

BillingPanel.displayName = 'BillingPanel';

export default BillingPanel;

