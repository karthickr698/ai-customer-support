import type { KnowledgeSourceBriefDto, KnowledgeSourceType, RunOnboardingSetupRequest } from '@ai-customer-support/contracts';

export const ORGANIZATION_NAME_MAX = 80;
export const DESCRIPTION_MAX = 8000;
export const COMPANY_NAME_MAX = 200;
export const INDUSTRY_MAX = 200;
export const EXTRA_NOTES_MAX = 4000;
export const SOURCE_NAME_MAX = 200;

export function validateOrganizationName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Organization name is required';
  }
  if (trimmed.length > ORGANIZATION_NAME_MAX) {
    return `Name must be at most ${String(ORGANIZATION_NAME_MAX)} characters`;
  }
  return undefined;
}

export function validateDescription(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Describe your business so we can generate a profile';
  }
  if (trimmed.length > DESCRIPTION_MAX) {
    return `Description must be at most ${String(DESCRIPTION_MAX)} characters`;
  }
  return undefined;
}

export function validateOptionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Enter a valid http or https URL';
    }
  } catch {
    return 'Enter a valid URL';
  }
  if (trimmed.length > 2000) {
    return 'URL must be at most 2000 characters';
  }
  return undefined;
}

export function validateOptionalMax(value: string, max: number, label: string): string | undefined {
  if (value.trim().length > max) {
    return `${label} must be at most ${String(max)} characters`;
  }
  return undefined;
}

export function validateKnowledgeSource(input: {
  readonly type: KnowledgeSourceType;
  readonly name: string;
  readonly url: string;
  readonly description: string;
}): { name?: string; url?: string; description?: string } | undefined {
  const name = input.name.trim();
  const errors: { name?: string; url?: string; description?: string } = {};

  if (name.length === 0) {
    errors.name = 'Name is required';
  } else if (name.length > SOURCE_NAME_MAX) {
    errors.name = `Name must be at most ${String(SOURCE_NAME_MAX)} characters`;
  }

  const urlError = validateOptionalUrl(input.url);
  if (urlError) {
    errors.url = urlError;
  } else if ((input.type === 'url' || input.type === 'help_center' || input.type === 'sitemap') && input.url.trim().length === 0) {
    errors.url = 'URL is required for this source type';
  }

  if (input.type === 'text' && input.description.trim().length === 0) {
    errors.description = 'Add the text content or a short description';
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

export function toOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function knowledgeSourcePayload(input: {
  readonly type: KnowledgeSourceType;
  readonly name: string;
  readonly url: string;
  readonly description: string;
}): KnowledgeSourceBriefDto {
  return {
    type: input.type,
    name: input.name.trim(),
    url: toOptional(input.url),
    description: toOptional(input.description),
  };
}

export type BriefValues = {
  readonly companyName: string;
  readonly industry: string;
  readonly websiteUrl: string;
  readonly description: string;
  readonly extraNotes: string;
};

export function briefToSetupRequest(
  values: BriefValues,
  extras?: { readonly knowledgeSources?: readonly KnowledgeSourceBriefDto[] },
): RunOnboardingSetupRequest {
  return {
    description: values.description.trim(),
    companyName: toOptional(values.companyName),
    industry: toOptional(values.industry),
    websiteUrl: toOptional(values.websiteUrl),
    extraNotes: toOptional(values.extraNotes),
    knowledgeSources: extras?.knowledgeSources,
  };
}
