import { type FormEvent, useState } from 'react';
import type { AgentSettingsDto, UpdateAgentSettingsRequest } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Definition, StringList } from './onboarding-stepper';

function joinList(items: readonly string[]): string {
  return items.join('\n');
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

export function AgentSettingsReview({
  settings,
  editable,
  pending,
  onSave,
  onBack,
  onContinue,
}: {
  readonly settings: AgentSettingsDto;
  readonly editable: boolean;
  readonly pending?: boolean;
  readonly onSave?: (patch: UpdateAgentSettingsRequest) => Promise<void>;
  readonly onBack?: () => void;
  readonly onContinue?: () => void;
}) {
  const [assistantName, setAssistantName] = useState(settings.assistantName);
  const [greeting, setGreeting] = useState(settings.greeting);
  const [signature, setSignature] = useState(settings.signature ?? '');
  const [language, setLanguage] = useState(settings.language);
  const [systemInstructions, setSystemInstructions] = useState(settings.systemInstructions);
  const [allowedTopics, setAllowedTopics] = useState(joinList(settings.allowedTopics));
  const [forbiddenTopics, setForbiddenTopics] = useState(joinList(settings.forbiddenTopics));
  const [escalateWhen, setEscalateWhen] = useState(joinList(settings.escalateWhen));
  const [maxAutonomyTurns, setMaxAutonomyTurns] = useState(String(settings.maxAutonomyTurns));
  const [collectContactInfo, setCollectContactInfo] = useState(settings.collectContactInfo);
  const [handoffToHuman, setHandoffToHuman] = useState(settings.handoffToHuman);
  const [turnsError, setTurnsError] = useState<string>();

  if (!editable) {
    return (
      <div className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Definition label="Assistant name">{settings.assistantName}</Definition>
          <Definition label="Language">{settings.language}</Definition>
          <Definition label="Greeting">{settings.greeting}</Definition>
          <Definition label="Signature">{settings.signature ?? 'None'}</Definition>
          <Definition label="Allowed topics">
            <StringList items={settings.allowedTopics} />
          </Definition>
          <Definition label="Forbidden topics">
            <StringList items={settings.forbiddenTopics} />
          </Definition>
          <Definition label="Escalate when">
            <StringList items={settings.escalateWhen} />
          </Definition>
          <Definition label="Autonomy">{`${String(settings.maxAutonomyTurns)} turns`}</Definition>
          <Definition label="Collect contact">{settings.collectContactInfo ? 'Yes' : 'No'}</Definition>
          <Definition label="Handoff to human">{settings.handoffToHuman ? 'Yes' : 'No'}</Definition>
        </dl>
        <p className="text-sm leading-6 text-muted-foreground">{settings.systemInstructions}</p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const turns = Number.parseInt(maxAutonomyTurns, 10);
    if (!Number.isInteger(turns) || turns < 1 || turns > 20) {
      setTurnsError('Autonomy must be a whole number between 1 and 20');
      return;
    }
    setTurnsError(undefined);
    await onSave?.({
      assistantName: assistantName.trim(),
      greeting: greeting.trim(),
      signature: signature.trim().length > 0 ? signature.trim() : null,
      language: language.trim(),
      systemInstructions: systemInstructions.trim(),
      allowedTopics: splitList(allowedTopics),
      forbiddenTopics: splitList(forbiddenTopics),
      escalateWhen: splitList(escalateWhen),
      maxAutonomyTurns: turns,
      collectContactInfo,
      handoffToHuman,
    });
  }

  return (
    <form aria-busy={pending} className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="assistantName" label="Assistant name" required>
          <Input id="assistantName" maxLength={80} onChange={(event) => setAssistantName(event.target.value)} required value={assistantName} />
        </Field>
        <Field id="language" label="Language" required>
          <Input id="language" maxLength={64} onChange={(event) => setLanguage(event.target.value)} required value={language} />
        </Field>
      </div>
      <Field id="greeting" label="Greeting" required>
        <Textarea id="greeting" maxLength={1000} onChange={(event) => setGreeting(event.target.value)} required rows={3} value={greeting} />
      </Field>
      <Field id="signature" label="Signature">
        <Input id="signature" maxLength={200} onChange={(event) => setSignature(event.target.value)} value={signature} />
      </Field>
      <Field hint="One topic per line." id="allowedTopics" label="Allowed topics">
        <Textarea id="allowedTopics" onChange={(event) => setAllowedTopics(event.target.value)} rows={3} value={allowedTopics} />
      </Field>
      <Field hint="One topic per line." id="forbiddenTopics" label="Forbidden topics">
        <Textarea id="forbiddenTopics" onChange={(event) => setForbiddenTopics(event.target.value)} rows={3} value={forbiddenTopics} />
      </Field>
      <Field hint="One situation per line." id="escalateWhen" label="Escalate when">
        <Textarea id="escalateWhen" onChange={(event) => setEscalateWhen(event.target.value)} rows={3} value={escalateWhen} />
      </Field>
      <Field id="systemInstructions" label="System instructions" required>
        <Textarea
          id="systemInstructions"
          maxLength={8000}
          onChange={(event) => setSystemInstructions(event.target.value)}
          required
          rows={6}
          value={systemInstructions}
        />
      </Field>
      <Field error={turnsError} hint="How many AI turns before a human should take over." id="maxAutonomyTurns" label="Max autonomy turns">
        <Input
          id="maxAutonomyTurns"
          max={20}
          min={1}
          onChange={(event) => {
            setMaxAutonomyTurns(event.target.value);
            setTurnsError(undefined);
          }}
          type="number"
          value={maxAutonomyTurns}
        />
      </Field>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="collectContactInfo">Collect contact information</Label>
          <Switch checked={collectContactInfo} id="collectContactInfo" onCheckedChange={setCollectContactInfo} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="handoffToHuman">Handoff to a human when needed</Label>
          <Switch checked={handoffToHuman} id="handoffToHuman" onCheckedChange={setHandoffToHuman} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onBack ? (
          <Button onClick={onBack} type="button" variant="outline">
            Back
          </Button>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? (
            <>
              <Spinner label="Saving agent settings" />
              Saving…
            </>
          ) : (
            'Save agent settings'
          )}
        </Button>
        {onContinue ? (
          <Button onClick={onContinue} type="button" variant="secondary">
            Continue
          </Button>
        ) : null}
      </div>
    </form>
  );
}
