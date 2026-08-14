import { InvalidWidgetSessionError, WidgetSessionExpiredError } from './errors.js';
import { createWidgetSessionId, type WidgetSessionId } from './widget-session-id.js';

export const WIDGET_SESSION_KINDS = ['anonymous', 'customer'] as const;
export type WidgetSessionKind = (typeof WIDGET_SESSION_KINDS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WidgetSessionSnapshot = {
  readonly id: WidgetSessionId;
  readonly organizationId: string;
  readonly widgetConfigurationId: string;
  readonly visitorId: string;
  readonly kind: WidgetSessionKind;
  readonly email: string | undefined;
  readonly name: string | undefined;
  readonly customerId: string | undefined;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | undefined;
  readonly createdAt: Date;
};

export class WidgetSession {
  private constructor(
    readonly id: WidgetSessionId,
    readonly organizationId: string,
    readonly widgetConfigurationId: string,
    readonly visitorId: string,
    private kindValue: WidgetSessionKind,
    private emailValue: string | undefined,
    private nameValue: string | undefined,
    private customerIdValue: string | undefined,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private lastSeenAtValue: Date,
    private revokedAtValue: Date | undefined,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly widgetConfigurationId: string;
    readonly visitorId: string;
    readonly kind: WidgetSessionKind;
    readonly tokenHash: string;
    readonly now: Date;
    readonly expiresAt: Date;
    readonly email?: string;
    readonly name?: string;
    readonly customerId?: string;
    readonly id?: WidgetSessionId;
  }): WidgetSession {
    const visitorId = normalizeVisitorId(input.visitorId);
    const identity = normalizeIdentity(input.kind, input.email, input.name);

    return new WidgetSession(
      input.id ?? createWidgetSessionId(),
      input.organizationId,
      input.widgetConfigurationId,
      visitorId,
      identity.kind,
      identity.email,
      identity.name,
      input.customerId,
      input.tokenHash,
      input.expiresAt,
      input.now,
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: WidgetSessionSnapshot): WidgetSession {
    return new WidgetSession(
      snapshot.id,
      snapshot.organizationId,
      snapshot.widgetConfigurationId,
      snapshot.visitorId,
      snapshot.kind,
      snapshot.email,
      snapshot.name,
      snapshot.customerId,
      snapshot.tokenHash,
      snapshot.expiresAt,
      snapshot.lastSeenAt,
      snapshot.revokedAt,
      snapshot.createdAt,
    );
  }

  get kind(): WidgetSessionKind {
    return this.kindValue;
  }

  get email(): string | undefined {
    return this.emailValue;
  }

  get name(): string | undefined {
    return this.nameValue;
  }

  get customerId(): string | undefined {
    return this.customerIdValue;
  }

  get lastSeenAt(): Date {
    return this.lastSeenAtValue;
  }

  get revokedAt(): Date | undefined {
    return this.revokedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  isActive(now: Date): boolean {
    return !this.revokedAtValue && this.expiresAt.getTime() > now.getTime();
  }

  assertActive(now: Date): void {
    if (this.revokedAtValue || this.expiresAt.getTime() <= now.getTime()) {
      throw new WidgetSessionExpiredError();
    }
  }

  touch(now: Date): void {
    this.lastSeenAtValue = now;
  }

  identify(input: { readonly email: string; readonly name: string; readonly now: Date }): void {
    this.assertActive(input.now);
    const identity = normalizeIdentity('customer', input.email, input.name);
    this.kindValue = 'customer';
    this.emailValue = identity.email;
    this.nameValue = identity.name;
    this.lastSeenAtValue = input.now;
  }

  toSnapshot(): WidgetSessionSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      widgetConfigurationId: this.widgetConfigurationId,
      visitorId: this.visitorId,
      kind: this.kindValue,
      email: this.emailValue,
      name: this.nameValue,
      customerId: this.customerIdValue,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      lastSeenAt: this.lastSeenAtValue,
      revokedAt: this.revokedAtValue,
      createdAt: this.createdAt,
    };
  }
}

function normalizeVisitorId(raw: string): string {
  const visitorId = raw.trim();
  if (visitorId.length < 8 || visitorId.length > 80) {
    throw new InvalidWidgetSessionError('Visitor id must be between 8 and 80 characters');
  }

  return visitorId;
}

function normalizeIdentity(
  kind: WidgetSessionKind,
  email: string | undefined,
  name: string | undefined,
): { kind: WidgetSessionKind; email: string | undefined; name: string | undefined } {
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedName = name?.trim();

  if (kind === 'customer') {
    if (!trimmedEmail || trimmedEmail.length > 254 || !EMAIL_PATTERN.test(trimmedEmail)) {
      throw new InvalidWidgetSessionError('Enter a valid customer email address');
    }

    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 80) {
      throw new InvalidWidgetSessionError('Customer name must be between 1 and 80 characters');
    }

    return { kind: 'customer', email: trimmedEmail, name: trimmedName };
  }

  if (trimmedName && (trimmedName.length < 1 || trimmedName.length > 80)) {
    throw new InvalidWidgetSessionError('Visitor name must be at most 80 characters');
  }

  return {
    kind: 'anonymous',
    email: undefined,
    name: trimmedName,
  };
}
