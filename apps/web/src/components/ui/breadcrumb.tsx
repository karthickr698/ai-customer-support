import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
};

type BreadcrumbProps = {
  readonly items: readonly BreadcrumbItem[];
  readonly className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${String(index)}`}>
              <li>
                {item.href && !last ? (
                  <Link to={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span className={cn(last && 'font-medium text-foreground')}>{item.label}</span>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export function BreadcrumbSeparator({ children }: { readonly children?: ReactNode }) {
  return <span className="text-muted-foreground">{children ?? <ChevronRight className="size-3.5" />}</span>;
}
