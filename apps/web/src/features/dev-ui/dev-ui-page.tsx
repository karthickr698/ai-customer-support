import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PageHeader } from '@/components/ui/page-header';
import { Separator } from '@/components/ui/separator';
import {
  ApiSection,
  ButtonsSection,
  DataSection,
  FeedbackSection,
  FormsSection,
  OverlaysSection,
  ThemeSection,
  TypographySection,
} from './gallery-sections';

const NAV = [
  { href: '#theme', label: 'Theme' },
  { href: '#typography', label: 'Typography' },
  { href: '#buttons', label: 'Buttons' },
  { href: '#forms', label: 'Forms' },
  { href: '#feedback', label: 'Feedback' },
  { href: '#data', label: 'Data' },
  { href: '#overlays', label: 'Overlays' },
  { href: '#api', label: 'API' },
] as const;

export function DevUiPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-8 lg:px-8">
        <aside className="sticky top-8 hidden h-fit w-44 shrink-0 lg:block">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Gallery</p>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 space-y-12">
          <div className="space-y-6">
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Dev UI' }]} />
            <PageHeader
              title="Component gallery"
              description="Global theme, shared components, and the API client used by every feature module. This page is available in development only."
            />
          </div>
          <Separator />
          <ThemeSection />
          <TypographySection />
          <ButtonsSection />
          <FormsSection />
          <FeedbackSection />
          <DataSection />
          <OverlaysSection />
          <ApiSection />
        </div>
      </div>
    </div>
  );
}
