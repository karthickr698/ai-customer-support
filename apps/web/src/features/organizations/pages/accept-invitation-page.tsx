import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { InvitationPreviewResponse, OrganizationResponse } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/identity/auth-store';
import { AuthLayout, FieldError } from '@/features/identity/components/auth-layout';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { useSessionStore } from '@/stores/session-store';
import { organizationsApi } from '../api';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setTenantId = useSessionStore((state) => state.setTenantId);
  const [acceptedId, setAcceptedId] = useState<string>();

  const preview = useApiQuery<InvitationPreviewResponse>({
    queryKey: [...queryKeys.organizations.all(), 'invitation', token],
    path: `/api/invitations/${encodeURIComponent(token)}`,
    enabled: token.length > 0,
  });

  const accept = useApiMutation<OrganizationResponse, void>({
    mutationFn: () => organizationsApi.acceptInvitation(token),
    successMessage: 'You joined the organization',
    onSuccess: (result) => {
      setTenantId(result.organization.id);
      setAcceptedId(result.organization.id);
    },
  });

  if (status === 'idle' || status === 'loading') {
    return <p className="p-8 text-sm text-muted-foreground">Checking session…</p>;
  }

  if (acceptedId) {
    return <Navigate replace to={`/organizations/${acceptedId}`} />;
  }

  if (!user) {
    const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
    return <Navigate replace to={`/login?next=${encodeURIComponent(next)}`} />;
  }

  const invitation = preview.data?.invitation;
  const error =
    preview.error instanceof ApiError
      ? preview.error.message
      : accept.error instanceof ApiError
        ? accept.error.message
        : undefined;

  return (
    <AuthLayout
      description={
        invitation
          ? `Join ${invitation.organizationName} as ${invitation.role}. Sign in with ${invitation.email}.`
          : 'Review and accept your team invitation.'
      }
      title="Organization invitation"
    >
      <FieldError message={error} />
      <Button className="w-full" disabled={!token || accept.isPending || !invitation} onClick={() => accept.mutate()} type="button">
        {accept.isPending ? 'Joining…' : 'Accept invitation'}
      </Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link className="text-primary hover:underline" to="/organizations">
          Back to organizations
        </Link>
      </p>
    </AuthLayout>
  );
}
