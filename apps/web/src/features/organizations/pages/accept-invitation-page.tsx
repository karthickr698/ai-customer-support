import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { InvitationPreviewResponse, OrganizationResponse } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/features/identity/auth-store';
import { AuthAlert } from '@/features/identity/components/auth-alert';
import { AuthLayout } from '@/features/identity/components/auth-layout';
import { SessionLoading } from '@/features/identity/components/session-loading';
import { loginPathWithNext } from '@/features/identity/safe-next-path';
import { roleLabel } from '@/features/organizations/permissions';
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
    return <SessionLoading />;
  }

  if (acceptedId) {
    const role = accept.data?.organization.membership.role;
    const destination =
      role === 'owner' || role === 'admin'
        ? `/organizations/${acceptedId}/onboarding`
        : `/organizations/${acceptedId}`;
    return <Navigate replace to={destination} />;
  }

  if (!user) {
    const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
    return <Navigate replace to={loginPathWithNext(next)} />;
  }

  if (!token) {
    return (
      <AuthLayout description="This invitation link is missing a token." title="Organization invitation">
        <AuthAlert message="Ask your admin to send a new invite." title="Invalid invitation" />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link className="text-primary hover:underline" to="/organizations">
            Back to organizations
          </Link>
        </p>
      </AuthLayout>
    );
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
          ? `Join ${invitation.organizationName} as ${roleLabel(invitation.role)}. Sign in with ${invitation.email}.`
          : 'Review and accept your team invitation.'
      }
      title="Organization invitation"
    >
      {preview.isLoading ? <Skeleton className="h-16 w-full" /> : null}
      <AuthAlert message={error} title="Invitation error" />
      <Button
        className="w-full"
        disabled={!token || accept.isPending || !invitation}
        onClick={() => accept.mutate()}
        type="button"
      >
        {accept.isPending ? (
          <>
            <Spinner label="Joining organization" />
            Joining…
          </>
        ) : (
          'Accept invitation'
        )}
      </Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link className="text-primary hover:underline" to="/organizations">
          Back to organizations
        </Link>
      </p>
    </AuthLayout>
  );
}
