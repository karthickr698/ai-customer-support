export type AiAgentActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<AiAgentActor>;
}
