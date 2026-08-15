-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" TEXT NOT NULL,
    "event_name" TEXT,
    "schedule" TEXT,
    "match_mode" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_config" JSONB NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "backoff_ms" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "next_run_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "trigger_kind" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "event_name" TEXT,
    "event_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "run_after" TIMESTAMP(3) NOT NULL,
    "last_error" TEXT,
    "claimed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_execution_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "input_snapshot" JSONB,
    "output_snapshot" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "automation_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_enabled_event_name_idx" ON "automation_rules"("organization_id", "enabled", "event_name");

-- CreateIndex
CREATE INDEX "automation_rules_enabled_trigger_type_next_run_at_idx" ON "automation_rules"("enabled", "trigger_type", "next_run_at");

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_updated_at_idx" ON "automation_rules"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_jobs_idempotency_key_key" ON "automation_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "automation_jobs_organization_id_created_at_idx" ON "automation_jobs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_jobs_organization_id_rule_id_created_at_idx" ON "automation_jobs"("organization_id", "rule_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_jobs_status_run_after_idx" ON "automation_jobs"("status", "run_after");

-- CreateIndex
CREATE INDEX "automation_jobs_organization_id_status_idx" ON "automation_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "automation_execution_logs_organization_id_started_at_idx" ON "automation_execution_logs"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "automation_execution_logs_job_id_attempt_idx" ON "automation_execution_logs"("job_id", "attempt");

-- CreateIndex
CREATE INDEX "automation_execution_logs_organization_id_rule_id_started_at_idx" ON "automation_execution_logs"("organization_id", "rule_id", "started_at");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "automation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
