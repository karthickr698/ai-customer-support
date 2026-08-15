export type CustomerActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<CustomerActor>;
}

export interface ClockPort {
  now(): Date;
}
