import { ReactNode, ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export type PageMetric = {
  label: string;
  value: ReactNode;
  helper?: string;
};

export type PageLayoutProps = {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  metrics?: PageMetric[];
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export type PageLayoutConfig = Omit<PageLayoutProps, 'children'>;

export const defaultPageLayout: PageLayoutConfig = {
  title: 'Panel de control',
  subtitle: 'Gestiona tus roasts, Shield y prioridad multi-tenant'
};

const UiSeparator = Separator as ComponentType<{ className?: string }>;

export function PageLayout({
  title,
  subtitle,
  description,
  actions,
  metrics = [],
  className,
  contentClassName,
  children
}: PageLayoutProps) {
  return (
    <section className={cn('flex w-full flex-col gap-6', className)}>
      <header className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm shadow-black/5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              Panel de Roastr
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-base text-muted-foreground">{subtitle}</p>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {metrics.length > 0 && (
          <>
            <UiSeparator className="my-6" />
            <dl className="grid gap-6 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wide">{metric.label}</dt>
                  <dd className="text-lg font-medium text-foreground">{metric.value}</dd>
                  {metric.helper && (
                    <span className="text-xs text-muted-foreground">{metric.helper}</span>
                  )}
                </div>
              ))}
            </dl>
          </>
        )}
      </header>

      <div className={cn('space-y-6', contentClassName)}>{children}</div>
    </section>
  );
}

export default PageLayout;
