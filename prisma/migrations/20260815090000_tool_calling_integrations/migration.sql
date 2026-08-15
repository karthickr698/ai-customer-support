-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "provider" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "header_name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_nonce" TEXT NOT NULL,
    "secret_last_four" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_connectors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "authorization_url" TEXT NOT NULL,
    "token_url" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_ciphertext" TEXT NOT NULL,
    "client_secret_nonce" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "access_token_ciphertext" TEXT,
    "access_token_nonce" TEXT,
    "refresh_token_ciphertext" TEXT,
    "refresh_token_nonce" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "external_account_id" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disconnected_at" TIMESTAMP(3),

    CONSTRAINT "oauth_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_invocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "conversation_id" UUID,
    "actor_id" UUID,
    "actor_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "result" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "credential_id" UUID,
    "connector_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_organization_id_tool_name_key" ON "integration_credentials"("organization_id", "tool_name");

-- CreateIndex
CREATE INDEX "integration_credentials_organization_id_revoked_at_idx" ON "integration_credentials"("organization_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_connectors_organization_id_provider_key" ON "oauth_connectors"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "oauth_connectors_organization_id_status_idx" ON "oauth_connectors"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tool_invocations_organization_id_created_at_idx" ON "tool_invocations"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_invocations_organization_id_tool_name_created_at_idx" ON "tool_invocations"("organization_id", "tool_name", "created_at");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_connectors" ADD CONSTRAINT "oauth_connectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
