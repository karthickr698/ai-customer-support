export function workspacePath(organizationId: string, segment = 'inbox'): string {
  return `/organizations/${organizationId}/${segment}`;
}

export function switchWorkspacePath(pathname: string, fromOrganizationId: string, toOrganizationId: string): string {
  const prefix = `/organizations/${fromOrganizationId}`;
  if (!pathname.startsWith(prefix)) {
    return workspacePath(toOrganizationId);
  }

  const remainder = pathname.slice(prefix.length);
  if (remainder === '' || remainder === '/') {
    return workspacePath(toOrganizationId);
  }

  return `/organizations/${toOrganizationId}${remainder}`;
}
