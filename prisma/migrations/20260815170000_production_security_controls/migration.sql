-- CreateTable
CREATE TABLE "security_policies" (
    "organization_id" UUID NOT NULL,
    "ip_allowlist_enabled" BOOLEAN NOT NULL,
    "mfa_required" BOOLEAN NOT NULL,
    "session_idle_timeout_seconds" INTEGER NOT NULL,
    "max_request_bytes" INTEGER NOT NULL,
    "rate_limit_per_minute" INTEGER NOT NULL,
    "audit_retention_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_policies_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "security_ip_allowlist_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cidr" TEXT NOT NULL,
    "label" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_ip_allowlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_secrets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "last_accessed_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "security_ip_allowlist_entries_organization_id_cidr_key" ON "security_ip_allowlist_entries"("organization_id", "cidr");

-- CreateIndex
CREATE INDEX "security_ip_allowlist_entries_organization_id_idx" ON "security_ip_allowlist_entries"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_secrets_organization_id_name_key" ON "security_secrets"("organization_id", "name");

-- CreateIndex
CREATE INDEX "security_secrets_organization_id_revoked_at_idx" ON "security_secrets"("organization_id", "revoked_at");

-- CreateIndex
CREATE INDEX "security_audit_events_organization_id_occurred_at_idx" ON "security_audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "security_audit_events_organization_id_action_occurred_at_idx" ON "security_audit_events"("organization_id", "action", "occurred_at");

-- CreateIndex
CREATE INDEX "security_audit_events_organization_id_outcome_occurred_at_idx" ON "security_audit_events"("organization_id", "outcome", "occurred_at");

-- AddForeignKey
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_ip_allowlist_entries" ADD CONSTRAINT "security_ip_allowlist_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_secrets" ADD CONSTRAINT "security_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_events" ADD CONSTRAINT "security_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
