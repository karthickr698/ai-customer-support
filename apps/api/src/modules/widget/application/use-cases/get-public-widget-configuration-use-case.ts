import { WidgetNotFoundError, WidgetDisabledError } from '../../domain/errors.js';
import { WidgetPolicy } from '../../domain/widget-policy.js';
import { toPublicWidgetConfigurationDto } from '../dtos.js';
import type { WidgetConfigurationRepository } from '../ports/widget-configuration-repository.js';

export class GetPublicWidgetConfigurationUseCase {
  constructor(private readonly widgets: WidgetConfigurationRepository) {}

  async execute(input: { readonly publicKey: string; readonly origin?: string }) {
    const widget = await this.widgets.findByPublicKey(input.publicKey);
    if (!widget) {
      throw new WidgetNotFoundError();
    }

    WidgetPolicy.assertOriginAllowed(widget.allowedOrigins, input.origin);
    return { widget: toPublicWidgetConfigurationDto(widget) };
  }
}

export class RequireEnabledWidgetService {
  constructor(private readonly widgets: WidgetConfigurationRepository) {}

  async execute(publicKey: string, origin: string | undefined) {
    const widget = await this.widgets.findByPublicKey(publicKey);
    if (!widget) {
      throw new WidgetNotFoundError();
    }

    WidgetPolicy.assertOriginAllowed(widget.allowedOrigins, origin);
    if (!widget.enabled) {
      throw new WidgetDisabledError();
    }

    return widget;
  }
}
