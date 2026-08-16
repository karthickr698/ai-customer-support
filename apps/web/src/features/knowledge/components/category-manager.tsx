import { type FormEvent, useState } from 'react';
import type { KnowledgeCategoryDto } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { knowledgeApi } from '../api';

type CategoryManagerProps = {
  readonly organizationId: string;
  readonly categories: readonly KnowledgeCategoryDto[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canManage: boolean;
};

export function CategoryManager({
  organizationId,
  categories,
  open,
  onOpenChange,
  canManage,
}: CategoryManagerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const invalidate = [queryKeys.knowledge.categories(organizationId), queryKeys.knowledge.all()];

  const create = useApiMutation({
    mutationFn: () => knowledgeApi.createCategory(organizationId, { name, description: description || undefined }),
    invalidateKeys: invalidate,
    successMessage: 'Category created',
  });
  const update = useApiMutation({
    mutationFn: () =>
      knowledgeApi.updateCategory(organizationId, editingId ?? '', {
        name: editName,
        description: editDescription || null,
      }),
    invalidateKeys: invalidate,
    successMessage: 'Category updated',
  });
  const remove = useApiMutation({
    mutationFn: (categoryId: string) => knowledgeApi.deleteCategory(organizationId, categoryId),
    invalidateKeys: invalidate,
    successMessage: 'Category deleted',
  });

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await create.mutateAsync();
    setName('');
    setDescription('');
  }

  async function onSaveEdit(): Promise<void> {
    await update.mutateAsync();
    setEditingId(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Group articles so agents and search can find them faster.</DialogDescription>
        </DialogHeader>

        {categories.length === 0 ? (
          <EmptyState description="Create a category such as Billing, Shipping, or Account." title="No categories yet" />
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {categories.map((category) => (
              <li className="rounded-lg border border-border px-3 py-2" key={category.id}>
                {editingId === category.id ? (
                  <div className="flex flex-col gap-2">
                    <Input onChange={(event) => setEditName(event.target.value)} value={editName} />
                    <Textarea
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={2}
                      value={editDescription}
                    />
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => setEditingId(undefined)} size="sm" type="button" variant="ghost">
                        Cancel
                      </Button>
                      <Button disabled={update.isPending} onClick={() => void onSaveEdit()} size="sm" type="button">
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.articleCount === 1 ? '1 article' : `${String(category.articleCount)} articles`}
                        {category.description ? ` · ${category.description}` : ''}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          onClick={() => {
                            setEditingId(category.id);
                            setEditName(category.name);
                            setEditDescription(category.description ?? '');
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => remove.mutate(category.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={onCreate}>
            <Field id="category-name" label="New category" required>
              <Input id="category-name" onChange={(event) => setName(event.target.value)} required value={name} />
            </Field>
            <Field id="category-description" label="Description">
              <Textarea
                id="category-description"
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                value={description}
              />
            </Field>
            <DialogFooter>
              <Button disabled={create.isPending} type="submit">
                Add category
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
