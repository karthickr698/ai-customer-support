import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from '@/components/error-fallback';

type AppErrorBoundaryProps = {
  readonly children: ReactNode;
};

type AppErrorBoundaryState = {
  readonly error: Error | undefined;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public override state: AppErrorBoundaryState = { error: undefined };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', { name: error.name, componentStack: info.componentStack });
  }

  public override render(): ReactNode {
    const { error } = this.state;

    if (error) {
      return (
        <ErrorFallback
          error={error}
          onRetry={() => {
            this.setState({ error: undefined });
          }}
        />
      );
    }

    return this.props.children;
  }
}
