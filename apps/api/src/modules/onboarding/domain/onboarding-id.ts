export type OnboardingId = string & { readonly __brand: 'OnboardingId' };

export function createOnboardingId(id: string = crypto.randomUUID()): OnboardingId {
  return id as OnboardingId;
}
