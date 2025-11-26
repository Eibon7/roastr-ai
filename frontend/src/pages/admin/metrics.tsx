import * as React from 'react';
import { Loader2, TrendingUp, TrendingDown, Users, Activity, Zap, DollarSign, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { adminApi } from '@/lib/api';

interface DashboardMetrics {
  roasts: {
    total: number;
    this_month: number;
    last_month: number;
    total_tokens: number;
  };
  users: {
    total: number;
    active: number;
    new_this_month: number;
  };
  organizations: {
    total: number;
    active: number;
  };
  integrations: {
    stats: {
      total: number;
      enabled: number;
      active: number;
    };
  };
  costs: {
    monthly_spend: number;
    budget_usage_percentage: number;
  };
  system: {
    uptime: number;
    status: string;
  };
  workers: {
    total: number;
    healthy: number;
    status: string;
  };
}

export default function MetricsPage() {
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
    loadMetrics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await adminApi.getDashboardMetrics();
      
      if (response.success && response.data) {
        // Transform backend data to frontend format
        const data = response.data;
        const transformedMetrics: DashboardMetrics = {
          roasts: {
            total: data.roasts?.total || 0,
            this_month: data.roasts?.this_month || data.roasts?.monthly || 0,
            last_month: 0, // Backend doesn't provide last_month, calculate if needed
            total_tokens: data.roasts?.total_tokens || 0,
          },
          users: {
            total: data.users?.total || 0,
            active: data.users?.active || 0,
            new_this_month: data.users?.new_this_month || data.users?.new || 0,
          },
          organizations: {
            total: 0, // Not in current response structure
            active: 0,
          },
          integrations: {
            stats: {
              total: data.integrations?.stats?.total || data.integrations?.total || 0,
              enabled: data.integrations?.stats?.enabled || data.integrations?.enabled || 0,
              active: data.integrations?.stats?.active || data.integrations?.active || 0,
            },
          },
          costs: {
            monthly_spend: 0, // Not in current response
            budget_usage_percentage: 0,
          },
          system: {
            uptime: 0, // Not in current response
            status: 'healthy',
          },
          workers: {
            total: 0, // Not in current response
            healthy: 0,
            status: 'healthy',
          },
        };
        setMetrics(transformedMetrics);
        setLastUpdated(new Date());
      }
    } catch (error: any) {
      console.error('Failed to load metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
    };
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se pudieron cargar las métricas</p>
      </div>
    );
  }

  const roastsChange = calculateChange(metrics.roasts.this_month, metrics.roasts.last_month);
  const usersChange = calculateChange(metrics.users.new_this_month, metrics.users.new_this_month - 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Métricas</h1>
          <p className="text-muted-foreground">
            Visualiza métricas agregadas del sistema
            {lastUpdated && (
              <span className="ml-2 text-xs">
                (Actualizado: {lastUpdated.toLocaleTimeString('es-ES')})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Análisis</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.roasts.total.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {roastsChange.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span>
                {roastsChange.value}% vs mes anterior ({metrics.roasts.this_month.toLocaleString()} este mes)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roasts Generados</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.roasts.this_month.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.roasts.total_tokens.toLocaleString()} tokens utilizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.users.active.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>de {metrics.users.total.toLocaleString()} totales</span>
              {usersChange.isPositive && (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span>+{metrics.users.new_this_month} nuevos este mes</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizaciones</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.organizations.active.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              de {metrics.organizations.total.toLocaleString()} totales activas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Cost Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Costes</CardTitle>
            <CardDescription>Uso del presupuesto mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Gasto Mensual</span>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">${metrics.costs.monthly_spend.toFixed(2)}</div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Uso del Presupuesto</span>
                  <span className="text-sm font-medium">{metrics.costs.budget_usage_percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metrics.costs.budget_usage_percentage > 90
                        ? 'bg-red-500'
                        : metrics.costs.budget_usage_percentage > 75
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(metrics.costs.budget_usage_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estado del Sistema</CardTitle>
            <CardDescription>Uptime y salud general</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Estado</span>
                  <Badge variant={metrics.system.status === 'healthy' ? 'default' : 'destructive'}>
                    {metrics.system.status === 'healthy' ? 'Saludable' : 'Degradado'}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Uptime</span>
                </div>
                <div className="text-2xl font-bold">{formatUptime(metrics.system.uptime)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workers</CardTitle>
            <CardDescription>Estado de los workers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Workers Activos</span>
                  <Badge variant={metrics.workers.status === 'healthy' ? 'default' : 'destructive'}>
                    {metrics.workers.healthy}/{metrics.workers.total}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Estado</span>
                  <span className="text-sm capitalize">{metrics.workers.status}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integraciones</CardTitle>
          <CardDescription>Estado de las integraciones de plataformas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Total</div>
              <div className="text-2xl font-bold">{metrics.integrations.stats.total.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Habilitadas</div>
              <div className="text-2xl font-bold">{metrics.integrations.stats.enabled.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Activas</div>
              <div className="text-2xl font-bold">{metrics.integrations.stats.active.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

