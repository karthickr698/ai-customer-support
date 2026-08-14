-- CreateTable
CREATE TABLE "organization_onboardings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "business_profile" JSONB,
    "tone_presets" JSONB,
    "selected_tone_id" TEXT,
    "agent_settings" JSONB,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_onboardings_organization_id_key" ON "organization_onboardings"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_organization_id_created_at_idx" ON "knowledge_sources"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "organization_onboardings" ADD CONSTRAINT "organization_onboardings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
