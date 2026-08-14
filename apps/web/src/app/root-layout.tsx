import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingFallback } from '@/components/loading-fallback';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
