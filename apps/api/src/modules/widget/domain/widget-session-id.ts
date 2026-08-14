export type WidgetSessionId = string & { readonly __brand: 'WidgetSessionId' };

export function createWidgetSessionId(id: string = crypto.randomUUID()): WidgetSessionId {
  return id as WidgetSessionId;
}
