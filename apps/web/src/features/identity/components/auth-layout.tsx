import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthLayout({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI Customer Support
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function AuthForm({
  onSubmit,
  children,
  disabled,
}: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <form
      aria-busy={disabled}
      className="space-y-4"
      noValidate
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}

export function AuthFooterLink({
  prompt,
  to,
  label,
}: {
  readonly prompt: string;
  readonly to: string;
  readonly label: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      {prompt ? `${prompt} ` : null}
      <Link className="font-medium text-primary hover:underline" to={to}>
        {label}
      </Link>
    </p>
  );
}
