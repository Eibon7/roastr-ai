import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, healthRes] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/health')
        ]);

        if (userRes.ok) {
          setUser(await userRes.json());
        }
        
        if (healthRes.ok) {
          setHealth(await healthRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch topbar data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <header className="bg-white border-b border-border h-16 px-6 flex items-center justify-between">
      {/* Left side - Logo */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
            R
          </div>
          <span className="text-xl font-bold text-foreground">Roastr</span>
        </div>
      </div>

      {/* Right side - Plan & RQC Status */}
      <div className="flex items-center space-x-4">
        {loading ? (
          <div className="flex items-center space-x-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ) : (
          <>
            {/* Plan Badge */}
            <Badge 
              variant={user?.plan === 'creator_plus' ? 'default' : user?.plan === 'pro' ? 'secondary' : 'outline'}
            >
              {user?.plan?.replace('_', ' ').toUpperCase() || 'FREE'}
            </Badge>

            {/* RQC Status */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">RQC:</span>
              <Badge variant={health?.flags?.rqc ? 'success' : 'outline'}>
                {health?.flags?.rqc ? 'ON' : 'OFF'}
              </Badge>
            </div>

            {/* Mock Mode Indicator */}
            {health?.flags?.mockMode && (
              <Badge variant="warning" className="animate-pulse">
                MOCK MODE
              </Badge>
            )}
          </>
        )}
      </div>
    </header>
  );
}