import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
}

const statusStyles = {
  healthy:
    'border-green-500/30 hover:border-green-500/60 hover:shadow-[0_0_20px_rgba(80,250,123,0.2)]',
  warning:
    'border-yellow-500/30 hover:border-yellow-500/60 hover:shadow-[0_0_20px_rgba(241,250,140,0.2)]',
  critical: 'border-red-500/30 hover:border-red-500/60 hover:shadow-[0_0_20px_rgba(255,85,85,0.2)]'
};

const valueColors = {
  healthy: 'text-green-500',
  warning: 'text-yellow-500',
  critical: 'text-red-500'
};

/**
 * StatusCard - Migrado de styled-components a shadcn/ui
 *
 * Muestra una métrica con valor, unidad opcional y estado visual
 * Ahora usa Card de shadcn con Tailwind classes
 */
export const StatusCard: React.FC<StatusCardProps> = ({ label, value, max, unit, status }) => {
  const displayValue = max ? `${value}/${max}` : value.toFixed(1);
  const displayUnit = unit || (max ? '' : '');

  return (
    <Card className={cn('min-w-[200px] h-20 transition-all duration-150', statusStyles[status])}>
      <CardContent className="flex flex-col items-center justify-center gap-2 p-4 h-full">
        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <div className={cn('font-mono text-3xl font-semibold leading-none', valueColors[status])}>
            {displayValue}
          </div>
          {displayUnit && (
            <span className="font-mono text-sm text-muted-foreground">{displayUnit}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
