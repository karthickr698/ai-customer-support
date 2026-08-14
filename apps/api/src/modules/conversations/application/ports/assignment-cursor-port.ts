export interface AssignmentCursorPort {
  takeNext(tenantId: string, candidateIds: readonly string[]): Promise<string | undefined>;
}
