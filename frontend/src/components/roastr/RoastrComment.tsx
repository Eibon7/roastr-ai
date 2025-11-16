import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type RoastrCommentProps = {
  author: string;
  handle?: string;
  platform?: string;
  timestamp: string;
  content: string;
  avatarUrl?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  toxicityScore?: number;
  tags?: string[];
  actions?: ReactNode;
  onReply?: () => void;
  className?: string;
};

const sentimentMap: Record<NonNullable<RoastrCommentProps['sentiment']>, string> = {
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  neutral: 'bg-slate-50 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
  negative: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200'
};

export function RoastrComment({
  author,
  handle,
  platform,
  timestamp,
  content,
  avatarUrl,
  sentiment = 'neutral',
  toxicityScore,
  tags = [],
  actions,
  onReply,
  className
}: RoastrCommentProps) {
  return (
    <Card className={cn('border-border/70 bg-card/80 shadow-sm shadow-black/5 backdrop-blur', className)}>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold uppercase text-primary">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={author}
                  className="h-full w-full rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                author.slice(0, 2)
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">{author}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {handle && <span>{handle} &bull; </span>}
                {platform && `${platform} • `}{timestamp}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className={cn('text-xs capitalize', sentimentMap[sentiment])}>{sentiment}</Badge>
            {typeof toxicityScore === 'number' && (
              <Badge variant="secondary" className="text-xs">
                Toxicidad {Math.round(toxicityScore * 100)}%
              </Badge>
            )}
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs uppercase tracking-wide">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 text-base leading-relaxed text-foreground">
        <p className="text-balance">{content}</p>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{timestamp}</span>
          {platform && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="font-medium uppercase tracking-wide">{platform}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onReply && (
            <Button size="sm" className="rounded-full" onClick={onReply}>
              Responder
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default RoastrComment;

