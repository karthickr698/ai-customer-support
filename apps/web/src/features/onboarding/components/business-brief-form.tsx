import { type FormEvent, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  COMPANY_NAME_MAX,
  DESCRIPTION_MAX,
  EXTRA_NOTES_MAX,
  INDUSTRY_MAX,
  type BriefValues,
  validateDescription,
  validateOptionalMax,
  validateOptionalUrl,
} from '../validation';

const EMPTY_BRIEF: BriefValues = {
  companyName: '',
  industry: '',
  websiteUrl: '',
  description: '',
  extraNotes: '',
};

export function BusinessBriefForm({
  initial,
  pending,
  error,
  onGenerateProfile,
  onRunFullSetup,
}: {
  readonly initial?: Partial<BriefValues>;
  readonly pending?: 'profile' | 'setup' | false;
  readonly error?: string;
  readonly onGenerateProfile: (values: BriefValues) => Promise<void>;
  readonly onRunFullSetup: (values: BriefValues) => Promise<void>;
}) {
  const [values, setValues] = useState<BriefValues>({ ...EMPTY_BRIEF, ...initial });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BriefValues, string>>>({});

  function update<K extends keyof BriefValues>(key: K, value: BriefValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const next = {
      description: validateDescription(values.description),
      companyName: validateOptionalMax(values.companyName, COMPANY_NAME_MAX, 'Company name'),
      industry: validateOptionalMax(values.industry, INDUSTRY_MAX, 'Industry'),
      websiteUrl: validateOptionalUrl(values.websiteUrl),
      extraNotes: validateOptionalMax(values.extraNotes, EXTRA_NOTES_MAX, 'Notes'),
    };
    setFieldErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    await onGenerateProfile(values);
  }

  const busy = Boolean(pending);

  return (
    <form aria-busy={busy} className="space-y-4" noValidate onSubmit={(event) => void submitProfile(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={fieldErrors.companyName} id="companyName" label="Company name">
          <Input
            autoComplete="organization"
            id="companyName"
            maxLength={COMPANY_NAME_MAX}
            onChange={(event) => {
              update('companyName', event.target.value);
            }}
            value={values.companyName}
          />
        </Field>
        <Field error={fieldErrors.industry} id="industry" label="Industry">
          <Input
            id="industry"
            maxLength={INDUSTRY_MAX}
            onChange={(event) => {
              update('industry', event.target.value);
            }}
            placeholder="SaaS, retail, healthcare…"
            value={values.industry}
          />
        </Field>
      </div>
      <Field error={fieldErrors.websiteUrl} hint="Used as context for the AI profile." id="websiteUrl" label="Website">
        <Input
          autoComplete="url"
          id="websiteUrl"
          onChange={(event) => {
            update('websiteUrl', event.target.value);
          }}
          placeholder="https://example.com"
          type="url"
          value={values.websiteUrl}
        />
      </Field>
      <Field
        error={fieldErrors.description}
        hint="Products, customers, and how you support them. Required."
        id="description"
        label="Business description"
        required
      >
        <Textarea
          id="description"
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => {
            update('description', event.target.value);
          }}
          rows={6}
          value={values.description}
        />
      </Field>
      <Field error={fieldErrors.extraNotes} id="extraNotes" label="Extra notes">
        <Textarea
          id="extraNotes"
          maxLength={EXTRA_NOTES_MAX}
          onChange={(event) => {
            update('extraNotes', event.target.value);
          }}
          rows={3}
          value={values.extraNotes}
        />
      </Field>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Setup failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {pending ? (
        <Alert variant="info">
          <AlertTitle>Generating with AI</AlertTitle>
          <AlertDescription>
            This can take up to a minute. Keep this tab open until it finishes.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={busy} type="submit">
          {pending === 'profile' ? (
            <>
              <Spinner label="Generating profile" />
              Generating profile…
            </>
          ) : (
            'Generate business profile'
          )}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            if (validate()) {
              void onRunFullSetup(values);
            }
          }}
          type="button"
          variant="outline"
        >
          {pending === 'setup' ? (
            <>
              <Spinner label="Running full setup" />
              Generating complete setup…
            </>
          ) : (
            'Generate complete setup'
          )}
        </Button>
      </div>
    </form>
  );
}
