import { CustomerContact } from '../../domain/customer-contact.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';

export class IdentifyWidgetVisitorUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly email: string;
    readonly name: string;
  }): Promise<void> {
    const now = this.clock.now();
    const customer = CustomerContact.parse({ email: input.email, name: input.name });
    const result = await this.conversations.search(
      { tenantId: input.tenantId, widgetSessionId: input.sessionId },
      { page: 1, pageSize: 100 },
    );

    for (const conversation of result.items) {
      if (!conversation.belongsTo(input.tenantId)) {
        continue;
      }

      conversation.identifyCustomer(customer, now);
      await this.conversations.save(conversation);
    }
  }
}
