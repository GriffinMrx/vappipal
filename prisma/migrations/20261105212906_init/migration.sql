-- Enable pgvector for chunk embeddings (AGENTS.md §12). Prisma models the column as Unsupported("vector(N)").
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('FR', 'EN', 'AR');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "language" "Language" NOT NULL DEFAULT 'FR',
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
