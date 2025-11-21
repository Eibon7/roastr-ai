import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { DollarSign, Zap, Brain, Shield } from 'lucide-react';
import { formatCurrency } from '../../utils/formatUtils';
import { getCurrentUsage } from '../../api/usage';
import { SkeletonLoader } from '../states/SkeletonLoader';
import { ErrorMessage } from '../states/ErrorMessage';

export default function UsageCostCard() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setError(null);
        const data = await getCurrentUsage();
        if (active) {
          setUsage(data);
        }
      } catch (fetchError) {
        console.error('Failed to fetch usage data:', fetchError);
        if (active) {
          setError('No pudimos cargar el consumo. Intenta recargar.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage & Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonLoader rows={3} height={20} />
        </CardContent>
      </Card>
    );
  }

  if (error && !usage) {
    return (
      <ErrorMessage
        title="Error de consumo"
        message={error}
        onRetry={() => {
          setLoading(true);
          getCurrentUsage()
            .then(data => setUsage(data))
            .catch(err => {
              console.error('Retry failed:', err);
            })
            .finally(() => setLoading(false));
        }}
      />
    );
  }

  const formattedCost = formatCurrency(usage?.costCents || 0, usage?.currency || 'USD');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Usage & Costs</span>
          </div>
          <Badge variant="outline">
            This month
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Total Cost</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formattedCost}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">API Calls</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {usage?.aiCalls?.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="pt-3 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Breakdown
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Roast Generation</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {usage?.breakdown?.roastGeneration?.toLocaleString() || '0'}
                  </div>
                  <div className="text-xs text-muted-foreground">calls</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Toxicity Analysis</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {usage?.breakdown?.toxicityAnalysis?.toLocaleString() || '0'}
                  </div>
                  <div className="text-xs text-muted-foreground">calls</div>
                </div>
              </div>

              {usage?.breakdown?.rqcReviews > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded" />
                    <span className="text-sm">RQC Reviews</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {usage.breakdown.rqcReviews.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">reviews</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-400 rounded" />
                  <span className="text-sm">Platform Sync</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {usage?.breakdown?.platformSync?.toLocaleString() || '0'}
                  </div>
                  <div className="text-xs text-muted-foreground">syncs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Limits */}
          <div className="pt-3 border-t">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Monthly limit</span>
              <span className="font-medium">
                {usage?.aiCalls?.toLocaleString() || '0'} / {usage?.limits?.aiCallsLimit?.toLocaleString() || '1,000'}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(100, ((usage?.aiCalls || 0) / (usage?.limits?.aiCallsLimit || 1000)) * 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}