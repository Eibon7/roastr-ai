import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type SettingsSectionProps = {
  title: string;
  description?: string;
  kicker?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SettingsSection({
  title,
  description,
  kicker,
  actions,
  footer,
  children,
  className,
  contentClassName
}: SettingsSectionProps) {
  return (
    <Card className={cn('border-border/70 bg-card/85 shadow-sm shadow-black/5 backdrop-blur', className)}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {kicker && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kicker}</p>}
          <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>{children}</CardContent>
      {footer && (
        <>
          <Separator className="mt-4" />
          <div className="p-4 text-sm text-muted-foreground">{footer}</div>
        </>
      )}
    </Card>
  );
}

export default SettingsSection;

