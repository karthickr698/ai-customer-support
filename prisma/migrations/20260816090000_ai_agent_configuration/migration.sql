-- CreateTable
CREATE TABLE "ai_agent_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "quality_model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "max_output_tokens" INTEGER NOT NULL,
    "max_input_tokens" INTEGER NOT NULL,
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "enabled_tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallback_mode" TEXT NOT NULL,
    "fallback_reply" TEXT,
    "fallback_max_retries" INTEGER NOT NULL,
    "citation_policy" TEXT NOT NULL,
    "refuse_unknown" BOOLEAN NOT NULL,
    "refuse_off_topic" BOOLEAN NOT NULL,
    "language_lock" BOOLEAN NOT NULL,
    "redact_pii" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_configurations_organization_id_key" ON "ai_agent_configurations"("organization_id");

-- AddForeignKey
ALTER TABLE "ai_agent_configurations" ADD CONSTRAINT "ai_agent_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
