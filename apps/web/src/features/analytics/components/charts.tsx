import type { AnalyticsNamedCountDto, AnalyticsTimeSeriesPointDto } from '@ai-customer-support/contracts';

export function BarList({ items, empty = 'No data in this period' }: { readonly items: readonly AnalyticsNamedCountDto[]; readonly empty?: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="capitalize">{item.name.replaceAll('_', ' ') || 'Unknown'}</span>
            <span className="tabular-nums text-muted-foreground">{String(item.count)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${String((item.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ points }: { readonly points: readonly AnalyticsTimeSeriesPointDto[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No series points.</p>;
  }
  const values = points.map((point) => point.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const width = 320;
  const height = 96;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / span) * (height - 8) - 4;
    return `${String(x)},${String(y)}`;
  });

  return (
    <svg aria-hidden="true" className="h-24 w-full text-primary" preserveAspectRatio="none" viewBox={`0 0 ${String(width)} ${String(height)}`}>
      <polyline fill="none" points={coords.join(' ')} stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
