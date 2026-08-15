export const WIDGET_MESSAGE_SOURCE = 'acs-widget';
export const HOST_MESSAGE_SOURCE = 'acs-host';

export type WidgetLayoutMessage = {
  readonly source: typeof WIDGET_MESSAGE_SOURCE;
  readonly type: 'layout';
  readonly open: boolean;
  readonly mobile: boolean;
  readonly position: 'left' | 'right';
  readonly unread: number;
};

export type HostControlMessage = {
  readonly source: typeof HOST_MESSAGE_SOURCE;
  readonly type: 'open' | 'close' | 'toggle';
};

export function isHostControlMessage(value: unknown): value is HostControlMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.source === HOST_MESSAGE_SOURCE &&
    (record.type === 'open' || record.type === 'close' || record.type === 'toggle')
  );
}

export function postLayout(target: Window, message: Omit<WidgetLayoutMessage, 'source'>): void {
  target.postMessage({ source: WIDGET_MESSAGE_SOURCE, ...message }, '*');
}
