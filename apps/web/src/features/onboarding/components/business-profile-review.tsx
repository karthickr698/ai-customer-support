import type { BusinessProfileDto } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Definition, StringList } from './onboarding-stepper';

export function BusinessProfileReview({
  profile,
  pending,
  embedded,
  onContinue,
  onBack,
}: {
  readonly profile: BusinessProfileDto;
  readonly pending?: boolean;
  readonly embedded?: boolean;
  readonly onContinue?: () => void;
  readonly onBack?: () => void;
}) {
  const details = (
    <div className="space-y-5">
      {embedded ? (
        <div className="space-y-1">
          <p className="font-medium">{profile.companyName}</p>
          <p className="text-xs text-muted-foreground">
            {profile.industry}
            {profile.websiteUrl ? ` · ${profile.websiteUrl}` : ''}
          </p>
        </div>
      ) : null}
      <p className="text-sm leading-6">{profile.description}</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Definition label="Audience">{profile.targetAudience}</Definition>
        <Definition label="Hours">{profile.hoursOfOperation ?? 'Not specified'}</Definition>
        <Definition label="Products and services">
          <StringList items={profile.productsAndServices} />
        </Definition>
        <Definition label="Support channels">
          <StringList items={profile.supportChannels} />
        </Definition>
        <Definition label="Common intents">
          <StringList items={profile.commonIntents} />
        </Definition>
        <Definition label="Escalation topics">
          <StringList items={profile.escalationTopics} />
        </Definition>
        <Definition label="Brand values">
          <StringList items={profile.brandValues} />
        </Definition>
        <Definition label="Languages">
          <StringList items={profile.languages} />
        </Definition>
      </dl>
      {onContinue || onBack ? (
        <div className="flex flex-wrap gap-2">
          {onBack ? (
            <Button onClick={onBack} type="button" variant="outline">
              Edit brief
            </Button>
          ) : null}
          {onContinue ? (
            <Button disabled={pending} onClick={onContinue} type="button">
              {pending ? (
                <>
                  <Spinner label="Generating tones" />
                  Generating tones…
                </>
              ) : (
                'Looks good — pick a tone'
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return details;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.companyName}</CardTitle>
        <CardDescription>
          {profile.industry}
          {profile.websiteUrl ? ` · ${profile.websiteUrl}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>{details}</CardContent>
    </Card>
  );
}
