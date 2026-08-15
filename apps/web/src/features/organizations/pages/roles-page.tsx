import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '../components/workspace-page';
import { permissionLabel, roleDescription, roleLabel } from '../permissions';
import { PERMISSION_GROUPS, ROLE_ORDER, roleHasPermission } from '../role-permissions';
import { useWorkspace } from '../workspace-context';

export function RolesPage() {
  const { organization } = useWorkspace();
  const currentRole = organization.membership.role;

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Roles are fixed for every workspace. Permissions are derived from role — custom roles are not supported."
        title="Roles & permissions"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {ROLE_ORDER.map((role) => {
          const isCurrent = role === currentRole;
          return (
            <Card className={cn(isCurrent && 'ring-2 ring-ring/40')} key={role}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{roleLabel(role)}</CardTitle>
                  {isCurrent ? <Badge>Your role</Badge> : null}
                </div>
                <CardDescription>{roleDescription(role)}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission matrix</CardTitle>
          <CardDescription>
            Owner has every permission. Admin has all except deleting the workspace. Agents and viewers are limited to
            day-to-day support work.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">{group.label}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Permission</TableHead>
                    {ROLE_ORDER.map((role) => (
                      <TableHead className="text-center" key={role}>
                        {roleLabel(role)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.permissions.map((permission) => (
                    <TableRow key={permission}>
                      <TableCell>
                        <p className="font-medium">{permissionLabel(permission)}</p>
                        <p className="text-xs text-muted-foreground">{permission}</p>
                      </TableCell>
                      {ROLE_ORDER.map((role) => {
                        const allowed = roleHasPermission(role, permission);
                        return (
                          <TableCell className="text-center" key={`${role}-${permission}`}>
                            {allowed ? (
                              <Check
                                aria-label={`${roleLabel(role)} can ${permissionLabel(permission)}`}
                                className="mx-auto size-4 text-success"
                              />
                            ) : (
                              <span className="text-muted-foreground" aria-label={`${roleLabel(role)} cannot ${permissionLabel(permission)}`}>
                                —
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
