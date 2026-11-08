-- CreateEnum
CREATE TYPE "DocumentStepKind" AS ENUM ('EXTRACT', 'EMBED', 'SUMMARY', 'FLASHCARDS', 'QUIZ');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('CLERK', 'LEMON_SQUEEZY');

-- DropIndex
DROP INDEX "Chunk_documentId_idx";

-- DropIndex
DROP INDEX "Flashcard_subjectId_idx";

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "feedback" TEXT;

-- AlterTable
-- Backfill existing chunks with their order (page, then creation) before NOT NULL.
ALTER TABLE "Chunk" ADD COLUMN     "index" INTEGER;
UPDATE "Chunk" c SET "index" = o.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "documentId" ORDER BY "page", "createdAt", "id") - 1)::int AS rn
  FROM "Chunk"
) o
WHERE c."id" = o."id";
ALTER TABLE "Chunk" ALTER COLUMN "index" SET NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "ocrUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagesProcessed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastReminderOn" DATE,
ADD COLUMN     "lemonSqueezyCustomerId" TEXT,
ADD COLUMN     "unsubscribeToken" TEXT;
-- Existing users get a random token; new rows get a cuid from Prisma.
UPDATE "User" SET "unsubscribeToken" = replace(gen_random_uuid()::text, '-', '') WHERE "unsubscribeToken" IS NULL;
ALTER TABLE "User" ALTER COLUMN "unsubscribeToken" SET NOT NULL;

-- CreateTable
CREATE TABLE "DocumentStep" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "step" "DocumentStepKind" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" "WebhookSource" NOT NULL,
    "eventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStep_documentId_step_key" ON "DocumentStep"("documentId", "step");

-- CreateIndex
CREATE INDEX "ChatMessage_subjectId_createdAt_idx" ON "ChatMessage"("subjectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_userId_clientId_key" ON "ChatMessage"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_eventId_key" ON "WebhookEvent"("source", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Chunk_documentId_index_key" ON "Chunk"("documentId", "index");

-- CreateIndex
CREATE INDEX "Flashcard_subjectId_nextReviewAt_idx" ON "Flashcard"("subjectId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

-- AddForeignKey
ALTER TABLE "DocumentStep" ADD CONSTRAINT "DocumentStep_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Vector index for chat retrieval (AGENTS.md §12). Not modelled by Prisma.
CREATE INDEX "Chunk_embedding_hnsw_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);
