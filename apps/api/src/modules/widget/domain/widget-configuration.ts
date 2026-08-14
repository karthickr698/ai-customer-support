import type { WidgetPosition } from '@ai-customer-support/contracts';
import { InvalidWidgetConfigurationError } from './errors.js';
import {
  generateWidgetPublicKey,
  parseAllowedOrigin,
  parsePrimaryColor,
  parseWidgetPosition,
} from './widget-appearance.js';
import {
  createWidgetConfigurationId,
  type WidgetConfigurationId,
} from './widget-configuration-id.js';

export type WidgetConfigurationSnapshot = {
  readonly id: WidgetConfigurationId;
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
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class WidgetConfiguration {
  private constructor(
    readonly id: WidgetConfigurationId,
    readonly organizationId: string,
    private publicKeyValue: string,
    private enabledValue: boolean,
    private titleValue: string,
    private greetingValue: string,
    private primaryColorValue: string,
    private positionValue: WidgetPosition,
    private launcherTextValue: string,
    private collectEmailValue: boolean,
    private allowAnonymousValue: boolean,
    private allowAttachmentsValue: boolean,
    private aiEnabledValue: boolean,
    private offlineMessageValue: string,
    private allowedOriginsValue: string[],
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static createDefault(input: {
    readonly organizationId: string;
    readonly now: Date;
    readonly id?: WidgetConfigurationId;
    readonly publicKey?: string;
  }): WidgetConfiguration {
    return new WidgetConfiguration(
      input.id ?? createWidgetConfigurationId(),
      input.organizationId,
      input.publicKey ?? generateWidgetPublicKey(),
      true,
      'Chat with us',
      'Hi — how can we help today?',
      '#2563eb',
      'right',
      'Help',
      true,
      true,
      true,
      true,
      'We are away right now. Leave a message and we will get back to you.',
      [],
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: WidgetConfigurationSnapshot): WidgetConfiguration {
    return new WidgetConfiguration(
      snapshot.id,
      snapshot.organizationId,
      snapshot.publicKey,
      snapshot.enabled,
      snapshot.title,
      snapshot.greeting,
      snapshot.primaryColor,
      snapshot.position,
      snapshot.launcherText,
      snapshot.collectEmail,
      snapshot.allowAnonymous,
      snapshot.allowAttachments,
      snapshot.aiEnabled,
      snapshot.offlineMessage,
      [...snapshot.allowedOrigins],
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get publicKey(): string {
    return this.publicKeyValue;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get title(): string {
    return this.titleValue;
  }

  get greeting(): string {
    return this.greetingValue;
  }

  get primaryColor(): string {
    return this.primaryColorValue;
  }

  get position(): WidgetPosition {
    return this.positionValue;
  }

  get launcherText(): string {
    return this.launcherTextValue;
  }

  get collectEmail(): boolean {
    return this.collectEmailValue;
  }

  get allowAnonymous(): boolean {
    return this.allowAnonymousValue;
  }

  get allowAttachments(): boolean {
    return this.allowAttachmentsValue;
  }

  get aiEnabled(): boolean {
    return this.aiEnabledValue;
  }

  get offlineMessage(): string {
    return this.offlineMessageValue;
  }

  get allowedOrigins(): readonly string[] {
    return this.allowedOriginsValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  rotatePublicKey(now: Date): void {
    this.publicKeyValue = generateWidgetPublicKey();
    this.updatedAtValue = now;
  }

  update(
    patch: {
      readonly enabled?: boolean;
      readonly title?: string;
      readonly greeting?: string;
      readonly primaryColor?: string;
      readonly position?: string;
      readonly launcherText?: string;
      readonly collectEmail?: boolean;
      readonly allowAnonymous?: boolean;
      readonly allowAttachments?: boolean;
      readonly aiEnabled?: boolean;
      readonly offlineMessage?: string;
      readonly allowedOrigins?: readonly string[];
    },
    now: Date,
  ): void {
    if (patch.enabled !== undefined) {
      this.enabledValue = patch.enabled;
    }
    if (patch.title !== undefined) {
      this.titleValue = normalizeText(patch.title, 'Title', 1, 80);
    }
    if (patch.greeting !== undefined) {
      this.greetingValue = normalizeText(patch.greeting, 'Greeting', 1, 280);
    }
    if (patch.primaryColor !== undefined) {
      this.primaryColorValue = parsePrimaryColor(patch.primaryColor);
    }
    if (patch.position !== undefined) {
      this.positionValue = parseWidgetPosition(patch.position);
    }
    if (patch.launcherText !== undefined) {
      this.launcherTextValue = normalizeText(patch.launcherText, 'Launcher text', 1, 40);
    }
    if (patch.collectEmail !== undefined) {
      this.collectEmailValue = patch.collectEmail;
    }
    if (patch.allowAnonymous !== undefined) {
      this.allowAnonymousValue = patch.allowAnonymous;
    }
    if (patch.allowAttachments !== undefined) {
      this.allowAttachmentsValue = patch.allowAttachments;
    }
    if (patch.aiEnabled !== undefined) {
      this.aiEnabledValue = patch.aiEnabled;
    }
    if (patch.offlineMessage !== undefined) {
      this.offlineMessageValue = normalizeText(patch.offlineMessage, 'Offline message', 1, 280);
    }
    if (patch.allowedOrigins !== undefined) {
      this.allowedOriginsValue = uniqueOrigins(patch.allowedOrigins);
    }

    this.updatedAtValue = now;
  }

  toSnapshot(): WidgetConfigurationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      publicKey: this.publicKeyValue,
      enabled: this.enabledValue,
      title: this.titleValue,
      greeting: this.greetingValue,
      primaryColor: this.primaryColorValue,
      position: this.positionValue,
      launcherText: this.launcherTextValue,
      collectEmail: this.collectEmailValue,
      allowAnonymous: this.allowAnonymousValue,
      allowAttachments: this.allowAttachmentsValue,
      aiEnabled: this.aiEnabledValue,
      offlineMessage: this.offlineMessageValue,
      allowedOrigins: this.allowedOriginsValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidWidgetConfigurationError(
      `${label} must be between ${min} and ${max} characters`,
    );
  }

  return value;
}

function uniqueOrigins(values: readonly string[]): string[] {
  if (values.length > 50) {
    throw new InvalidWidgetConfigurationError('A widget can allow at most 50 origins');
  }

  return [...new Set(values.map(parseAllowedOrigin))];
}
