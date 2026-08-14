import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { GenerateBusinessProfileUseCase } from '../../../application/use-cases/generate-business-profile-use-case.js';
import type {
  GenerateInitialAgentSettingsUseCase,
  UpdateAgentSettingsUseCase,
} from '../../../application/use-cases/generate-initial-agent-settings-use-case.js';
import type {
  GenerateSupportTonePresetsUseCase,
  SelectSupportToneUseCase,
} from '../../../application/use-cases/generate-support-tone-presets-use-case.js';
import type { GetOnboardingUseCase } from '../../../application/use-cases/get-onboarding-use-case.js';
import type { RunOnboardingSetupUseCase } from '../../../application/use-cases/run-onboarding-setup-use-case.js';
import { OnboardingNotFoundError, UnauthorizedError } from '../../../domain/errors.js';
import {
  generateBusinessProfileBodySchema,
  runOnboardingSetupBodySchema,
  selectSupportToneBodySchema,
  updateAgentSettingsBodySchema,
} from './onboarding-schemas.js';
import { parseBody } from './parse-body.js';

export type OnboardingHttpUseCases = {
  readonly getOnboarding: GetOnboardingUseCase;
  readonly runOnboardingSetup: RunOnboardingSetupUseCase;
  readonly generateBusinessProfile: GenerateBusinessProfileUseCase;
  readonly generateSupportTonePresets: GenerateSupportTonePresetsUseCase;
  readonly selectSupportTone: SelectSupportToneUseCase;
  readonly generateInitialAgentSettings: GenerateInitialAgentSettingsUseCase;
  readonly updateAgentSettings: UpdateAgentSettingsUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerOnboardingRoutes(
  app: FastifyInstance,
  useCases: OnboardingHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireUpdate = createRequirePermissionPreHandler(Permissions.ORGANIZATION_UPDATE);
  const tenantAuth = [authenticate, resolveTenant];

  app.get(
    '/api/organizations/:organizationId/onboarding',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getOnboarding.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/onboarding/setup',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(runOnboardingSetupBodySchema, request.body);
      const result = await useCases.runOnboardingSetup.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        description: body.description,
        companyName: body.companyName,
        websiteUrl: body.websiteUrl,
        industry: body.industry,
        extraNotes: body.extraNotes,
        selectedToneId: body.selectedToneId,
        knowledgeSources: body.knowledgeSources,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/onboarding/business-profile',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(generateBusinessProfileBodySchema, request.body);
      const result = await useCases.generateBusinessProfile.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        description: body.description,
        companyName: body.companyName,
        websiteUrl: body.websiteUrl,
        industry: body.industry,
        extraNotes: body.extraNotes,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/onboarding/business-profile',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getOnboarding.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      if (!result.onboarding.businessProfile) {
        throw new OnboardingNotFoundError();
      }
      return reply.status(200).send({ businessProfile: result.onboarding.businessProfile });
    },
  );

  app.post(
    '/api/organizations/:organizationId/onboarding/tone-presets',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const result = await useCases.generateSupportTonePresets.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/onboarding/tone-presets',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getOnboarding.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send({
        items: result.onboarding.tonePresets,
        selectedToneId: result.onboarding.selectedToneId,
      });
    },
  );

  app.patch(
    '/api/organizations/:organizationId/onboarding/tone-presets',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(selectSupportToneBodySchema, request.body);
      const result = await useCases.selectSupportTone.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        selectedToneId: body.selectedToneId,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/onboarding/agent-settings',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const result = await useCases.generateInitialAgentSettings.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/onboarding/agent-settings',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getOnboarding.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      if (!result.onboarding.agentSettings) {
        throw new OnboardingNotFoundError();
      }
      return reply.status(200).send({ agentSettings: result.onboarding.agentSettings });
    },
  );

  app.patch(
    '/api/organizations/:organizationId/onboarding/agent-settings',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(updateAgentSettingsBodySchema, request.body);
      const result = await useCases.updateAgentSettings.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        patch: body,
      });
      return reply.status(200).send(result);
    },
  );
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }
  return tenantId;
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
