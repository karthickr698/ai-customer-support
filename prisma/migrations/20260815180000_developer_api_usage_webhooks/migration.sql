-- AlterTable
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- CreateTable
CREATE TABLE "webhook_delivery_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "response_status" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "signature_timestamp" INTEGER NOT NULL,
    "signature_header" TEXT NOT NULL,
    "error_message" TEXT,
    "response_body_preview" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_api_usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID,
    "auth_kind" TEXT NOT NULL,
    "credential_id" UUID,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_api_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_organization_id_started_at_idx" ON "webhook_delivery_attempts"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_delivery_id_attempt_idx" ON "webhook_delivery_attempts"("delivery_id", "attempt");

-- CreateIndex
CREATE INDEX "public_api_usage_records_organization_id_occurred_at_idx" ON "public_api_usage_records"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "public_api_usage_records_organization_id_route_occurred_at_idx" ON "public_api_usage_records"("organization_id", "route", "occurred_at");

-- CreateIndex
CREATE INDEX "public_api_usage_org_cred_occurred_idx" ON "public_api_usage_records"("organization_id", "credential_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_api_usage_records" ADD CONSTRAINT "public_api_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
