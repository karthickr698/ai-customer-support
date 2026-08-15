-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';

-- CreateIndex
CREATE INDEX "conversations_organization_id_priority_idx" ON "conversations"("organization_id", "priority");
