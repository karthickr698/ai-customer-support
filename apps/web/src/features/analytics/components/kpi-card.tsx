import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiCard({
  title,
  value,
  hint,
  tone = 'default',
}: {
  readonly title: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={cn(
            'text-2xl',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning-foreground',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
