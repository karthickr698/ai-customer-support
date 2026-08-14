export const WIDGET_POSITIONS = ['left', 'right'] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export const WIDGET_SESSION_KINDS = ['anonymous', 'customer'] as const;
export type WidgetSessionKind = (typeof WIDGET_SESSION_KINDS)[number];

export type WidgetConfigurationDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly publicKey: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly greeting: string;
  readonly primaryColor: string;
  readonly position: WidgetPosition;
  readonly launcherText: string;
  readonly collectEmail: boolean;
  readonly allowAnonymous: boolean;
  readonly allowAttachments: boolean;
  readonly aiEnabled: boolean;
  readonly offlineMessage: string;
  readonly allowedOrigins: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublicWidgetConfigurationDto = {
  readonly organizationId: string;
  readonly publicKey: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly greeting: string;
  readonly primaryColor: string;
  readonly position: WidgetPosition;
  readonly launcherText: string;
  readonly collectEmail: boolean;
  readonly allowAnonymous: boolean;
  readonly allowAttachments: boolean;
  readonly aiEnabled: boolean;
  readonly offlineMessage: string;
};

export type UpdateWidgetConfigurationRequest = {
  readonly enabled?: boolean;
  readonly title?: string;
  readonly greeting?: string;
  readonly primaryColor?: string;
  readonly position?: WidgetPosition;
  readonly launcherText?: string;
  readonly collectEmail?: boolean;
  readonly allowAnonymous?: boolean;
  readonly allowAttachments?: boolean;
  readonly aiEnabled?: boolean;
  readonly offlineMessage?: string;
  readonly allowedOrigins?: readonly string[];
};

export type WidgetConfigurationResponse = {
  readonly widget: WidgetConfigurationDto;
};

export type PublicWidgetConfigurationResponse = {
  readonly widget: PublicWidgetConfigurationDto;
};

export type WidgetSessionDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly visitorId: string;
  readonly kind: WidgetSessionKind;
  readonly email: string | null;
  readonly name: string | null;
  readonly customerId: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
};

export type CreateWidgetSessionRequest = {
  readonly visitorId?: string;
  readonly email?: string;
  readonly name?: string;
};

export type IdentifyWidgetSessionRequest = {
  readonly email: string;
  readonly name: string;
};

export type WidgetSessionResponse = {
  readonly session: WidgetSessionDto;
  readonly sessionToken: string;
};

export type WidgetSessionMeResponse = {
  readonly session: WidgetSessionDto;
};

export type CreateWidgetConversationRequest = {
  readonly subject?: string;
  readonly message?: string;
  readonly attachmentIds?: readonly string[];
};

export type SendWidgetMessageRequest = {
  readonly body?: string;
  readonly attachmentIds?: readonly string[];
};

export type WidgetConversationStatusRequest = {
  readonly status: 'open' | 'resolved' | 'closed';
};
