import type { WidgetSession } from '../../domain/widget-session.js';
import type { WidgetSessionId } from '../../domain/widget-session-id.js';

export interface WidgetSessionRepository {
  save(session: WidgetSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<WidgetSession | null>;
  findById(tenantId: string, sessionId: WidgetSessionId): Promise<WidgetSession | null>;
}
