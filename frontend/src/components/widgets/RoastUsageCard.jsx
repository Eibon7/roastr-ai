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
      <div className={`usage-card-roast flex items-center justify-between p-4 w-full lg:w-96 h-24 flex-shrink-0 ${className}`}>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-12 w-16" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`usage-card-error flex items-center justify-between p-4 w-full lg:w-96 h-24 flex-shrink-0 ${className}`}>
        <div>
          <div className="flex items-center space-x-2 text-red-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-base font-bold">Roast usage</span>
          </div>
          <span className="text-sm text-red-500">Error loading data</span>
        </div>
        <span className="text-5xl font-bold text-red-500">--</span>
      </div>
    );
  }

  // Determine border color based on usage
  const getBorderColor = () => {
    if (usagePercentage >= 90) return 'border-l-red-400';
    if (usagePercentage >= 75) return 'border-l-yellow-400';
    return 'border-l-purple-400'; // Default purple for roasts
  };

  const percentageUsed = roastLimit > 0 ? Math.round((roastUsed / roastLimit) * 100) : 0;

  return (
    <div className={`usage-card-roast flex items-center justify-between p-4 w-full lg:w-96 h-24 flex-shrink-0 ${className}`}>
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Roast usage</h3>
        <p className="text-sm text-gray-500">
          {roastUsed.toLocaleString()}/{roastLimit === -1 ? '∞' : roastLimit.toLocaleString()} roasts
        </p>
      </div>
      <div className="text-5xl font-bold text-gray-900">
        {percentageUsed}%
      </div>
    </div>
  );
}
