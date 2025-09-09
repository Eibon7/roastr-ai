import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { MessageCircle, Zap, AlertTriangle } from 'lucide-react';
import { PLAN_DEFAULTS } from '../../config/planDefaults';

export default function RoastUsageCard({ user, className = '' }) {
  const [usage, setUsage] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch current usage
        const usageRes = await fetch('/api/user/usage', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!usageRes.ok) {
          throw new Error('Failed to fetch usage data');
        }

        const usageData = await usageRes.json();
        
        // Fetch user plan to get limits
        const planRes = await fetch('/api/plan/current', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        let limits = PLAN_DEFAULTS.free; // fallback
        if (planRes.ok) {
          const planData = await planRes.json();
          const userPlan = planData.data?.plan || user?.plan || 'free';
          limits = PLAN_DEFAULTS[userPlan] || PLAN_DEFAULTS.free;
        } else {
          // Use user plan from props as fallback
          const userPlan = user?.plan || 'free';
          limits = PLAN_DEFAULTS[userPlan] || PLAN_DEFAULTS.free;
        }

        setUsage(usageData.data || { roast_used: 0 });
        setPlanLimits(limits);

      } catch (err) {
        console.error('Error fetching roast usage:', err);
        setError(err.message);
        // Set fallback data
        setUsage({ roast_used: 0 });
        setPlanLimits(PLAN_DEFAULTS.free);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [user]);

  const roastUsed = usage?.roast_used || 0;
  const roastLimit = planLimits?.roast_limit_monthly || 50;
  const usagePercentage = roastLimit > 0 ? Math.min(100, (roastUsed / roastLimit) * 100) : 0;
  
  // Determine status color based on usage
  const getStatusColor = () => {
    if (usagePercentage >= 90) return 'text-red-600';
    if (usagePercentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 75) return 'bg-yellow-500';
    return 'bg-purple-500';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Roast usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Roast usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Error loading usage data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-purple-600" />
            <span>Roast usage</span>
          </div>
          {usagePercentage >= 90 && (
            <Badge variant="destructive" className="text-xs">
              Limit reached
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Usage Numbers */}
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-bold ${getStatusColor()}`}>
              {roastUsed.toLocaleString()}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg font-medium text-muted-foreground">
              {roastLimit === -1 ? '∞' : roastLimit.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground ml-1">roasts</span>
          </div>

          {/* Progress Bar */}
          {roastLimit !== -1 && (
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usagePercentage.toFixed(1)}% used</span>
                <span>{(roastLimit - roastUsed).toLocaleString()} remaining</span>
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="flex items-center space-x-2 text-xs">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Roasts generated this month
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
