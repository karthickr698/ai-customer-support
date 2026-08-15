export type AssignmentCandidate = {
  readonly userId: string;
  readonly role: string;
  readonly presence: string;
};

const ASSIGNABLE_ROLES = new Set(['owner', 'admin', 'agent']);

export class AssignmentPolicy {
  static availableAgentIds(candidates: readonly AssignmentCandidate[]): string[] {
    return candidates
      .filter((candidate) => ASSIGNABLE_ROLES.has(candidate.role) && candidate.presence === 'online')
      .map((candidate) => candidate.userId)
      .sort();
  }

  static pickRoundRobin(candidateIds: readonly string[], lastAssignedId?: string): string | undefined {
    if (candidateIds.length === 0) {
      return undefined;
    }
    if (!lastAssignedId) {
      return candidateIds[0];
    }
    const index = candidateIds.indexOf(lastAssignedId);
    if (index === -1) {
      return candidateIds[0];
    }
    return candidateIds[(index + 1) % candidateIds.length];
  }
}
