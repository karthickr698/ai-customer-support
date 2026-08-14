-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "widget_session_id" UUID;

-- CreateIndex
CREATE INDEX "conversations_organization_id_widget_session_id_idx" ON "conversations"("organization_id", "widget_session_id");

-- CreateTable
CREATE TABLE "widget_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "public_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "greeting" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "launcher_text" TEXT NOT NULL,
    "collect_email" BOOLEAN NOT NULL,
    "allow_anonymous" BOOLEAN NOT NULL,
    "allow_attachments" BOOLEAN NOT NULL,
    "ai_enabled" BOOLEAN NOT NULL,
    "offline_message" TEXT NOT NULL,
    "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "widget_configuration_id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "customer_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID,
    "widget_session_id" UUID,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_configurations_organization_id_key" ON "widget_configurations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_configurations_public_key_key" ON "widget_configurations"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "widget_sessions_token_hash_key" ON "widget_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "widget_sessions_organization_id_visitor_id_idx" ON "widget_sessions"("organization_id", "visitor_id");

-- CreateIndex
CREATE INDEX "widget_sessions_organization_id_expires_at_idx" ON "widget_sessions"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "message_attachments_organization_id_conversation_id_idx" ON "message_attachments"("organization_id", "conversation_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- AddForeignKey
ALTER TABLE "widget_configurations" ADD CONSTRAINT "widget_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_sessions" ADD CONSTRAINT "widget_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_sessions" ADD CONSTRAINT "widget_sessions_widget_configuration_id_fkey" FOREIGN KEY ("widget_configuration_id") REFERENCES "widget_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_widget_session_id_fkey" FOREIGN KEY ("widget_session_id") REFERENCES "widget_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_widget_session_id_fkey" FOREIGN KEY ("widget_session_id") REFERENCES "widget_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
