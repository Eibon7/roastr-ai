import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type UsageMeterProps = {
  title: string;
  used: number;
  limit: number;
  unit?: string;
  badge?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'analysis' | 'roast' | 'shield';
  className?: string;
  description?: string;
  helper?: string;
};

const toneGradients: Record<NonNullable<UsageMeterProps['tone']>, string> = {
  analysis: 'from-amber-500/30 to-orange-500/20 text-amber-100',
  roast: 'from-rose-500/30 to-pink-500/20 text-rose-100',
  shield: 'from-emerald-500/30 to-teal-500/20 text-emerald-100'
};

export function UsageMeter({
  title,
  used,
  limit,
  unit = 'acciones',
  badge,
  trend = 'flat',
  tone = 'analysis',
  className,
  description,
  helper
}: UsageMeterProps) {
  const isUnlimited = limit < 0;
  const safeLimit = isUnlimited ? Math.max(used || 1, 1) : limit;
  const percentage =
    safeLimit === 0 ? 0 : Math.min(100, Math.round((used / safeLimit) * 100));
  const remaining = isUnlimited ? '∞' : Math.max(safeLimit - used, 0).toLocaleString();

  return (
    <Card className={cn('overflow-hidden border-none bg-background/40 backdrop-blur', className)}>
      <div className={cn('h-2 w-full bg-gradient-to-r', toneGradients[tone])} />
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-foreground">
              {used.toLocaleString()}
              <span className="text-base font-medium text-muted-foreground">
                {' '}
                / {isUnlimited ? '∞' : limit.toLocaleString()}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">Usados este mes</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-mono text-lg text-foreground">{percentage}%</p>
            <p className="capitalize">
              Tendencia:{' '}
              <span className="font-semibold text-foreground">
                {trend === 'up' ? '↗︎' : trend === 'down' ? '↘︎' : '→'} {trend}
              </span>
            </p>
          </div>
        </div>
        {!isUnlimited && <Progress value={percentage} className="h-2" />}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Restantes: {remaining} {unit}
          </span>
          <span>{helper ?? 'Renueva automáticamente al inicio del mes'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default UsageMeter;

