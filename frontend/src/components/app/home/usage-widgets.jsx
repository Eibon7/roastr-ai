/**
 * Usage Widgets Component - Issue #1044
 *
 * Widgets de consumo mensual (análisis y roasts) con barras de progreso
 * Endpoint: /api/usage/current
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Skeleton } from '../../ui/skeleton';
import { AlertTriangle, Search, MessageCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api';

export default function UsageWidgets() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get('/usage/current');
        const data = response.data || response;

        setUsage({
          analysis: {
            used: data.analysis?.used || data.analysis_used || 0,
            limit: data.analysis?.limit || data.analysis_limit || 100
          },
          roasts: {
            used: data.roasts?.used || data.roast_used || 0,
            limit: data.roasts?.limit || data.roast_limit || 50
          }
        });
      } catch (err) {
        console.error('Error fetching usage:', err);
        setError(err.message || 'Error al cargar datos de uso');
        // Fallback data
        setUsage({
          analysis: { used: 0, limit: 100 },
          roasts: { used: 0, limit: 50 }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <CardTitle className="text-lg">Análisis este mes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-500">Error: {error}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <CardTitle className="text-lg">Roasts este mes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-500">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysisPercentage =
    usage.analysis.limit > 0
      ? Math.min(100, Math.round((usage.analysis.used / usage.analysis.limit) * 100))
      : 0;

  const roastsPercentage =
    usage.roasts.limit > 0
      ? Math.min(100, Math.round((usage.roasts.used / usage.roasts.limit) * 100))
      : 0;

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Widget 1: Análisis este mes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Análisis este mes</CardTitle>
            </div>
            <span className="text-2xl font-bold">{analysisPercentage}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {usage.analysis.used.toLocaleString()} /{' '}
                {usage.analysis.limit === -1 ? '∞' : usage.analysis.limit.toLocaleString()}
              </span>
              <span className="font-medium">{analysisPercentage}%</span>
            </div>
            <Progress
              value={analysisPercentage}
              className="h-2"
              indicatorClassName={getProgressColor(analysisPercentage)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Widget 2: Roasts este mes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Roasts este mes</CardTitle>
            </div>
            <span className="text-2xl font-bold">{roastsPercentage}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {usage.roasts.used.toLocaleString()} /{' '}
                {usage.roasts.limit === -1 ? '∞' : usage.roasts.limit.toLocaleString()}
              </span>
              <span className="font-medium">{roastsPercentage}%</span>
            </div>
            <Progress
              value={roastsPercentage}
              className="h-2"
              indicatorClassName={getProgressColor(roastsPercentage)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
