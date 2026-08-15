import type { AgentPreviewModel } from '../wizard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import { StringList } from './onboarding-stepper';

export function AgentPreview({
  preview,
  generating,
}: {
  readonly preview: AgentPreviewModel;
  readonly generating?: boolean;
}) {
  if (!preview.ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live agent preview</CardTitle>
          <CardDescription>Greeting, tone, and guardrails appear here as you set up the assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            description="Describe the business to start a draft. Choosing a support tone fills in the first reply."
            title="Preview waiting"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live agent preview</CardTitle>
        <CardDescription>
          {generating
            ? 'Updating the assistant from the latest step…'
            : 'This is how the first customer conversation will look.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{preview.assistantName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[preview.toneName, preview.language].filter(Boolean).join(' · ') || 'Support chat'}
              </p>
            </div>
            <Badge variant="secondary">{preview.handoffToHuman ? 'Human handoff on' : 'AI only'}</Badge>
          </div>
          <div className="space-y-3 bg-muted/40 p-4">
            <PreviewBubble align="agent" label={preview.assistantName}>
              {preview.greeting}
            </PreviewBubble>
            {preview.exampleReply ? (
              <>
                <PreviewBubble align="customer" label="Customer">
                  Hi, I have a question about my account.
                </PreviewBubble>
                <PreviewBubble align="agent" label={preview.assistantName}>
                  {preview.exampleReply}
                </PreviewBubble>
              </>
            ) : null}
            {preview.signature ? (
              <p className="text-center text-[11px] text-muted-foreground">{preview.signature}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {preview.collectContactInfo ? <Badge variant="outline">Collects contact</Badge> : null}
            {preview.maxAutonomyTurns ? (
              <Badge variant="outline">{`${String(preview.maxAutonomyTurns)} autonomy turns`}</Badge>
            ) : null}
            {preview.sourceCount > 0 ? (
              <Badge variant="outline">
                {preview.sourceCount === 1 ? '1 knowledge source' : `${String(preview.sourceCount)} knowledge sources`}
              </Badge>
            ) : (
              <Badge variant="outline">No knowledge sources yet</Badge>
            )}
          </div>
          <Separator />
          <div className="space-y-3">
            <PreviewList label="Answers about" items={preview.allowedTopics} />
            <PreviewList label="Escalates when" items={preview.escalateWhen} />
            {preview.forbiddenTopics.length > 0 ? (
              <PreviewList label="Will not discuss" items={preview.forbiddenTopics} />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewBubble({
  align,
  label,
  children,
}: {
  readonly align: 'agent' | 'customer';
  readonly label: string;
  readonly children: string;
}) {
  const isCustomer = align === 'customer';

  return (
    <div className={isCustomer ? 'ml-8' : 'mr-8'}>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      <div
        className={
          isCustomer
            ? 'rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground'
            : 'rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2 text-sm leading-6'
        }
      >
        {children}
      </div>
    </div>
  );
}

function PreviewList({ label, items }: { readonly label: string; readonly items: readonly string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <StringList empty="None yet" items={items} />
    </div>
  );
}
