import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import MockModeIndicator from '../ui/MockModeIndicator';
import { Crown, Zap, Shield } from 'lucide-react';

export default function PlanStatusCard() {
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
        console.error('Failed to fetch plan data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const planConfig = {
    free: { 
      name: 'Free', 
      icon: Zap, 
      color: 'outline',
      features: ['Basic roasts', 'CSV export'] 
    },
    pro: { 
      name: 'Pro', 
      icon: Shield, 
      color: 'secondary',
      features: ['Advanced moderation', 'Priority support'] 
    },
    creator_plus: { 
      name: 'Creator+', 
      icon: Crown, 
      color: 'default',
      features: ['RQC system', 'Custom styles', 'Analytics'] 
    }
  };

  const currentPlan = planConfig[user?.plan] || planConfig.free;
  const IconComponent = currentPlan.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Plan Status
            <MockModeIndicator size="xs" />
          </div>
          <Badge variant={currentPlan.color}>
            {currentPlan.name}
          </Badge>
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