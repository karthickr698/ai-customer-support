export function TypingIndicator({ label }: { readonly label: string }) {
  return (
    <div className="mr-10 flex items-end gap-2" role="status" aria-live="polite">
      <div className="rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 shadow-sm">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="flex h-4 items-center gap-1">
          <span className="acs-dot size-1.5 rounded-full bg-muted-foreground" />
          <span className="acs-dot size-1.5 rounded-full bg-muted-foreground" />
          <span className="acs-dot size-1.5 rounded-full bg-muted-foreground" />
        </span>
      </div>
    </div>
  );
}
