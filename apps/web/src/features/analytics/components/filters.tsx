import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AnalyticsGranularity } from '@ai-customer-support/contracts';
import { Select } from '@/components/ui/select';
import { GRANULARITY_OPTIONS, RANGE_OPTIONS } from '../labels';

export type AnalyticsFilterState = {
  readonly range: string;
  readonly granularity: AnalyticsGranularity;
  readonly from: string;
  readonly to: string;
};

export function useAnalyticsFilters(): {
  readonly filters: AnalyticsFilterState;
  readonly params: { from: string; to: string; granularity: AnalyticsGranularity };
  readonly setRange: (range: string) => void;
  readonly setGranularity: (granularity: AnalyticsGranularity) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get('range') ?? '14';
  const granularity = (searchParams.get('granularity') as AnalyticsGranularity | null) ?? 'day';

  const period = useMemo(() => {
    const days = Number(range) || 14;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString(), granularity };
  }, [granularity, range]);

  return {
    filters: { range, granularity, from: period.from, to: period.to },
    params: period,
    setRange: (next) => {
      const params = new URLSearchParams(searchParams);
      params.set('range', next);
      setSearchParams(params, { replace: true });
    },
    setGranularity: (next) => {
      const params = new URLSearchParams(searchParams);
      params.set('granularity', next);
      setSearchParams(params, { replace: true });
    },
  };
}

export function AnalyticsFilters({
  range,
  granularity,
  onRangeChange,
  onGranularityChange,
}: {
  readonly range: string;
  readonly granularity: AnalyticsGranularity;
  readonly onRangeChange: (range: string) => void;
  readonly onGranularityChange: (granularity: AnalyticsGranularity) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="w-40">
        <Select
          onValueChange={onRangeChange}
          options={[...RANGE_OPTIONS]}
          searchable={false}
          value={range}
        />
      </div>
      <div className="w-32">
        <Select
          onValueChange={(value) => {
            if (value === 'hour' || value === 'day' || value === 'week' || value === 'month') {
              onGranularityChange(value);
            }
          }}
          options={[...GRANULARITY_OPTIONS]}
          searchable={false}
          value={granularity}
        />
      </div>
    </div>
  );
}
