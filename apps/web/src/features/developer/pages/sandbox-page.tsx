import { useState, type FormEvent } from 'react';
import type {
  PublicApiSessionResponse,
  PublicApiUsageSummaryResponse,
  VerifyWebhookSignatureResponse,
  WebhookSubscriptionListResponse,
} from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { env } from '@/utils/env';
import { developerApi } from '../api';

export function DeveloperSandboxPage() {
  const { organizationId } = useWorkspace();
  const session = useApiQuery<PublicApiSessionResponse>({
    queryKey: queryKeys.developer.session(organizationId),
    path: `/api/v1/organizations/${organizationId}`,
  });
  const usage = useApiQuery<PublicApiUsageSummaryResponse>({
    queryKey: queryKeys.developer.usage(organizationId),
    path: `/api/organizations/${organizationId}/api-usage`,
  });
  const hooks = useApiQuery<WebhookSubscriptionListResponse>({
    queryKey: queryKeys.developer.webhooks(organizationId),
    path: `/api/organizations/${organizationId}/webhooks`,
  });
  const [webhookId, setWebhookId] = useState('');
  const [result, setResult] = useState<VerifyWebhookSignatureResponse | undefined>();
  const verify = useApiMutation({
    mutationFn: (input: { signatureHeader: string; body: string }) =>
      developerApi.verifySignature(organizationId, webhookId, input.signatureHeader, input.body),
    errorMessage: 'Signature check failed',
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Session probe</CardTitle>
          <CardDescription>Calls GET /api/v1/organizations/:id with the dashboard session.</CardDescription>
        </CardHeader>
        <CardContent>
          {session.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : session.isError ? (
            <QueryErrorAlert message={session.error.message} onRetry={() => void session.refetch()} title="Public API session failed" />
          ) : (
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(session.data, null, 2)}</pre>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Base URL {env.publicApiUrl || '(same origin)'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : usage.isError ? (
            <QueryErrorAlert message={usage.error.message} onRetry={() => void usage.refetch()} title="Unable to load API usage" />
          ) : (
            <p className="text-sm">
              {String(usage.data.totalRequests)} requests · {String(usage.data.errorCount)} errors · avg{' '}
              {String(Math.round(usage.data.averageDurationMs))}ms
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Webhook signature sandbox</CardTitle>
          <CardDescription>Verify a captured Stripe-style signature header against a stored webhook secret.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              void verify
                .mutateAsync({
                  signatureHeader: (form.elements.namedItem('signatureHeader') as HTMLInputElement).value,
                  body: (form.elements.namedItem('body') as HTMLTextAreaElement).value,
                })
                .then(setResult);
            }}
          >
            <Field id="sandbox-hook" label="Webhook">
              <Select
                onValueChange={setWebhookId}
                options={(hooks.data?.items ?? []).map((item) => ({ value: item.id, label: item.url }))}
                placeholder="Select a webhook"
                value={webhookId}
              />
            </Field>
            <Field id="sandbox-sig" label="Signature header">
              <Input name="signatureHeader" placeholder="t=...,v1=..." />
            </Field>
            <Field id="sandbox-body" label="Raw body">
              <Textarea className="font-mono text-xs" name="body" rows={6} />
            </Field>
            <Button disabled={!webhookId || verify.isPending} type="submit">
              Verify
            </Button>
          </form>
          {result ? (
            <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
