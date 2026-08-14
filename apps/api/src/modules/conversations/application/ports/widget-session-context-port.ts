export type WidgetSessionActor = {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly visitorId: string;
  readonly kind: 'anonymous' | 'customer';
  readonly email: string | undefined;
  readonly name: string | undefined;
  readonly customerId: string | undefined;
  readonly origin: string | undefined;
};

export type WidgetRuntimeSettings = {
  readonly enabled: boolean;
  readonly allowAnonymous: boolean;
  readonly allowAttachments: boolean;
  readonly aiEnabled: boolean;
  readonly greeting: string;
  readonly allowedOrigins: readonly string[];
};

export interface WidgetSessionContextPort {
  requireSession(token: string, origin: string | undefined): Promise<WidgetSessionActor>;
  loadRuntimeSettings(tenantId: string): Promise<WidgetRuntimeSettings>;
}
