import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Clock, Play, Pause, CheckCircle } from 'lucide-react';

export default function JobsQueueCard() {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Mock queue data since we don't have a real endpoint yet
        const mockData = {
          active: Math.floor(Math.random() * 5),
          waiting: Math.floor(Math.random() * 20) + 2,
          completed: Math.floor(Math.random() * 100) + 50,
          failed: Math.floor(Math.random() * 3),
          types: {
            roast_generation: Math.floor(Math.random() * 10) + 5,
            toxicity_analysis: Math.floor(Math.random() * 8) + 3,
            platform_sync: Math.floor(Math.random() * 5) + 1
          }
        };

        setTimeout(() => {
          setQueueData(mockData);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Failed to fetch queue data:', error);
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Jobs Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalJobs = queueData
    ? queueData.active + queueData.waiting + queueData.completed + queueData.failed
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Jobs Queue</span>
          </div>
          <div className="flex items-center space-x-1">
            {queueData?.active > 0 && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
            <Badge variant="outline" className="text-xs">
              {totalJobs} total
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Queue Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <Play className="h-3 w-3 text-green-500" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{queueData?.active || 0}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <Pause className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Waiting</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{queueData?.waiting || 0}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <div className="text-lg font-semibold text-blue-600">{queueData?.completed || 0}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Failed</span>
              </div>
              <div className="text-lg font-semibold text-red-600">{queueData?.failed || 0}</div>
            </div>
          </div>

          {/* Job Types */}
          {queueData?.types && (
            <div className="pt-3 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                By Type
              </div>
              <div className="space-y-1">
                {Object.entries(queueData.types).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {type.replace('_', ' ')}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
