import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Download, RefreshCw, BarChart3, Shield, Wallet } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { allPlatforms, getPlatformName } from '../config/platforms';
import { usePageLayoutConfig } from '../components/roastr/PageLayoutContext';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const RANGE_OPTIONS = [
  { label: 'Últimos 7 días', value: '7' },
  { label: 'Últimos 30 días', value: '30' },
  { label: 'Últimos 90 días', value: '90' },
  { label: 'Último año', value: '365' }
];

const GROUP_BY_OPTIONS = [
  { label: 'Por día', value: 'day' },
  { label: 'Por semana', value: 'week' },
  { label: 'Por mes', value: 'month' }
];

const EXPORT_DATASETS = [
  { label: 'Snapshots', value: 'snapshots' },
  { label: 'Uso de créditos', value: 'usage' },
  { label: 'Eventos', value: 'events' }
];

import {
  formatNumber as formatNumberUtil,
  formatCurrency as formatCurrencyUtil
} from '../lib/utils/format';

// Wrapper functions for compatibility with existing code
const formatNumber = (value) => {
  return formatNumberUtil(value);
};

const formatCurrency = (cents) => {
  // Convert cents to base currency unit for new utility
  const value = Number(cents) / 100;
  return formatCurrencyUtil(value, 'EUR', true);
};

const SummaryCard = ({ title, value, subtitle, trend }) => (
  <Card className="bg-white shadow-sm dark:bg-slate-900">
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {typeof trend === 'number' && (
        <Badge
          variant={trend >= 0 ? 'success' : 'destructive'}
          className="mt-2 inline-flex items-center gap-1"
        >
          {trend >= 0 ? '+' : ''}
          {trend.toFixed(1)}%
        </Badge>
      )}
    </CardContent>
  </Card>
);

