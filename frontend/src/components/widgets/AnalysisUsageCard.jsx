import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { PLAN_DEFAULTS } from '../../config/planDefaults';

export default function AnalysisUsageCard({ user, className = '' }) {
  const [usage, setUsage] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isSidebarVisible } = useSidebar();

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

        setUsage(usageData.data || { analysis_used: 0 });
        setPlanLimits(limits);

      } catch (err) {
        console.error('Error fetching analysis usage:', err);
        setError(err.message);
        // Set fallback data
        setUsage({ analysis_used: 0 });
        setPlanLimits(PLAN_DEFAULTS.free);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [user]);

  const analysisUsed = usage?.analysis_used || 0;
  const analysisLimit = planLimits?.analysis_limit_monthly || 100;
  const usagePercentage = analysisLimit > 0 ? Math.min(100, (analysisUsed / analysisLimit) * 100) : 0;
  


  if (loading) {
    return (
      <div className={`usage-card-analysis flex items-center justify-between p-4 h-24 flex-shrink-0 ${isSidebarVisible ? 'w-96' : 'w-full'} ${className}`}>
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
      <div className={`usage-card-error flex items-center justify-between p-4 h-24 flex-shrink-0 ${isSidebarVisible ? 'w-96' : 'w-full'} ${className}`}>
        <div>
          <div className="flex items-center space-x-2 text-red-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-base font-bold">Analysis usage</span>
          </div>
          <span className="text-sm text-red-500">Error loading data</span>
        </div>
        <span className="text-5xl font-bold text-red-500">--</span>
      </div>
    );
  }



  const percentageUsed = analysisLimit > 0 ? Math.round((analysisUsed / analysisLimit) * 100) : 0;

  return (
    <div className={`usage-card-analysis flex items-center justify-between p-4 h-24 flex-shrink-0 ${isSidebarVisible ? 'w-96' : 'w-full'} ${className}`}>
      <div>
        <h3 className="text-base font-bold mb-1">Analysis usage</h3>
        <p className="text-sm text-muted-foreground">
          {analysisUsed.toLocaleString()}/{analysisLimit === -1 ? '∞' : analysisLimit.toLocaleString()} comments
        </p>
      </div>
      <div className="text-5xl font-bold">
        {percentageUsed}%
      </div>
    </div>
  );
}
