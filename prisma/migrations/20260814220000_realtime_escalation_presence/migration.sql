-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "last_message_author_type" TEXT;

-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" TEXT NOT NULL,
    "trigger_minutes" INTEGER,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escalation_rules_organization_id_enabled_priority_idx" ON "escalation_rules"("organization_id", "enabled", "priority");

-- AddForeignKey
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
