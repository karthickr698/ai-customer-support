-- CreateTable
CREATE TABLE "observability_logs" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "level" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "trace_id" TEXT,
    "organization_id" UUID,
    "actor_id" UUID,
    "method" TEXT,
    "path" TEXT,
    "route" TEXT,
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "attributes" JSONB,

    CONSTRAINT "observability_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observability_traces" (
    "id" UUID NOT NULL,
    "correlation_id" TEXT,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "span_count" INTEGER NOT NULL,

    CONSTRAINT "observability_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observability_spans" (
    "id" UUID NOT NULL,
    "trace_id" UUID NOT NULL,
    "parent_span_id" UUID,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "attributes" JSONB,

    CONSTRAINT "observability_spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observability_metric_buckets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "labels_hash" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "bucket_start" TIMESTAMP(3) NOT NULL,
    "organization_id" UUID,
    "count" INTEGER NOT NULL,
    "sum" DOUBLE PRECISION NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "observability_metric_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observability_incidents" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "organization_id" UUID,
    "error_code" TEXT,
    "route" TEXT,
    "count" INTEGER NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,

    CONSTRAINT "observability_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observability_ai_evaluations" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "organization_id" UUID,
    "correlation_id" TEXT,
    "trace_id" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT,
    "verdict" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "input_guardrail" TEXT,
    "output_guardrail" TEXT,
    "citation_count" INTEGER NOT NULL,
    "error_code" TEXT,
    "attributes" JSONB,

    CONSTRAINT "observability_ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observability_logs_occurred_at_idx" ON "observability_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "observability_logs_organization_id_occurred_at_idx" ON "observability_logs"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_logs_trace_id_occurred_at_idx" ON "observability_logs"("trace_id", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_logs_level_occurred_at_idx" ON "observability_logs"("level", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_logs_service_occurred_at_idx" ON "observability_logs"("service", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_logs_route_occurred_at_idx" ON "observability_logs"("route", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_traces_started_at_idx" ON "observability_traces"("started_at");

-- CreateIndex
CREATE INDEX "observability_traces_organization_id_started_at_idx" ON "observability_traces"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "observability_traces_status_started_at_idx" ON "observability_traces"("status", "started_at");

-- CreateIndex
CREATE INDEX "observability_traces_correlation_id_idx" ON "observability_traces"("correlation_id");

-- CreateIndex
CREATE INDEX "observability_spans_trace_id_started_at_idx" ON "observability_spans"("trace_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "observability_metric_buckets_name_labels_hash_bucket_start_key" ON "observability_metric_buckets"("name", "labels_hash", "bucket_start");

-- CreateIndex
CREATE INDEX "observability_metric_buckets_bucket_start_idx" ON "observability_metric_buckets"("bucket_start");

-- CreateIndex
CREATE INDEX "observability_metric_buckets_organization_id_name_bucket_start_idx" ON "observability_metric_buckets"("organization_id", "name", "bucket_start");

-- CreateIndex
CREATE INDEX "observability_metric_buckets_name_bucket_start_idx" ON "observability_metric_buckets"("name", "bucket_start");

-- CreateIndex
CREATE INDEX "observability_incidents_status_last_seen_at_idx" ON "observability_incidents"("status", "last_seen_at");

-- CreateIndex
CREATE INDEX "observability_incidents_organization_id_status_last_seen_at_idx" ON "observability_incidents"("organization_id", "status", "last_seen_at");

-- CreateIndex
CREATE INDEX "observability_incidents_fingerprint_status_idx" ON "observability_incidents"("fingerprint", "status");

-- CreateIndex
CREATE INDEX "observability_incidents_source_last_seen_at_idx" ON "observability_incidents"("source", "last_seen_at");

-- CreateIndex
CREATE INDEX "observability_ai_evaluations_occurred_at_idx" ON "observability_ai_evaluations"("occurred_at");

-- CreateIndex
CREATE INDEX "observability_ai_evaluations_organization_id_occurred_at_idx" ON "observability_ai_evaluations"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_ai_evaluations_verdict_occurred_at_idx" ON "observability_ai_evaluations"("verdict", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_ai_evaluations_operation_occurred_at_idx" ON "observability_ai_evaluations"("operation", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_ai_evaluations_trace_id_idx" ON "observability_ai_evaluations"("trace_id");

-- AddForeignKey
ALTER TABLE "observability_logs" ADD CONSTRAINT "observability_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observability_traces" ADD CONSTRAINT "observability_traces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observability_spans" ADD CONSTRAINT "observability_spans_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "observability_traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observability_metric_buckets" ADD CONSTRAINT "observability_metric_buckets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observability_incidents" ADD CONSTRAINT "observability_incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observability_ai_evaluations" ADD CONSTRAINT "observability_ai_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
