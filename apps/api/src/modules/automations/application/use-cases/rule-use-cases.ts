import type { EventBus } from '@ai-customer-support/shared';
import type { AutomationRuleListResponse, AutomationRuleResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AutomationRule } from '../../domain/automation-rule.js';
import { MAX_RULES_PER_TENANT, AutomationPolicy } from '../../domain/automation-policy.js';
import {
  AutomationRuleCreatedEvent,
  AutomationRuleDeletedEvent,
  AutomationRuleUpdatedEvent,
} from '../../domain/events.js';
import { AutomationRuleNotFoundError, InvalidAutomationError, TooManyAutomationRecordsError } from '../../domain/errors.js';
import { createAutomationRuleId } from '../../domain/ids.js';
import { isUuid } from '../../domain/values.js';
import { toRuleDto, type RequestSecurityContext } from '../dtos.js';
import type { AutomationRuleRepository, ClockPort, TenantAccessPort } from '../ports.js';

export class CreateAutomationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly triggerType: string;
    readonly actionType: string;
    readonly description?: string;
    readonly enabled?: boolean;
    readonly eventName?: string;
    readonly schedule?: string;
    readonly match?: string;
    readonly conditions?: unknown;
    readonly action?: unknown;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly priority?: number;
    readonly security: RequestSecurityContext;
  }): Promise<AutomationRuleResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const count = await this.rules.countByTenant(actor.tenantId);
    if (count >= MAX_RULES_PER_TENANT) {
      throw new TooManyAutomationRecordsError('automation rules');
    }
    const rule = AutomationRule.create({
      organizationId: actor.tenantId,
      name: input.name,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
      triggerType: input.triggerType,
      actionType: input.actionType,
      description: input.description,
      enabled: input.enabled,
      eventName: input.eventName,
      schedule: input.schedule,
      match: input.match,
      conditions: input.conditions,
      action: input.action,
      maxAttempts: input.maxAttempts,
      backoffMs: input.backoffMs,
      priority: input.priority,
      allowLocalHttp: this.allowLocalHttp,
    });
    await this.rules.save(rule);
    await this.eventBus.publish(
      new AutomationRuleCreatedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        rule.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { rule: toRuleDto(rule) };
  }
}

export class ListAutomationRulesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<AutomationRuleListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_READ);
    const items = await this.rules.listByTenant(actor.tenantId);
    return { items: items.filter((rule) => rule.belongsTo(actor.tenantId)).map(toRuleDto) };
  }
}

export class GetAutomationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
  }): Promise<AutomationRuleResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_READ);
    const rule = await loadRule(this.rules, actor.tenantId, input.ruleId);
    return { rule: toRuleDto(rule) };
  }
}

export class UpdateAutomationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
    readonly name?: string;
    readonly description?: string | null;
    readonly enabled?: boolean;
    readonly triggerType?: string;
    readonly eventName?: string | null;
    readonly schedule?: string | null;
    readonly match?: string;
    readonly conditions?: unknown;
    readonly actionType?: string;
    readonly action?: unknown;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly priority?: number;
    readonly security: RequestSecurityContext;
  }): Promise<AutomationRuleResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const rule = await loadRule(this.rules, actor.tenantId, input.ruleId);
    rule.update(
      {
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        triggerType: input.triggerType,
        eventName: input.eventName,
        schedule: input.schedule,
        match: input.match,
        conditions: input.conditions,
        actionType: input.actionType,
        action: input.action,
        maxAttempts: input.maxAttempts,
        backoffMs: input.backoffMs,
        priority: input.priority,
        allowLocalHttp: this.allowLocalHttp,
      },
      this.clock.now(),
    );
    await this.rules.save(rule);
    await this.eventBus.publish(
      new AutomationRuleUpdatedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        rule.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { rule: toRuleDto(rule) };
  }
}

export class SetAutomationRuleEnabledUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
    readonly enabled: boolean;
    readonly security: RequestSecurityContext;
  }): Promise<AutomationRuleResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const rule = await loadRule(this.rules, actor.tenantId, input.ruleId);
    rule.setEnabled(input.enabled, this.clock.now());
    await this.rules.save(rule);
    await this.eventBus.publish(
      new AutomationRuleUpdatedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        rule.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { rule: toRuleDto(rule) };
  }
}

export class DeleteAutomationRuleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const rule = await loadRule(this.rules, actor.tenantId, input.ruleId);
    await this.rules.delete(actor.tenantId, rule.id);
    await this.eventBus.publish(
      new AutomationRuleDeletedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        rule.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
  }
}

export async function loadRule(
  rules: AutomationRuleRepository,
  tenantId: string,
  ruleId: string,
): Promise<AutomationRule> {
  if (!isUuid(ruleId)) {
    throw new InvalidAutomationError('ruleId must be a UUID');
  }
  const rule = await rules.findById(tenantId, createAutomationRuleId(ruleId));
  if (!rule || !rule.belongsTo(tenantId)) {
    throw new AutomationRuleNotFoundError();
  }
  return rule;
}
