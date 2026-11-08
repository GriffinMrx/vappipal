-- CreateEnum
CREATE TYPE "WritingSpeed" AS ENUM ('CALM', 'NORMAL', 'FAST', 'INSTANT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "writingSpeed" "WritingSpeed" NOT NULL DEFAULT 'NORMAL';
