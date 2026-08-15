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
import { useAuthStore } from '@/features/identity/auth-store';
import { RequireAuth } from '@/features/identity/components/require-auth';
import { hasPermission, roleLabel } from '@/features/organizations/permissions';
import { useTenantScope } from '@/features/organizations/use-tenant-scope';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { onboardingApi } from '../api';
import { AgentPreview } from '../components/agent-preview';
import { AgentSettingsReview } from '../components/agent-settings-form';
import { OnboardingConversation, type WizardPending } from '../components/onboarding-conversation';
import { OnboardingReadonly } from '../components/onboarding-readonly';
import { OnboardingStepper } from '../components/onboarding-stepper';
import { briefToSetupRequest, knowledgeSourcePayload, type BriefValues } from '../validation';
import { inferWizardStep, onboardingStatusLabel, toAgentPreview, type WizardStep } from '../wizard';

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
  const user = useAuthStore((state) => state.user);
  useTenantScope(organizationId);
  const [stepOverride, setStepOverride] = useState<WizardStep>();
  const [selectedToneId, setSelectedToneId] = useState<SupportToneId | null>(null);
  const [editingBrief, setEditingBrief] = useState(false);
  const [agentDraft, setAgentDraft] = useState<UpdateAgentSettingsRequest | null>(null);

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
  const inferred = onboarding ? inferWizardStep(onboarding) : 'profile';
  const step = stepOverride ?? inferred;
  const toneId = selectedToneId ?? onboarding?.selectedToneId ?? null;

  const generateProfile = useApiMutation({
    mutationFn: (values: BriefValues) =>
      onboardingApi.generateBusinessProfile(organizationId, briefToSetupRequest(values)),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'Business profile generated',
    onSuccess: () => {
      setEditingBrief(false);
      setStepOverride('profile');
    },
  });
  const runSetup = useApiMutation({
    mutationFn: (values: BriefValues) => onboardingApi.runSetup(organizationId, briefToSetupRequest(values)),
    invalidateKeys: [queryKeys.onboarding.detail(organizationId)],
    successMessage: 'AI setup generated',
    onSuccess: () => {
      setEditingBrief(false);
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
      setAgentDraft(null);
      setStepOverride((current) => (current === 'profile' ? 'profile' : 'knowledge'));
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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
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
  const pending: WizardPending = generateProfile.isPending
    ? 'profile'
    : runSetup.isPending
      ? 'setup'
      : generateTones.isPending
        ? 'tones'
        : generateAgent.isPending
          ? 'agent'
          : addSource.isPending
            ? 'source'
            : false;
  const preview = toAgentPreview(onboarding, agentDraft, toneId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <PageHeader
        description={`Signed in as ${roleLabel(org.membership.role)}. Owners and admins walk through profile, tone, and knowledge while the agent preview updates live.`}
        title="AI setup"
      />

      <div className="flex items-center gap-2">
        <Badge variant={onboarding.status === 'completed' ? 'secondary' : 'outline'}>
          {onboardingStatusLabel(onboarding.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">{roleLabel(org.membership.role)}</span>
      </div>

      {!canUpdate ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <OnboardingReadonly
            canManageKnowledge={canManageKnowledge}
            onAddSource={(body) => addSource.mutateAsync(body).then(() => undefined)}
            onboarding={onboarding}
            pendingSource={addSource.isPending}
            roleLabel={roleLabel(org.membership.role)}
          />
          <AgentPreview preview={preview} />
        </div>
      ) : (
        <>
          <OnboardingStepper
            completedThrough={inferred}
            current={step}
            onSelect={(next) => {
              setEditingBrief(false);
              setStepOverride(next);
            }}
          />
          {mutationError ? (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <OnboardingConversation
              briefInitial={briefInitial}
              canManageKnowledge={canManageKnowledge}
              editingBrief={editingBrief}
              onAddSource={(body) => addSource.mutateAsync(body).then(() => undefined)}
              onBackToProfile={() => {
                setStepOverride('profile');
              }}
              onBackToTone={() => {
                setStepOverride('tone');
              }}
              onContinueFromTone={() => {
                if (onboarding.agentSettings && onboarding.selectedToneId === toneId) {
                  setStepOverride('knowledge');
                  return;
                }
                generateAgent.mutate();
              }}
              onContinueToTone={() => {
                if (onboarding.tonePresets.length > 0) {
                  setStepOverride('tone');
                  return;
                }
                generateTones.mutate();
              }}
              onEditBrief={() => {
                setEditingBrief(true);
              }}
              onFinish={() => {
                void navigate(`/organizations/${organizationId}/members`);
              }}
              onGenerateProfile={(values) => generateProfile.mutateAsync(values).then(() => undefined)}
              onRunFullSetup={(values) => runSetup.mutateAsync(values).then(() => undefined)}
              onSelectTone={(tone) => {
                setSelectedToneId(tone);
                selectTone.mutate(tone);
              }}
              onboarding={onboarding}
              organizationName={org.name}
              pending={pending}
              step={step}
              toneId={toneId}
              userName={user?.displayName ?? 'You'}
            />
            <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <AgentPreview generating={pending === 'agent' || pending === 'setup'} preview={preview} />
              {onboarding.agentSettings ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Edit agent settings</CardTitle>
                    <CardDescription>Changes show in the preview immediately. Save to keep them.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      disabled={generateAgent.isPending}
                      onClick={() => {
                        generateAgent.mutate();
                      }}
                      type="button"
                      variant="outline"
                    >
                      {generateAgent.isPending ? 'Regenerating…' : 'Regenerate from current tone'}
                    </Button>
                    <AgentSettingsReview
                      editable
                      key={onboarding.agentSettings.systemInstructions}
                      onDraftChange={setAgentDraft}
                      onSave={(patch) => updateAgent.mutateAsync(patch).then(() => undefined)}
                      pending={updateAgent.isPending}
                      settings={onboarding.agentSettings}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </aside>
          </div>
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
