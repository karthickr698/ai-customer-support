import { useEffect, useRef } from 'react';
import type { OnboardingDto, SupportToneId } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BusinessBriefForm } from './business-brief-form';
import { BusinessProfileReview } from './business-profile-review';
import { KnowledgeSourcesStep } from './knowledge-sources-step';
import { ToneSelector } from './tone-selector';
import { WizardMessage, WizardPanel, WizardTyping } from './wizard-message';
import type { BriefValues } from '../validation';
import { knowledgeSourcePayload } from '../validation';
import { stepIndex, type WizardStep } from '../wizard';

export type WizardPending = 'profile' | 'setup' | 'tones' | 'agent' | 'source' | false;

export function OnboardingConversation({
  organizationName,
  userName,
  onboarding,
  step,
  toneId,
  pending,
  canManageKnowledge,
  editingBrief,
  briefInitial,
  onGenerateProfile,
  onRunFullSetup,
  onContinueToTone,
  onEditBrief,
  onSelectTone,
  onContinueFromTone,
  onBackToProfile,
  onAddSource,
  onBackToTone,
  onFinish,
}: {
  readonly organizationName: string;
  readonly userName: string;
  readonly onboarding: OnboardingDto;
  readonly step: WizardStep;
  readonly toneId: SupportToneId | null;
  readonly pending: WizardPending;
  readonly canManageKnowledge: boolean;
  readonly editingBrief: boolean;
  readonly briefInitial?: Partial<BriefValues>;
  readonly onGenerateProfile: (values: BriefValues) => Promise<void>;
  readonly onRunFullSetup: (values: BriefValues) => Promise<void>;
  readonly onContinueToTone: () => void;
  readonly onEditBrief: () => void;
  readonly onSelectTone: (toneId: SupportToneId) => void;
  readonly onContinueFromTone: () => void;
  readonly onBackToProfile: () => void;
  readonly onAddSource: (body: ReturnType<typeof knowledgeSourcePayload>) => Promise<void>;
  readonly onBackToTone: () => void;
  readonly onFinish: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const showTones = step === 'tone' && onboarding.tonePresets.length > 0;
  const showKnowledge = step === 'knowledge';
  const showBrief = step === 'profile' && (!onboarding.businessProfile || editingBrief);
  const selectedTone = onboarding.tonePresets.find((preset) => preset.id === toneId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [step, pending, onboarding.updatedAt, editingBrief]);

  return (
    <section
      aria-label="Onboarding conversation"
      className="flex h-[min(46rem,calc(100vh-14rem))] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card"
    >
      <header className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Setup assistant</p>
        <p className="text-xs text-muted-foreground">
          Business profile, support tone, then knowledge sources — with a live agent preview.
        </p>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4" aria-live="polite">
          <WizardMessage name="Setup assistant" role="assistant">
            <p>
              I will set up the {organizationName} support assistant in three steps: a business profile, a support
              tone, and knowledge sources. The panel on the right is a live preview of how the agent will greet
              customers.
            </p>
            {showBrief ? (
              <p>Start with a short brief — what you sell, who you support, and how customers reach you.</p>
            ) : null}
            {showBrief ? (
              <WizardPanel>
                <BusinessBriefForm
                  initial={briefInitial}
                  onGenerateProfile={onGenerateProfile}
                  onRunFullSetup={onRunFullSetup}
                  pending={pending === 'profile' || pending === 'setup' ? pending : false}
                />
              </WizardPanel>
            ) : null}
          </WizardMessage>

          {pending === 'profile' || pending === 'setup' ? (
            <WizardTyping
              label={
                pending === 'setup'
                  ? 'Generating profile, tone, and agent settings together…'
                  : 'Reading the brief and drafting a business profile…'
              }
            />
          ) : null}

          {onboarding.businessProfile ? (
            <>
              <WizardMessage name={userName} role="user">
                <p>
                  Here is {onboarding.businessProfile.companyName}
                  {onboarding.businessProfile.industry ? ` (${onboarding.businessProfile.industry})` : ''}.
                </p>
                <p className="opacity-90">{truncate(onboarding.businessProfile.description, 280)}</p>
              </WizardMessage>
              <WizardMessage name="Setup assistant" role="assistant">
                <p>I turned that into a structured profile. Confirm it before we pick a voice.</p>
                <WizardPanel>
                  <BusinessProfileReview
                    embedded
                    onBack={step === 'profile' ? onEditBrief : undefined}
                    onContinue={step === 'profile' ? onContinueToTone : undefined}
                    pending={pending === 'tones'}
                    profile={onboarding.businessProfile}
                  />
                </WizardPanel>
              </WizardMessage>
            </>
          ) : null}

          {pending === 'tones' ? (
            <WizardTyping label="Writing support-tone options from the profile…" />
          ) : null}

          {showTones ? (
            <WizardMessage name="Setup assistant" role="assistant">
              <p>Choose the voice customers should hear. The live preview updates with the example reply immediately.</p>
              <WizardPanel>
                <ToneSelector
                  onBack={step === 'tone' ? onBackToProfile : undefined}
                  onChange={onSelectTone}
                  onContinue={step === 'tone' ? onContinueFromTone : undefined}
                  pending={pending === 'agent'}
                  presets={onboarding.tonePresets}
                  selectedToneId={toneId}
                />
              </WizardPanel>
            </WizardMessage>
          ) : null}

          {pending === 'agent' ? (
            <WizardTyping label="Drafting greetings and guardrails for the live preview…" />
          ) : null}

          {step === 'tone' && onboarding.tonePresets.length === 0 && pending !== 'tones' ? (
            <WizardMessage name="Setup assistant" role="assistant">
              <p>I need tone presets before we can preview the assistant voice.</p>
              <Button onClick={onContinueToTone} type="button">
                Generate support tones
              </Button>
            </WizardMessage>
          ) : null}

          {onboarding.agentSettings && stepIndex(step) >= stepIndex('tone') ? (
            <WizardMessage name="Setup assistant" role="assistant">
              <p>
                {selectedTone
                  ? `You chose the ${selectedTone.name.toLowerCase()} tone. I drafted ${onboarding.agentSettings.assistantName}.`
                  : `I drafted ${onboarding.agentSettings.assistantName}.`}{' '}
                Greeting, topics, and handoff rules are in the live preview — edit them there and they update as you
                type.
              </p>
            </WizardMessage>
          ) : null}

          {showKnowledge ? (
            <WizardMessage name="Setup assistant" role="assistant">
              <p>
                Last step: register help content the assistant can retrieve. This is optional — you can finish now and
                add sources later.
              </p>
              <WizardPanel>
                <KnowledgeSourcesStep
                  canManage={canManageKnowledge}
                  onAdd={onAddSource}
                  onBack={onBackToTone}
                  onFinish={onFinish}
                  pending={pending === 'source'}
                  sources={onboarding.knowledgeSources}
                />
              </WizardPanel>
            </WizardMessage>
          ) : null}

          <div ref={endRef} />
        </div>
      </ScrollArea>
    </section>
  );
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
