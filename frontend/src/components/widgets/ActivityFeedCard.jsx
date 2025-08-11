import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Clock, Info, AlertTriangle, AlertCircle } from 'lucide-react';

export default function ActivityFeedCard() {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/logs?limit=10');
        if (res.ok) {
          setLogs(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getLevelIcon = (level) => {
    switch (level) {
      case 'info':
        return <Info className="h-3 w-3 text-blue-500" />;
      case 'warn':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Info className="h-3 w-3 text-gray-500" />;
    }
  };

  const getLevelVariant = (level) => {
    switch (level) {
      case 'info':
        return 'outline';
      case 'warn':
        return 'warning';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-3">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start space-x-3 pb-2 border-b border-border/50 last:border-0 last:pb-0">
                <div className="mt-1">
                  {getLevelIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground mb-1 line-clamp-2">
                    {log.message}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Badge variant={getLevelVariant(log.level)} className="text-xs px-1.5 py-0.5">
                      {log.level}
                    </Badge>
                    <span>{log.service}</span>
                    <span>•</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {logs.length > 8 && (
              <div className="text-center pt-2">
                <button className="text-xs text-primary hover:underline">
                  View {logs.length - 8} more activities
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No recent activity</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}