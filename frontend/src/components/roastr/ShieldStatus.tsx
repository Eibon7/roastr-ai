import { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

type ShieldStatusProps = {
  status: 'clean' | 'monitored' | 'escalated' | 'blocked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-1
  actions?: string[];
  lastActionAt?: string;
  notes?: ReactNode;
  className?: string;
};

const severityMap: Record<ShieldStatusProps['severity'], { label: string; color: string }> = {
  low: { label: 'Bajo', color: 'bg-emerald-500/15 text-emerald-400' },
  medium: { label: 'Medio', color: 'bg-amber-500/15 text-amber-400' },
  high: { label: 'Alto', color: 'bg-orange-500/15 text-orange-400' },
  critical: { label: 'Crítico', color: 'bg-red-500/15 text-red-400' }
};

const statusCopy: Record<ShieldStatusProps['status'], string> = {
  clean: 'Sin incidencias recientes',
  monitored: 'En observación por reincidencia',
  escalated: 'Acciones preventivas activas',
  blocked: 'Bloqueado temporalmente'
};

export function ShieldStatus({
  status,
  severity,
  score,
  actions = [],
  lastActionAt,
  notes,
  className
}: ShieldStatusProps) {
  const severityInfo = severityMap[severity];
  const percentage = Math.round(score * 100);

  return (
    <Card
      className={cn(
        'border-border/70 bg-card/80 shadow-sm shadow-black/5 backdrop-blur',
        className
      )}
    >
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Estado Shield</CardTitle>
              <p className="text-sm text-muted-foreground">{statusCopy[status]}</p>
            </div>
          </div>
          <Badge className={cn('text-xs uppercase tracking-wide', severityInfo.color)}>
            {severityInfo.label}
          </Badge>
        </div>
        <div className="space-y-2 rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Nivel de riesgo</span>
            <span className="font-medium text-foreground">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {actions.length > 0 && (
          <Alert className="border border-border/60 bg-muted/30 text-muted-foreground">
            {status === 'blocked' ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
            <AlertTitle>Acciones ejecutadas</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {actions.map((action) => (
                  <li key={action} className="text-sm">
                    {action}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {lastActionAt && (
          <p className="text-xs text-muted-foreground">
            Última acción registrada: <span className="font-mono">{lastActionAt}</span>
          </p>
        )}
        {notes}
      </CardContent>
    </Card>
  );
}

export default ShieldStatus;
