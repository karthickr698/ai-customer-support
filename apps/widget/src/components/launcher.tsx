import { MessageCircle, X } from 'lucide-react';

export function Launcher({
  open,
  label,
  onToggle,
}: {
  readonly open: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={open}
      aria-controls="acs-widget-panel"
      aria-label={open ? 'Close support chat' : label}
      className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-95"
      onClick={onToggle}
      type="button"
    >
      {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
    </button>
  );
}
