/**
 * CreditsCard.jsx - Dual Credit System Display
 * 
 * Shows analysis and roast credits with usage bars, 
 * period information, and upgrade CTAs.
 * 
 * Features:
 * - Real-time credit status
 * - Dual progress bars (analysis + roast)
 * - Period countdown
 * - Upgrade prompts when low
 * - Graceful fallback to legacy system
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import MockModeIndicator from '../ui/MockModeIndicator';
import { 
  Brain, 
  Zap, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  Crown,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';

export default function CreditsCard() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCredits();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/user/credits/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCredits(data.data);
        setError(null);
      } else {
        throw new Error('Failed to fetch credits');
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/billing');
  };

  const formatTimeRemaining = (periodEnd) => {
    if (!periodEnd) return 'Unknown';
    
    const end = new Date(periodEnd);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      return `${hours}h`;
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const shouldShowUpgrade = (creditType) => {
    if (!credits?.[creditType]) return false;
    const percentage = (credits[creditType].used / credits[creditType].limit) * 100;
    return percentage >= 80;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credits Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Credits Status
            <MockModeIndicator size="xs" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Unable to load credits status
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchCredits}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const analysisPercentage = credits?.analysis ? 
    (credits.analysis.used / credits.analysis.limit) * 100 : 0;
  const roastPercentage = credits?.roast ? 
    (credits.roast.used / credits.roast.limit) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Credits Status
            <MockModeIndicator size="xs" />
          </div>
          <div className="flex items-center gap-2">
            {!credits?.creditsV2Enabled && (
              <Badge variant="outline" className="text-xs">
                Legacy
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {formatTimeRemaining(credits?.period_end)}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Analysis Credits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Analysis Credits</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${getUsageColor(analysisPercentage)}`}>
                {credits?.analysis?.used?.toLocaleString() || 0} / {credits?.analysis?.limit?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {credits?.analysis?.remaining?.toLocaleString() || 0} remaining
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <Progress 
              value={analysisPercentage} 
              className="h-2"
              indicatorClassName={getProgressColor(analysisPercentage)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used for: Gatekeeper, Toxicity, Shield</span>
              <span>{Math.round(analysisPercentage)}%</span>
            </div>
          </div>

          {shouldShowUpgrade('analysis') && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-yellow-700 flex-1">
                Running low on analysis credits
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleUpgrade}
                className="text-xs h-6"
              >
                Upgrade
              </Button>
            </div>
          )}
        </div>

        {/* Roast Credits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Roast Credits</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${getUsageColor(roastPercentage)}`}>
                {credits?.roast?.used?.toLocaleString() || 0} / {credits?.roast?.limit?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {credits?.roast?.remaining?.toLocaleString() || 0} remaining
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <Progress 
              value={roastPercentage} 
              className="h-2"
              indicatorClassName={getProgressColor(roastPercentage)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used for: Roast Generation & Responses</span>
              <span>{Math.round(roastPercentage)}%</span>
            </div>
          </div>

          {shouldShowUpgrade('roast') && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-yellow-700 flex-1">
                Running low on roast credits
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleUpgrade}
                className="text-xs h-6"
              >
                Upgrade
              </Button>
            </div>
          )}
        </div>

        {/* Overall Status & Actions */}
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Period ends</span>
            <span className="font-medium">
              {credits?.period_end ? 
                new Date(credits.period_end).toLocaleDateString() : 
                'Unknown'
              }
            </span>
          </div>

          {(shouldShowUpgrade('analysis') || shouldShowUpgrade('roast')) && (
            <Button 
              onClick={handleUpgrade}
              className="w-full"
              size="sm"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
