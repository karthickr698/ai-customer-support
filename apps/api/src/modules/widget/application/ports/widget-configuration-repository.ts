import type { WidgetConfiguration } from '../../domain/widget-configuration.js';
import type { WidgetConfigurationId } from '../../domain/widget-configuration-id.js';

export interface WidgetConfigurationRepository {
  findByTenant(tenantId: string): Promise<WidgetConfiguration | null>;
  findByPublicKey(publicKey: string): Promise<WidgetConfiguration | null>;
  findById(id: WidgetConfigurationId): Promise<WidgetConfiguration | null>;
  save(widget: WidgetConfiguration): Promise<void>;
}
