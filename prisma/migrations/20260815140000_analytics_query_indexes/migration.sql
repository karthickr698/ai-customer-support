-- Tenant-scoped analytics queries: range scans on created_at / resolved_at / sla_breached_at.

CREATE INDEX "conversations_organization_id_created_at_idx" ON "conversations"("organization_id", "created_at");
CREATE INDEX "conversations_organization_id_channel_created_at_idx" ON "conversations"("organization_id", "channel", "created_at");
CREATE INDEX "messages_organization_id_author_type_created_at_idx" ON "messages"("organization_id", "author_type", "created_at");
CREATE INDEX "tickets_organization_id_created_at_idx" ON "tickets"("organization_id", "created_at");
CREATE INDEX "tickets_organization_id_resolved_at_idx" ON "tickets"("organization_id", "resolved_at");
CREATE INDEX "tickets_organization_id_sla_breached_at_idx" ON "tickets"("organization_id", "sla_breached_at");
CREATE INDEX "tickets_organization_id_priority_created_at_idx" ON "tickets"("organization_id", "priority", "created_at");
