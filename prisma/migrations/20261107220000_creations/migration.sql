-- CreateEnum
CREATE TYPE "CreationType" AS ENUM ('NOTES', 'OUTLINE', 'CHECKLIST', 'EMAIL', 'BLOG_POST');

-- CreateEnum
CREATE TYPE "CreationStatus" AS ENUM ('WRITING', 'READY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UsageKind" ADD VALUE 'CREATION';
ALTER TYPE "UsageKind" ADD VALUE 'CREATE_EDIT';


-- CreateTable
CREATE TABLE "Creation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "type" "CreationType" NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "banner" TEXT,
    "instruction" TEXT,
    "content" JSONB,
    "markdown" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "status" "CreationStatus" NOT NULL DEFAULT 'WRITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Creation_userId_spaceId_updatedAt_idx" ON "Creation"("userId", "spaceId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Creation" ADD CONSTRAINT "Creation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creation" ADD CONSTRAINT "Creation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

