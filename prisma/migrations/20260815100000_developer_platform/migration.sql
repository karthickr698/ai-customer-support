-- CreateTable
CREATE TABLE "organization_api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "events" TEXT[] NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_nonce" TEXT NOT NULL,
    "secret_last_four" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "response_status" INTEGER,
    "error_message" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_oauth_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "client_secret_last_four" TEXT NOT NULL,
    "redirect_uris" TEXT[] NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "organization_oauth_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_oauth_grants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT,
    "code_challenge" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "access_token_hash" TEXT,
    "refresh_token_hash" TEXT,
    "access_expires_at" TIMESTAMP(3),
    "refresh_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "organization_oauth_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_api_keys_token_hash_key" ON "organization_api_keys"("token_hash");

-- CreateIndex
CREATE INDEX "organization_api_keys_organization_id_revoked_at_idx" ON "organization_api_keys"("organization_id", "revoked_at");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_organization_id_status_idx" ON "webhook_subscriptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_created_at_idx" ON "webhook_deliveries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_subscription_id_created_at_idx" ON "webhook_deliveries"("subscription_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_oauth_applications_client_id_key" ON "organization_oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "organization_oauth_applications_organization_id_revoked_at_idx" ON "organization_oauth_applications"("organization_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_oauth_grants_code_hash_key" ON "organization_oauth_grants"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "organization_oauth_grants_access_token_hash_key" ON "organization_oauth_grants"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "organization_oauth_grants_refresh_token_hash_key" ON "organization_oauth_grants"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "organization_oauth_grants_organization_id_application_id_idx" ON "organization_oauth_grants"("organization_id", "application_id");

-- AddForeignKey
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_oauth_applications" ADD CONSTRAINT "organization_oauth_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_oauth_grants" ADD CONSTRAINT "organization_oauth_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_oauth_grants" ADD CONSTRAINT "organization_oauth_grants_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "organization_oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
