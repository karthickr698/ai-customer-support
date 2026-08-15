import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OrganizationResponse } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useApiMutation } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { organizationsApi } from '../api';
import { validateOrganizationName } from '../validation';
import { workspacePath } from '../workspace-paths';

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();

  const create = useApiMutation({
    mutationFn: organizationsApi.create,
    invalidateKeys: [queryKeys.organizations.all()],
    successMessage: 'Workspace created',
    onSuccess: (result: OrganizationResponse) => {
      onOpenChange(false);
      setName('');
      void navigate(workspacePath(result.organization.id, 'onboarding'));
    },
  });

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const error = validateOrganizationName(name);
    setNameError(error);
    if (error) {
      return;
    }
    await create.mutateAsync({ name: name.trim() });
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName('');
          setNameError(undefined);
        }
      }}
      open={open}
    >
      <DialogContent>
        <form noValidate onSubmit={(event) => void onCreate(event)}>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              You become the owner and continue into AI setup. Invite teammates after the workspace exists.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Field error={nameError} id="switcher-workspace-name" label="Workspace name" required>
              <Input
                id="switcher-workspace-name"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(undefined);
                }}
                placeholder="Acme Support"
                value={name}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? (
                <>
                  <Spinner label="Creating workspace" />
                  Creating…
                </>
              ) : (
                'Create and set up'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
