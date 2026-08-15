const PREFIX = 'acs.widget';

export type StoredWidgetSession = {
  readonly sessionToken: string;
  readonly conversationId: string | null;
};

export function readStoredSession(publicKey: string): StoredWidgetSession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(publicKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredWidgetSession>;
    if (typeof parsed.sessionToken !== 'string' || parsed.sessionToken.length === 0) {
      return null;
    }

    return {
      sessionToken: parsed.sessionToken,
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : null,
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(publicKey: string, session: StoredWidgetSession): void {
  window.sessionStorage.setItem(storageKey(publicKey), JSON.stringify(session));
}

export function clearStoredSession(publicKey: string): void {
  window.sessionStorage.removeItem(storageKey(publicKey));
}

function storageKey(publicKey: string): string {
  return `${PREFIX}.${publicKey}`;
}
