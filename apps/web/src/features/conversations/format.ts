const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return 'No activity';
  }

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return 'Unknown';
  }

  const diff = Date.now() - then;
  if (diff < MINUTE) {
    return 'Just now';
  }
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${String(minutes)}m ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${String(hours)}h ago`;
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `${String(days)}d ago`;
  }

  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function conversationTitle(input: {
  readonly subject: string | null;
  readonly customerName: string;
}): string {
  const subject = input.subject?.trim();
  return subject && subject.length > 0 ? subject : input.customerName;
}