export default function Analytics() {
  const [range, setRange] = useState('30');
  const [groupBy, setGroupBy] = useState('day');
  const [platform, setPlatform] = useState('all');
  const [dashboardData, setDashboardData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportDataset, setExportDataset] = useState('snapshots');
  const [exporting, setExporting] = useState(false);
  usePageLayoutConfig({
    title: 'Analytics',
    subtitle: 'Métricas multi-tenant y tendencia de campañas',
    description: 'Revisa patrones de Shield, costos y performance por plataforma'
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          range,
          groupBy,
          platform
        });
        const response = await fetch(`/api/analytics/dashboard?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo cargar analytics');
        }

        const payload = await response.json();
        setDashboardData(payload.data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'No se pudo cargar analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    return () => controller.abort();
  }, [range, groupBy, platform]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchBilling = async () => {
      try {
        setBillingLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/analytics/billing?range=${Math.max(Number(range), 90)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo cargar billing analytics');
        }

        const payload = await response.json();
        setBillingData(payload.data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Billing analytics error', err);
      } finally {
        setBillingLoading(false);
      }
    };

    fetchBilling();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleRefresh = () => {
    setRange((current) => `${Number(current)}`); // trigger useEffect
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        format,
        dataset: exportDataset,
        range
      });

      const response = await fetch(`/api/analytics/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Exportación fallida');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ||
        `analytics.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('✅ Exportación descargada correctamente', {
        description: `Archivo ${format.toUpperCase()} generado exitosamente`
      });
    } catch (err) {
      toast.error('Error al exportar datos', {
        description: err.message || 'No se pudo exportar los datos'
      });
    } finally {
      setExporting(false);
    }
  };

  const timelineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        x: {
          ticks: { maxRotation: 0 }
        },
        y: {
          beginAtZero: true
        }
      }
    }),
    []
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }),
    []
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }),
    []
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center space-y-4">
        <BarChart3 className="h-12 w-12 text-red-500" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
        <Button onClick={handleRefresh} variant="default">
          Reintentar
        </Button>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { summary, charts, shield, credits, features } = dashboardData;
  const polarAvailable = billingData?.polar?.available;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Métricas de uso, Shield y facturación Polar en tiempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {RANGE_OPTIONS.find((option) => option.value === range)?.label || 'Rango'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label ||
                  'Agrupar por'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {platform === 'all' ? 'Todas las plataformas' : getPlatformName(platform)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plataformas</SelectItem>
              {allPlatforms.map((platformKey) => (
                <SelectItem key={platformKey} value={platformKey}>
                  {getPlatformName(platformKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>
      </div>

      {!features.analyticsEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Analytics avanzados no disponibles en tu plan.</p>
          <p className="text-sm text-amber-800 mt-1">
            Mejora a Pro o superior para desbloquear exportaciones y métricas históricas completas.
          </p>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Roasts generados"
          value={formatNumber(summary?.totals?.roasts)}
          trend={summary?.growth?.roasts_pct}
        />
        <SummaryCard
          title="Análisis completados"
          value={formatNumber(summary?.totals?.analyses)}
          subtitle="Análisis con éxito en el periodo"
        />
        <SummaryCard
          title="Acciones Shield"
          value={formatNumber(summary?.totals?.shieldActions)}
          trend={summary?.growth?.shield_pct}
        />
        <SummaryCard
          title="Coste acumulado"
          value={formatCurrency(summary?.totals?.cost)}
          subtitle={`Tiempo medio: ${formatNumber(Math.round(summary?.averages?.response_time_ms || 0))} ms`}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Timeline de actividad</CardTitle>
            <Badge variant="outline">
              {groupBy === 'day' ? 'Diario' : groupBy === 'week' ? 'Semanal' : 'Mensual'}
            </Badge>
          </CardHeader>
          <CardContent className="h-[360px]">
            {charts?.timeline?.labels?.length ? (
              <Line
                data={charts.timeline}
                options={timelineOptions}
                aria-label="Gráfico de línea mostrando timeline de roasts, análisis y acciones Shield a lo largo del tiempo"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                <p>No hay datos para el rango seleccionado.</p>
                <p className="text-xs mt-1">Intenta seleccionar un rango diferente.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Distribución por plataforma</CardTitle>
            <Badge variant="secondary">
              Filtro: {platform === 'all' ? 'Todas' : getPlatformName(platform)}
            </Badge>
          </CardHeader>
          <CardContent>
            {charts?.platform?.labels?.length ? (
              <div className="h-[250px]">
                <Doughnut
                  data={charts.platform}
                  options={doughnutOptions}
                  aria-label="Gráfico de dona mostrando distribución de actividad por plataforma social"
                />
              </div>
            ) : (
              <div className="h-[250px] flex flex-col items-center justify-center text-sm text-muted-foreground">
                <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                <p>Sin datos suficientes para graficar.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Escudo y acciones recientes
            </CardTitle>
            <Badge variant="outline">{formatNumber(shield?.total_actions)} acciones</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Por tipo</p>
                <ul className="mt-2 space-y-1">
                  {Object.entries(shield?.actions_by_type || {}).map(([actionType, count]) => (
                    <li key={actionType} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-600 dark:text-slate-300">
                        {actionType.replace('_', ' ')}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatNumber(count)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Severidad</p>
                <ul className="mt-2 space-y-1">
                  {Object.entries(shield?.severity_distribution || {}).map(([severity, count]) => (
                    <li key={severity} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-600 dark:text-slate-300">
                        {severity}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatNumber(count)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase mb-2">Últimas acciones</p>
              <div className="space-y-2">
                {(shield?.recent || []).map((action) => (
                  <div
                    key={action.id}
                    className="rounded-lg border border-slate-100 dark:border-slate-800 p-2 flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white capitalize">
                        {action.action_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {action.severity}
                    </Badge>
                  </div>
                ))}
                {!shield?.recent?.length && (
                  <p className="text-sm text-muted-foreground">No hay acciones recientes.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="h-4 w-4" />
              Billing y Polar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Coste local</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(billingData?.localCosts?.total_cost_cents)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Ingresos Polar</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">
                    {polarAvailable
                      ? formatCurrency(billingData?.polar?.totals?.revenue_cents)
                      : 'Polar no disponible'}
                  </p>
                  {!polarAvailable && (
                    <p className="text-xs text-muted-foreground">
                      Configura POLAR_ACCESS_TOKEN para activar métricas en vivo.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Créditos utilizados</CardTitle>
            <Badge variant="outline">{Object.keys(credits?.totals || {}).length} fuentes</Badge>
          </CardHeader>
          <CardContent>
            {charts?.credits?.labels?.length ? (
              <div className="h-[280px]">
                <Bar
                  data={charts.credits}
                  options={barOptions}
                  aria-label="Gráfico de barras mostrando uso de créditos por período de tiempo"
                />
              </div>
            ) : (
              <div className="h-[250px] flex flex-col items-center justify-center text-sm text-muted-foreground">
                <Wallet className="h-8 w-8 mb-2 opacity-50" />
                <p>Sin datos disponibles.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" /> Exportaciones
            </CardTitle>
            <Badge variant={features.exportAllowed ? 'success' : 'warning'}>
              {features.exportAllowed ? 'Disponible' : 'Restringido'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={exportDataset} onValueChange={setExportDataset}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {EXPORT_DATASETS.find((option) => option.value === exportDataset)?.label ||
                    'Dataset a exportar'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EXPORT_DATASETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={!features.exportAllowed || exporting}
                onClick={() => handleExport('csv')}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={!features.exportAllowed || exporting}
                onClick={() => handleExport('json')}
              >
                JSON
              </Button>
            </div>
            {!features.exportAllowed && (
              <p className="text-xs text-muted-foreground">
                Mejora a Pro o Plus para habilitar exportaciones.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
