import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type RoastrReplyProps = {
  title?: string;
  reply: string;
  status?: 'draft' | 'scheduled' | 'published';
  toneLabel?: string;
  score?: number;
  actions?: ReactNode;
  onCopy?: () => void;
  onSend?: () => void;
  className?: string;
};

const statusVariant: Record<
  NonNullable<RoastrReplyProps['status']>,
  'secondary' | 'default' | 'outline'
> = {
  draft: 'secondary',
  scheduled: 'default',
  published: 'outline'
};

export function RoastrReply({
  title = 'Respuesta sugerida',
  reply,
  status = 'draft',
  toneLabel = 'Sarcasmo elegante',
  score,
  actions,
  onCopy,
  onSend,
  className
}: RoastrReplyProps) {
  return (
    <Card
      className={cn(
        'border-border/70 bg-card/85 shadow-sm shadow-black/5 backdrop-blur',
        className
      )}
    >
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{toneLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[status]} className="capitalize">
              {status}
            </Badge>
            {typeof score === 'number' && (
              <Badge variant="outline" className="font-mono text-xs">
                Score {Math.round(score * 100)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={reply}
          readOnly
          className="min-h-[160px] resize-none bg-background/60 text-base leading-relaxed"
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Ajusta antes de publicar. Mantén la voz de Roastr intacta.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onCopy && (
            <Button variant="outline" size="sm" onClick={onCopy}>
              Copiar
            </Button>
          )}
          {onSend && (
            <Button size="sm" onClick={onSend}>
              Publicar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default RoastrReply;
