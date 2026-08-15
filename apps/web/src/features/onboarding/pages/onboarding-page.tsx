import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  OnboardingResponse,
  OrganizationResponse,
  SupportToneId,
  UpdateAgentSettingsRequest,
} from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { hasPermission, roleLabel } from '@/features/organizations/permissions';
import { useTenantScope } from '@/features/organizations/use-tenant-scope';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { onboardingApi } from '../api';
import { AgentSettingsReview } from '../components/agent-settings-form';
import { BusinessBriefForm } from '../components/business-brief-form';
import { BusinessProfileReview } from '../components/business-profile-review';
import { KnowledgeSourcesStep } from '../components/knowledge-sources-step';
import { OnboardingReadonly } from '../components/onboarding-readonly';
import { OnboardingStepper } from '../components/onboarding-stepper';
import { ToneSelector } from '../components/tone-selector';
import { briefToSetupRequest, knowledgeSourcePayload, type BriefValues } from '../validation';
import { inferWizardStep, onboardingStatusLabel, type WizardStep } from '../wizard';

export function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingWorkspace />
    </RequireAuth>
  );
}

function OnboardingWorkspace() {
  const { organizationId = '' } = useParams();
  const navigate = useNavigate();
  useTenantScope(organizationId);
  const [stepOverride, setStepOverride] = useState<WizardStep>();
  const [selectedToneId, setSelectedToneId] = useState<SupportToneId | null>(null);

  const organization = useApiQuery<OrganizationResponse>({
    queryKey: queryKeys.organizations.detail(organizationId),
    path: `/api/organizations/${organizationId}`,
    enabled: organizationId.length > 0,
  });
  const onboardingQuery = useApiQuery<OnboardingResponse>({
    queryKey: queryKeys.onboarding.detail(organizationId),
    path: `/api/organizations/${organizationId}/onboarding`,
    enabled: organizationId.length > 0,
  });

  const membership = organization.data?.organization.membership;
  const permissions = membership?.permissions ?? [];
  const canUpdate = hasPermission(permissions, 'organization.update');
  const canManageKnowledge = hasPermission(permissions, 'knowledge.manage');
  const onboarding = onboardingQuery.data?.onboarding;
  const inferred = onboarding ? inferWizardStep(onboarding) : 'brief';
  const step = stepOverride ?? inferred;
  const toneId = selectedToneId ?? onboarding?.selectedToneId ?? null;

  const generateProfile = useApiMutation({
    mutationFn: (values: BriefValues) =>
      onboardingApi.generateBusinessProfile(organizationId, briefToSetupRequest(values)),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Business profile generated',
    onSuccess: () => {
      setStepOverride('profile');
    },
  });
  const runSetup = useApiMutation({
    mutationFn: (values: BriefValues) => onboardingApi.runSetup(organizationId, briefToSetupRequest(values)),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'AI setup generated',
    onSuccess: () => {
      setStepOverride('knowledge');
    },
  });
  const generateTones = useApiMutation({
    mutationFn: () => onboardingApi.generateTonePresets(organizationId),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Support tones generated',
    onSuccess: (result) => {
      setSelectedToneId(result.selectedToneId);
      setStepOverride('tone');
    },
  });
  const selectTone = useApiMutation({
    mutationFn: (nextTone: SupportToneId) => onboardingApi.selectTone(organizationId, { selectedToneId: nextTone }),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    errorMessage: false,
  });
  const generateAgent = useApiMutation({
    mutationFn: async () => {
      if (toneId) {
        await onboardingApi.selectTone(organizationId, { selectedToneId: toneId });
      }
      return onboardingApi.generateAgentSettings(organizationId);
    },
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Agent settings generated',
    onSuccess: () => {
      setStepOverride('agent');
    },
  });
  const updateAgent = useApiMutation({
    mutationFn: (patch: UpdateAgentSettingsRequest) => onboardingApi.updateAgentSettings(organizationId, patch),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Agent settings saved',
  });
  const addSource = useApiMutation({
    mutationFn: (body: ReturnType<typeof knowledgeSourcePayload>) =>
      onboardingApi.registerKnowledgeSource(organizationId, body),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Knowledge source registered',
  });

  const briefInitial = useMemo<Partial<BriefValues> | undefined>(() => {
    const profile = onboarding?.businessProfile;
    if (!profile) {
      return organization.data ? { companyName: organization.data.organization.name } : undefined;
    }
    return {
      companyName: profile.companyName,
      industry: profile.industry,
      websiteUrl: profile.websiteUrl ?? '',
      description: profile.description,
    };
  }, [onboarding?.businessProfile, organization.data]);

  if (organization.isPending || onboardingQuery.isPending) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-72 w-full" />
      </main>
    );
  }

  const loadError =
    organization.error instanceof ApiError
      ? organization.error.message
      : onboardingQuery.error instanceof ApiError
        ? onboardingQuery.error.message
        : organization.isError || onboardingQuery.isError
          ? 'Unable to load onboarding'
          : undefined;

  if (loadError || !onboarding || !organization.data) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Could not load workspace setup</AlertTitle>
          <AlertDescription>{loadError ?? 'Try again from your organization page.'}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/organizations">Back to organizations</Link>
        </Button>
      </main>
    );
  }

  const org = organization.data.organization;
  const mutationError = firstMutationError([
    generateProfile,
    runSetup,
    generateTones,
    generateAgent,
    updateAgent,
    addSource,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={`/organizations/${organizationId}`}>Workspace</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/organizations/${organizationId}/knowledge`}>Knowledge</Link>
            </Button>
          </div>
        }
        description={`Signed in as ${roleLabel(org.membership.role)}. AI setup requires an owner or admin; agents can add knowledge sources.`}
        title={`${org.name} onboarding`}
      />

      <div className="flex items-center gap-2">
        <Badge variant={onboarding.status === 'completed' ? 'secondary' : 'outline'}>
          {onboardingStatusLabel(onboarding.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">{roleLabel(org.membership.role)}</span>
      </div>

      {!canUpdate ? (
        <OnboardingReadonly
          canManageKnowledge={canManageKnowledge}
          onAddSource={(body) => addSource.mutateAsync(body).then(() => undefined)}
          onboarding={onboarding}
          pendingSource={addSource.isPending}
          roleLabel={roleLabel(org.membership.role)}
        />
      ) : (
        <>
          <OnboardingStepper completedThrough={inferred} current={step} />
          {mutationError ? (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          ) : null}
          {step === 'brief' ? (
            <Card>
              <CardHeader>
                <CardTitle>Tell us about the business</CardTitle>
                <CardDescription>
                  Generate a structured profile first, or run a complete setup that also picks a tone and agent
                  settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BusinessBriefForm
                  initial={briefInitial}
                  onGenerateProfile={(values) => generateProfile.mutateAsync(values).then(() => undefined)}
                  onRunFullSetup={(values) => runSetup.mutateAsync(values).then(() => undefined)}
                  pending={generateProfile.isPending ? 'profile' : runSetup.isPending ? 'setup' : false}
                />
              </CardContent>
            </Card>
          ) : null}
          {step === 'profile' && onboarding.businessProfile ? (
            <BusinessProfileReview
              onBack={() => {
                setStepOverride('brief');
              }}
              onContinue={() => {
                generateTones.mutate();
              }}
              pending={generateTones.isPending}
              profile={onboarding.businessProfile}
            />
          ) : null}
          {step === 'tone' ? (
            <Card>
              <CardHeader>
                <CardTitle>Choose a support tone</CardTitle>
                <CardDescription>The selected tone shapes greetings and reply style.</CardDescription>
              </CardHeader>
              <CardContent>
                {onboarding.tonePresets.length === 0 ? (
                  <Button disabled={generateTones.isPending} onClick={() => generateTones.mutate()} type="button">
                    Generate support tones
                  </Button>
                ) : (
                  <ToneSelector
                    onBack={() => {
                      setStepOverride('profile');
                    }}
                    onChange={(tone) => {
                      setSelectedToneId(tone);
                      selectTone.mutate(tone);
                    }}
                    onContinue={() => {
                      generateAgent.mutate();
                    }}
                    pending={generateAgent.isPending}
                    presets={onboarding.tonePresets}
                    selectedToneId={toneId}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}
          {step === 'agent' && onboarding.agentSettings ? (
            <Card>
              <CardHeader>
                <CardTitle>Review agent settings</CardTitle>
                <CardDescription>Adjust the greeting and guardrails before going live.</CardDescription>
              </CardHeader>
              <CardContent>
                <AgentSettingsReview
                  editable
                  key={onboarding.updatedAt}
                  onBack={() => {
                    setStepOverride('tone');
                  }}
                  onContinue={() => {
                    setStepOverride('knowledge');
                  }}
                  onSave={(patch) => updateAgent.mutateAsync(patch).then(() => undefined)}
                  pending={updateAgent.isPending}
                  settings={onboarding.agentSettings}
                />
              </CardContent>
            </Card>
          ) : null}
          {step === 'knowledge' ? (
            <Card>
              <CardHeader>
                <CardTitle>Knowledge sources</CardTitle>
                <CardDescription>
                  Optional. Register help content the assistant can retrieve. You can also do this later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KnowledgeSourcesStep
                  canManage={canManageKnowledge}
                  onAdd={(body) => addSource.mutateAsync(body).then(() => undefined)}
                  onBack={() => {
                    setStepOverride(onboarding.agentSettings ? 'agent' : 'brief');
                  }}
                  onFinish={() => {
                    void navigate(`/organizations/${organizationId}`);
                  }}
                  pending={addSource.isPending}
                  sources={onboarding.knowledgeSources}
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </main>
  );
}

function firstMutationError(mutations: ReadonlyArray<{ readonly error: unknown }>): string | undefined {
  for (const mutation of mutations) {
    if (mutation.error instanceof ApiError) {
      return mutation.error.message;
    }
  }
  return undefined;
}
