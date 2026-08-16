export function JsonPreview({
  value,
  label,
}: {
  readonly value: unknown;
  readonly label: string;
}) {
  return (
    <pre
      aria-label={label}
      className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 break-all whitespace-pre-wrap"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
