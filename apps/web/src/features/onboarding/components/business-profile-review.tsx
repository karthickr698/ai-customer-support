import type { BusinessProfileDto } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Definition, StringList } from './onboarding-stepper';

export function BusinessProfileReview({
  profile,
  pending,
  onContinue,
  onBack,
}: {
  readonly profile: BusinessProfileDto;
  readonly pending?: boolean;
  readonly onContinue?: () => void;
  readonly onBack?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.companyName}</CardTitle>
        <CardDescription>
          {profile.industry}
          {profile.websiteUrl ? ` · ${profile.websiteUrl}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
                Back
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
                  'Generate support tones'
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
