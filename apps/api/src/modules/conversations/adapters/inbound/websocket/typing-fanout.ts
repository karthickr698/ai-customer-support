import type {
  RealtimeEphemeralFanout,
  RealtimeEphemeralPublisherPort,
} from '../../../application/ports/realtime-publisher-port.js';
import type { TypingActorType } from '@ai-customer-support/contracts';
import { TYPING_IDLE_MS } from '../../../domain/support-constants.js';

type TypingKey = string;

export class TypingFanout {
  private readonly timers = new Map<TypingKey, NodeJS.Timeout>();

  constructor(private readonly publisher: RealtimeEphemeralPublisherPort) {}

  async start(input: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly actorId: string;
    readonly actorType: TypingActorType;
    readonly displayName: string;
  }): Promise<void> {
    await this.publish({ type: 'typing', ...input, active: true, senderId: input.actorId });
    this.armStop(input);
  }

  async stop(input: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly actorId: string;
    readonly actorType: TypingActorType;
    readonly displayName: string;
  }): Promise<void> {
    this.clear(keyOf(input));
    await this.publish({ type: 'typing', ...input, active: false, senderId: input.actorId });
  }

  async clearActor(input: {
    readonly tenantId: string;
    readonly conversationId: string | undefined;
    readonly actorId: string;
    readonly actorType: TypingActorType;
    readonly displayName: string;
  }): Promise<void> {
    if (!input.conversationId) {
      this.clearByActor(input.actorId);
      return;
    }

    await this.stop({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      actorId: input.actorId,
      actorType: input.actorType,
      displayName: input.displayName,
    });
  }

  private armStop(input: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly actorId: string;
    readonly actorType: TypingActorType;
    readonly displayName: string;
  }): void {
    const key = keyOf(input);
    this.clear(key);
    const timer = setTimeout(() => {
      void this.stop(input);
    }, TYPING_IDLE_MS);
    timer.unref();
    this.timers.set(key, timer);
  }

  private clear(key: TypingKey): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  private clearByActor(actorId: string): void {
    for (const key of [...this.timers.keys()]) {
      if (key.endsWith(`:${actorId}`)) {
        this.clear(key);
      }
    }
  }

  private async publish(
    message: RealtimeEphemeralFanout & { readonly type: 'typing' },
  ): Promise<void> {
    await this.publisher.publish(message);
  }
}

function keyOf(input: { readonly conversationId: string; readonly actorId: string }): TypingKey {
  return `${input.conversationId}:${input.actorId}`;
}
