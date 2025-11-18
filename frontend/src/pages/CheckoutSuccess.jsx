/**
 * CheckoutSuccess Page
 *
 * Displays a success message after completing a Polar checkout.
 * This page is redirected to from Polar after successful payment.
 *
 * URL format: /success?checkout_id={CHECKOUT_ID}
 *
 * Features:
 * - Displays success message with shadcn/ui components
 * - Shows checkout details (optional)
 * - Provides navigation back to dashboard
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { CheckCircle, Mail, Zap, AlertCircle } from 'lucide-react';

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [checkoutDetails, setCheckoutDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkoutId = searchParams.get('checkout_id');

  useEffect(() => {
    if (!checkoutId) {
      setLoading(false);
      return;
    }

    fetchCheckoutDetails(checkoutId);
  }, [checkoutId]);

  /**
   * Fetch checkout details from backend
   */
  const fetchCheckoutDetails = async (id) => {
    try {
      const response = await fetch(`/api/checkout/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch checkout details');
      }

      setCheckoutDetails(data.checkout);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleViewBilling = () => {
    navigate('/billing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8">
      <div className="max-w-2xl w-full">
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 animate-bounce">
              <CheckCircle className="h-20 w-20 text-green-500" />
            </div>
            <CardTitle className="text-3xl md:text-4xl mb-2">
              Payment Successful! 🎉
            </CardTitle>
            <p className="text-lg text-muted-foreground">
              Thank you for your purchase. Your subscription has been activated.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Checkout ID */}
            {checkoutId && (
              <Alert>
                <AlertDescription>
                  <p className="text-sm font-medium mb-2">Checkout ID:</p>
                  <code className="inline-block bg-gray-100 border border-gray-200 rounded-md px-4 py-2 font-mono text-sm break-all w-full">
                    {checkoutId}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center gap-4 py-8 text-muted-foreground">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                <p>Loading checkout details...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">
                    Could not load checkout details: {error}
                  </p>
                  <p className="text-sm">
                    Don't worry! Your payment was successful. You can view your subscription in the billing section.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Checkout Details (Optional) */}
            {checkoutDetails && !loading && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Status:</span>
                    <Badge variant="success" className="capitalize">
                      {checkoutDetails.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Email:</span>
                    <span>{checkoutDetails.customer_email}</span>
                  </div>
                  {checkoutDetails.amount && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-muted-foreground">Amount:</span>
                      <span className="font-semibold">
                        {(checkoutDetails.amount / 100).toFixed(2)} {checkoutDetails.currency?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap justify-center pt-4">
              <Button
                onClick={handleBackToDashboard}
                className="flex-1 min-w-[140px] bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                size="lg"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={handleViewBilling}
                variant="outline"
                className="flex-1 min-w-[140px]"
                size="lg"
              >
                View Billing
              </Button>
            </div>

            {/* Additional Information */}
            <div className="border-t pt-6 space-y-3">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <p>A confirmation email has been sent to your inbox.</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                <p>Your premium features are now active and ready to use.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CheckoutSuccess;
