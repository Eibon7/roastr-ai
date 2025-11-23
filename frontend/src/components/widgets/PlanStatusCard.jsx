import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import MockModeIndicator from '../ui/MockModeIndicator';
import { Crown, Zap, Shield } from 'lucide-react';
import { normalizePlanId, getPlanDisplayName } from '../../utils/planHelpers';
import { getCurrentPlan } from '../../api/plans';
import { getCurrentUsage } from '../../api/usage';
import { SkeletonLoader } from '../states/SkeletonLoader';
import { ErrorMessage } from '../states/ErrorMessage';

export default function PlanStatusCard() {
  const [planData, setPlanData] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setError(null);
        const [planResult, usageResult] = await Promise.all([getCurrentPlan(), getCurrentUsage()]);

        if (active) {
          setPlanData(planResult);
          setUsage(usageResult);
        }
      } catch (fetchError) {
        console.error('Failed to fetch plan data:', fetchError);
        if (active) setError('No pudimos obtener el estado del plan.');
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
          <CardTitle>Plan Status</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonLoader rows={3} height={16} />
        </CardContent>
      </Card>
    );
  }

  if (error && !planData) {
    return (
      <ErrorMessage
        title="Estado del plan"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const planConfig = {
    starter_trial: {
      name: 'Starter Trial',
      icon: Zap,
      color: 'outline',
      features: ['5 roasts/mes', '1 cuenta por plataforma', 'Shield']
    },
    starter: {
      name: 'Starter',
      icon: Zap,
      color: 'outline',
      features: ['5 roasts/mes', '1 cuenta por plataforma', 'Shield']
    },
    pro: {
      name: 'Pro',
      icon: Shield,
      color: 'secondary',
      features: ['1000 roasts/mes', '2 cuentas por plataforma', 'Custom tones']
    },
    plus: {
      name: 'Plus',
      icon: Crown,
      color: 'default',
      features: ['5000 roasts/mes', '2 cuentas por plataforma', 'Todas las features']
    }
  };

  const normalizedPlan = normalizePlanId(planData?.plan_id || planData?.plan || 'starter_trial');
  const currentPlan = planConfig[normalizedPlan] || planConfig.starter_trial;
  const IconComponent = currentPlan.icon;

  const accountName = planData?.user?.name || planData?.userName || 'Roastr User';
  const accountEmail = planData?.user?.email || planData?.userEmail;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Plan Status
            <MockModeIndicator size="xs" />
          </div>
          <Badge variant={currentPlan.color}>{currentPlan.name}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-medium">{user?.name || 'Roastr User'}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usage this month</span>
            <span className="font-medium">
              {usage?.aiCalls || 0} / {usage?.limits?.aiCallsLimit || 1000} calls
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

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Features included:</div>
            <div className="space-y-1">
              {currentPlan.features.map((feature, i) => (
                <div key={i} className="flex items-center text-xs">
                  <div className="w-1 h-1 bg-primary rounded-full mr-2" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
