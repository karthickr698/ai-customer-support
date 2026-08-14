import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

type PaginationProps = {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
};

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const previousDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {String(page)} of {String(pageCount)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={previousDisabled}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={nextDisabled}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
