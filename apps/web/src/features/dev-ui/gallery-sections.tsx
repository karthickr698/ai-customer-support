import { Inbox } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { healthApi } from '@/services/health-api';
import { queryKeys } from '@/services/query-keys';
import type { LivenessStatus } from '@/types/api';
import { ThemeCustomizer } from '@/components/theme/theme-customizer';

const TEAM_OPTIONS = [
  { value: 'inbox', label: 'Inbox', description: 'Unassigned customer conversations' },
  { value: 'billing', label: 'Billing', description: 'Payments, invoices, and refunds' },
  { value: 'tech', label: 'Technical', description: 'Product bugs and how-to questions' },
  { value: 'vip', label: 'VIP', description: 'Priority accounts' },
] as const;

function GallerySection({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ThemeSection() {
  return (
    <GallerySection
      id="theme"
      title="Theme"
      description="Primary color, secondary color, font, and skin are stored locally and applied to the whole app."
    >
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Changes take effect immediately across every global component.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeCustomizer />
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function TypographySection() {
  return (
    <GallerySection id="typography" title="Typography" description="Heading and body sizes used across the product.">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <h1>The quick customer conversation</h1>
            <h2>Ticket assigned to a human agent</h2>
            <h3>Knowledge article heading</h3>
            <h4>Sidebar section label</h4>
            <p>
              Body copy uses 15px with relaxed line height so support transcripts, forms, and settings stay readable.
              Muted helper text sits one step smaller.
            </p>
            <p className="text-sm text-muted-foreground">Helper / meta text · 13–14px · muted foreground</p>
            <p className="text-xs text-muted-foreground">Fine print and validation messages</p>
          </div>
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function ButtonsSection() {
  return (
    <GallerySection id="buttons" title="Buttons" description="Primary actions, secondary actions, and compact controls.">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function FormsSection() {
  const [team, setTeam] = useState('inbox');
  const [queues, setQueues] = useState<string[]>(['billing', 'tech']);
  const [channel, setChannel] = useState('email');

  return (
    <GallerySection
      id="forms"
      title="Forms"
      description="Inputs, textareas, and dropdowns. Dropdowns always use the searchable multi-select pattern — never a native select."
    >
      <Card>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
          <Field id="customer-name" label="Customer name" hint="Shown on the conversation header." required>
            <Input id="customer-name" placeholder="Jordan Lee" />
          </Field>
          <Field id="email" label="Email" error="Enter a valid email address.">
            <Input id="email" type="email" placeholder="jordan@example.com" aria-invalid />
          </Field>
          <Field id="team" label="Assignee team">
            <Select
              id="team"
              value={team}
              options={TEAM_OPTIONS}
              placeholder="Choose a team"
              onValueChange={setTeam}
            />
          </Field>
          <Field id="queues" label="Queues" hint="Multi-select with chips, search, and select all.">
            <Select
              id="queues"
              multiple
              value={queues}
              options={TEAM_OPTIONS}
              placeholder="Choose queues"
              onValueChange={setQueues}
            />
          </Field>
          <Field id="notes" label="Internal note" className="md:col-span-2">
            <Textarea id="notes" placeholder="Add context for the next agent…" />
          </Field>
          <div className="flex items-center gap-3">
            <Checkbox id="notify" defaultChecked />
            <Label htmlFor="notify">Notify the customer</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ai-assist" defaultChecked />
            <Label htmlFor="ai-assist">AI drafting</Label>
          </div>
          <Field label="Channel" className="md:col-span-2">
            <RadioGroup value={channel} onValueChange={setChannel} className="flex flex-wrap gap-4">
              {['email', 'chat', 'whatsapp'].map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem id={`channel-${value}`} value={value} />
                  <Label htmlFor={`channel-${value}`} className="capitalize">
                    {value}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function FeedbackSection() {
  return (
    <GallerySection id="feedback" title="Feedback" description="Status, loading, empty, and toast patterns.">
      <div className="grid gap-4">
        <Alert variant="info">
          <AlertTitle>AI draft ready</AlertTitle>
          <AlertDescription>Review the suggested reply before it is sent to the customer.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Ticket resolved</AlertTitle>
          <AlertDescription>The conversation was closed and the customer was notified.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>SLA at risk</AlertTitle>
          <AlertDescription>This conversation will breach first-response SLA in 8 minutes.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Could not send</AlertTitle>
          <AlertDescription>The messaging provider rejected the outbound message.</AlertDescription>
        </Alert>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Resolved</Badge>
          <Badge variant="warning">Waiting</Badge>
          <Badge variant="destructive">Urgent</Badge>
        </div>
        <div className="flex items-center gap-4">
          <Spinner />
          <Progress value={64} className="max-w-xs" />
          <Skeleton className="h-9 w-40" />
        </div>
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="No conversations yet"
          description="New customer messages will show up here. Connect a channel to get started."
          action={
            <Button size="sm" variant="outline">
              Connect a channel
            </Button>
          }
        />
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              toast.success('Reply queued', { description: 'The customer will receive this in a few seconds.' });
            }}
          >
            Show toast
          </Button>
        </div>
      </div>
    </GallerySection>
  );
}

export function DataSection() {
  const [page, setPage] = useState(1);

  return (
    <GallerySection id="data" title="Data display" description="Tables, avatars, tabs, and pagination.">
      <Card>
        <CardHeader>
          <CardTitle>Open tickets</CardTitle>
          <CardDescription>Example table using the shared density and type scale.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <TabsContent value="open">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback>JL</AvatarFallback>
                        </Avatar>
                        Jordan Lee
                      </div>
                    </TableCell>
                    <TableCell>Refund for order #1842</TableCell>
                    <TableCell>
                      <Badge variant="warning">Waiting</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback>AM</AvatarFallback>
                        </Avatar>
                        Alex Morgan
                      </div>
                    </TableCell>
                    <TableCell>Cannot reset password</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Open</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="pending">
              <p className="text-sm text-muted-foreground">No pending tickets in this demo dataset.</p>
            </TabsContent>
            <TabsContent value="closed">
              <p className="text-sm text-muted-foreground">Closed tickets would be listed here.</p>
            </TabsContent>
          </Tabs>
          <Separator />
          <Pagination page={page} pageCount={4} onPageChange={setPage} />
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function OverlaysSection() {
  return (
    <GallerySection id="overlays" title="Overlays" description="Dialogs and tooltips for confirmations and extra context.">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Escalate conversation</DialogTitle>
                <DialogDescription>
                  This hands the thread to a human agent and pauses AI replies.
                </DialogDescription>
              </DialogHeader>
              <Field id="reason" label="Reason">
                <Select
                  id="reason"
                  options={[
                    { value: 'angry', label: 'Customer is upset' },
                    { value: 'policy', label: 'Policy exception needed' },
                    { value: 'bug', label: 'Product defect' },
                  ]}
                  placeholder="Choose a reason"
                />
              </Field>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Escalate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Shortcut: E</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    </GallerySection>
  );
}

export function ApiSection() {
  const live = useApiQuery<LivenessStatus>({
    queryKey: queryKeys.health.live(),
    path: '/health',
  });

  const ping = useApiMutation<LivenessStatus, void>({
    mutationFn: () => healthApi.live(),
    successMessage: 'API reached',
    invalidateKeys: [queryKeys.health.all()],
  });

  return (
    <GallerySection
      id="api"
      title="API client"
      description="React Query + Axios. Tenant and auth headers are attached globally; errors map to ApiError."
    >
      <Card>
        <CardHeader>
          <CardTitle>Health check</CardTitle>
          <CardDescription>
            GET /health through the shared client. Start the API to see a live response.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {live.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Checking API…
            </div>
          ) : null}
          {live.isSuccess ? (
            <Alert variant="success">
              <AlertTitle>API is reachable</AlertTitle>
              <AlertDescription>Liveness status: {live.data.status}</AlertDescription>
            </Alert>
          ) : null}
          {live.isError ? (
            <Alert variant="destructive">
              <AlertTitle>API is unreachable</AlertTitle>
              <AlertDescription>{live.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => void live.refetch()}>
            Refetch
          </Button>
          <Button
            type="button"
            onClick={() => {
              ping.mutate();
            }}
            disabled={ping.isPending}
          >
            {ping.isPending ? 'Pinging…' : 'Ping with mutation'}
          </Button>
        </CardFooter>
      </Card>
    </GallerySection>
  );
}
