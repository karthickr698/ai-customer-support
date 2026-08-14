-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_uri" TEXT,
    "media_type" TEXT,
    "file_name" TEXT,
    "storage_key" TEXT,
    "article_text" TEXT,
    "checksum" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_model" TEXT,
    "parser" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_organization_id_created_at_idx" ON "knowledge_documents"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_organization_id_source_id_idx" ON "knowledge_documents"("organization_id", "source_id");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
