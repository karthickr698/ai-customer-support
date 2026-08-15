-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient_field" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_attempts" INTEGER NOT NULL,
    "backoff_ms" INTEGER NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID,
    "channel" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT,
    "trigger_kind" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "run_after" TIMESTAMP(3) NOT NULL,
    "last_error" TEXT,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_inbox_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organization_id_slug_key" ON "notification_templates"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "notification_templates_organization_id_enabled_event_type_idx" ON "notification_templates"("organization_id", "enabled", "event_type");

-- CreateIndex
CREATE INDEX "notification_templates_organization_id_updated_at_idx" ON "notification_templates"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_subject_unique" ON "notification_preferences"("organization_id", "subject_type", "subject_key", "event_type", "channel");

-- CreateIndex
CREATE INDEX "notification_preferences_subject_idx" ON "notification_preferences"("organization_id", "subject_type", "subject_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_created_at_idx" ON "notification_deliveries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_status_idx" ON "notification_deliveries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_run_after_idx" ON "notification_deliveries"("status", "run_after");

-- CreateIndex
CREATE INDEX "notification_deliveries_org_template_created_idx" ON "notification_deliveries"("organization_id", "template_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_recipient_created_at_idx" ON "notification_deliveries"("organization_id", "recipient", "created_at");

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_organization_id_started_at_idx" ON "notification_delivery_attempts"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_delivery_id_attempt_idx" ON "notification_delivery_attempts"("delivery_id", "attempt");

-- CreateIndex
CREATE INDEX "notification_inbox_items_organization_id_user_id_created_at_idx" ON "notification_inbox_items"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_inbox_items_organization_id_user_id_read_at_idx" ON "notification_inbox_items"("organization_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_inbox_items_delivery_id_idx" ON "notification_inbox_items"("delivery_id");

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_inbox_items" ADD CONSTRAINT "notification_inbox_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_inbox_items" ADD CONSTRAINT "notification_inbox_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
