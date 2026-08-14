export type WidgetConfigurationId = string & { readonly __brand: 'WidgetConfigurationId' };

export function createWidgetConfigurationId(
  id: string = crypto.randomUUID(),
): WidgetConfigurationId {
  return id as WidgetConfigurationId;
}
