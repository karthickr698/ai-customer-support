import type { KnowledgeArticleVersionDto } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { articleStatusLabel, formatKnowledgeDate } from '../labels';

type VersionHistoryProps = {
  readonly versions: readonly KnowledgeArticleVersionDto[];
  readonly currentVersion: number;
  readonly canManage: boolean;
  readonly pending?: boolean;
  readonly onRestore: (version: number) => void;
  readonly onPreview: (version: KnowledgeArticleVersionDto) => void;
};

export function VersionHistory({
  versions,
  currentVersion,
  canManage,
  pending,
  onRestore,
  onPreview,
}: VersionHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
        <CardDescription>Every save creates a snapshot. Restore copies that version into the editor.</CardDescription>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <EmptyState description="Save the article to start a history." title="No versions yet" />
        ) : (
          <ScrollArea className="h-80">
            <ol className="space-y-3 pr-3">
              {versions.map((version) => {
                const current = version.version === currentVersion;
                return (
                  <li className="rounded-lg border border-border p-3" key={version.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          v{version.version}
                          {current ? ' · current' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {articleStatusLabel(version.status)} · {formatKnowledgeDate(version.createdAt)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm">{version.title}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button onClick={() => onPreview(version)} size="sm" type="button" variant="ghost">
                        View
                      </Button>
                      {canManage && !current ? (
                        <Button
                          disabled={pending}
                          onClick={() => onRestore(version.version)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Restore
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
