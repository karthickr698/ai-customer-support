import type { Prisma, PrismaClient } from '@prisma/client';
import { EscalationRule, type EscalationRuleSnapshot } from '../../../domain/escalation-rule.js';
import { createEscalationRuleId, type EscalationRuleId } from '../../../domain/escalation-rule-id.js';
import {
  parseEscalationAction,
  parseEscalationTrigger,
  type EscalationTrigger,
} from '../../../domain/escalation-trigger.js';
import type { EscalationRuleRepository } from '../../../application/ports/escalation-rule-repository.js';

type EscalationRuleRecord = {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerMinutes: number | null;
  keywords: string[];
  action: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresEscalationRuleRepository implements EscalationRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, ruleId: EscalationRuleId): Promise<EscalationRule | null> {
    const record = await this.prisma.escalationRule.findFirst({
      where: { id: ruleId, organizationId: tenantId },
    });
    return record ? toRule(record) : null;
  }

  async save(rule: EscalationRule): Promise<void> {
    const snapshot = rule.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.escalationRule.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        enabled: data.enabled,
        triggerType: data.triggerType,
        triggerMinutes: data.triggerMinutes,
        keywords: data.keywords,
        action: data.action,
        priority: data.priority,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(tenantId: string, ruleId: EscalationRuleId): Promise<void> {
    await this.prisma.escalationRule.deleteMany({
      where: { id: ruleId, organizationId: tenantId },
    });
  }

  async listByTenant(tenantId: string): Promise<EscalationRule[]> {
    const records = await this.prisma.escalationRule.findMany({
      where: { organizationId: tenantId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toRule);
  }

  async listEnabled(tenantId: string): Promise<EscalationRule[]> {
    const records = await this.prisma.escalationRule.findMany({
      where: { organizationId: tenantId, enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toRule);
  }

  async listTenantIdsWithEnabledRules(): Promise<string[]> {
    const records = await this.prisma.escalationRule.findMany({
      where: { enabled: true },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
    return records.map((record) => record.organizationId);
  }
}

function toRule(record: EscalationRuleRecord): EscalationRule {
  const trigger: EscalationTrigger = parseEscalationTrigger({
    type: record.triggerType,
    minutes: record.triggerMinutes,
    keywords: record.keywords,
  });
  const snapshot: EscalationRuleSnapshot = {
    id: createEscalationRuleId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    enabled: record.enabled,
    trigger,
    action: parseEscalationAction(record.action),
    priority: record.priority,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return EscalationRule.reconstitute(snapshot);
}

function toRecord(snapshot: EscalationRuleSnapshot): Prisma.EscalationRuleUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    enabled: snapshot.enabled,
    triggerType: snapshot.trigger.type,
    triggerMinutes:
      snapshot.trigger.type === 'unanswered_for' || snapshot.trigger.type === 'unassigned_for'
        ? snapshot.trigger.minutes
        : null,
    keywords: snapshot.trigger.type === 'keyword_match' ? [...snapshot.trigger.keywords] : [],
    action: snapshot.action,
    priority: snapshot.priority,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
