-- CreateTable
CREATE TABLE "platform_operators" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "granted_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_flag_overrides" (
    "id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_operational_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "outcome" TEXT NOT NULL,
    "organization_id" UUID,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_operational_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_operators_user_id_key" ON "platform_operators"("user_id");

-- CreateIndex
CREATE INDEX "platform_operators_status_role_idx" ON "platform_operators"("status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "platform_feature_flags_key_key" ON "platform_feature_flags"("key");

-- CreateIndex
CREATE INDEX "platform_feature_flags_enabled_idx" ON "platform_feature_flags"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "platform_feature_flag_overrides_flag_id_organization_id_key" ON "platform_feature_flag_overrides"("flag_id", "organization_id");

-- CreateIndex
CREATE INDEX "platform_feature_flag_overrides_organization_id_idx" ON "platform_feature_flag_overrides"("organization_id");

-- CreateIndex
CREATE INDEX "platform_operational_audit_logs_occurred_at_idx" ON "platform_operational_audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "platform_operational_audit_logs_action_occurred_at_idx" ON "platform_operational_audit_logs"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_operational_audit_logs_actor_id_occurred_at_idx" ON "platform_operational_audit_logs"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_operational_audit_logs_organization_id_occurred_at_idx" ON "platform_operational_audit_logs"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_operational_audit_logs_outcome_occurred_at_idx" ON "platform_operational_audit_logs"("outcome", "occurred_at");

-- AddForeignKey
ALTER TABLE "platform_feature_flag_overrides" ADD CONSTRAINT "platform_feature_flag_overrides_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "platform_feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_flag_overrides" ADD CONSTRAINT "platform_feature_flag_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
