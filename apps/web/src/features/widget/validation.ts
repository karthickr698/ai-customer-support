import type { WidgetConfigurationDto, WidgetPosition } from '@ai-customer-support/contracts';

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type WidgetFormValues = {
  enabled: boolean;
  title: string;
  greeting: string;
  primaryColor: string;
  position: WidgetPosition;
  launcherText: string;
  collectEmail: boolean;
  allowAnonymous: boolean;
  allowAttachments: boolean;
  aiEnabled: boolean;
  offlineMessage: string;
  allowedOriginsText: string;
};

export type WidgetFormErrors = Partial<Record<keyof WidgetFormValues, string>>;

export function widgetToForm(widget: WidgetConfigurationDto): WidgetFormValues {
  return {
    enabled: widget.enabled,
    title: widget.title,
    greeting: widget.greeting,
    primaryColor: widget.primaryColor,
    position: widget.position,
    launcherText: widget.launcherText,
    collectEmail: widget.collectEmail,
    allowAnonymous: widget.allowAnonymous,
    allowAttachments: widget.allowAttachments,
    aiEnabled: widget.aiEnabled,
    offlineMessage: widget.offlineMessage,
    allowedOriginsText: widget.allowedOrigins.join('\n'),
  };
}

export function validateWidgetForm(values: WidgetFormValues): WidgetFormErrors {
  const errors: WidgetFormErrors = {};
  if (values.title.trim().length < 1 || values.title.trim().length > 80) {
    errors.title = 'Title must be between 1 and 80 characters';
  }
  if (values.greeting.trim().length < 1 || values.greeting.trim().length > 280) {
    errors.greeting = 'Greeting must be between 1 and 280 characters';
  }
  if (!COLOR_PATTERN.test(values.primaryColor.trim())) {
    errors.primaryColor = 'Use a hex color such as #2563eb';
  }
  if (values.launcherText.trim().length < 1 || values.launcherText.trim().length > 40) {
    errors.launcherText = 'Launcher text must be between 1 and 40 characters';
  }
  if (values.offlineMessage.trim().length < 1 || values.offlineMessage.trim().length > 280) {
    errors.offlineMessage = 'Offline message must be between 1 and 280 characters';
  }
  if (!values.allowAnonymous && !values.collectEmail) {
    errors.allowAnonymous = 'Collect email when anonymous chats are disabled';
  }

  const originError = validateOrigins(values.allowedOriginsText);
  if (originError) {
    errors.allowedOriginsText = originError;
  }

  return errors;
}

export function parseOrigins(value: string): string[] {
  return [...new Set(value.split(/\n+/).map((line) => line.trim()).filter(Boolean))];
}

function validateOrigins(value: string): string | undefined {
  const origins = parseOrigins(value);
  if (origins.length > 50) {
    return 'A widget can allow at most 50 origins';
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Origins must start with http or https';
      }
    } catch {
      return `"${origin}" is not a valid origin URL`;
    }
  }

  return undefined;
}
