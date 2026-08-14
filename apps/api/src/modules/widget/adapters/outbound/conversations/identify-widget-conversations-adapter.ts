import type { IdentifiedConversationPort } from '../../../application/ports/security-ports.js';
import type { IdentifyWidgetVisitorUseCase } from '../../../../conversations/application/use-cases/identify-widget-visitor-use-case.js';

export class IdentifyWidgetConversationsAdapter implements IdentifiedConversationPort {
  constructor(private readonly identify: IdentifyWidgetVisitorUseCase) {}

  async identifySessionConversations(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly email: string;
    readonly name: string;
  }): Promise<void> {
    await this.identify.execute(input);
  }
}
