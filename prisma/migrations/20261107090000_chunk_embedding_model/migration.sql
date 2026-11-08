-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN     "embeddingModel" TEXT;

-- Existing vectors were made by the mock embedder (feature 2).
UPDATE "Chunk" SET "embeddingModel" = 'mock-hash' WHERE "embedding" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Chunk_documentId_embeddingModel_idx" ON "Chunk"("documentId", "embeddingModel");

-- NOTE: Prisma's generated "DROP INDEX Chunk_embedding_hnsw_idx" was removed on purpose (see schema.prisma).
