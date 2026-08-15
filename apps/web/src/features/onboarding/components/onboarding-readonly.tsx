import type { OnboardingDto } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentSettingsReview } from './agent-settings-form';
import { BusinessProfileReview } from './business-profile-review';
import { KnowledgeSourcesStep } from './knowledge-sources-step';
import { ToneSelector } from './tone-selector';
import { knowledgeSourcePayload } from '../validation';

export function OnboardingReadonly({
  onboarding,
  canManageKnowledge,
  roleLabel,
  pendingSource,
  onAddSource,
}: {
  readonly onboarding: OnboardingDto;
  readonly canManageKnowledge: boolean;
  readonly roleLabel: string;
  readonly pendingSource?: boolean;
  readonly onAddSource?: (body: ReturnType<typeof knowledgeSourcePayload>) => Promise<void>;
}) {
  if (onboarding.status !== 'completed' || !onboarding.businessProfile || !onboarding.agentSettings) {
    return (
      <div className="space-y-6">
        <Alert variant="info">
          <AlertTitle>Setup is in progress</AlertTitle>
          <AlertDescription>
            Your role ({roleLabel}) can view this workspace, but an owner or admin needs to finish AI onboarding
            before the assistant is ready.
          </AlertDescription>
        </Alert>
        {canManageKnowledge ? (
          <Card>
            <CardHeader>
              <CardTitle>Knowledge sources</CardTitle>
              <CardDescription>Agents can register sources while setup continues.</CardDescription>
            </CardHeader>
            <CardContent>
              <KnowledgeSourcesStep
                canManage={canManageKnowledge}
                onAdd={onAddSource}
                pending={pendingSource}
                sources={onboarding.knowledgeSources}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const selected = onboarding.tonePresets.find((preset) => preset.id === onboarding.selectedToneId);

  return (
    <div className="space-y-6">
      <Alert variant="success">
        <AlertTitle>Workspace is ready</AlertTitle>
        <AlertDescription>
          You are signed in as {roleLabel}. Profile and agent settings are read-only for your role.
        </AlertDescription>
      </Alert>
      <BusinessProfileReview profile={onboarding.businessProfile} />
      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Support tone</CardTitle>
            <CardDescription>
              {selected.name}
              {selected.recommended ? <Badge className="ml-2" variant="secondary">Recommended</Badge> : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ToneSelector
              disabled
              onChange={() => undefined}
              presets={onboarding.tonePresets}
              selectedToneId={onboarding.selectedToneId}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Agent settings</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentSettingsReview editable={false} settings={onboarding.agentSettings} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge sources</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeSourcesStep
            canManage={canManageKnowledge}
            onAdd={onAddSource}
            pending={pendingSource}
            sources={onboarding.knowledgeSources}
          />
        </CardContent>
      </Card>
    </div>
  );
}
