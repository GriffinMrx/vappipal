-- AlterTable
ALTER TABLE "Document" DROP COLUMN "language";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "language",
ALTER COLUMN "timeZone" SET DEFAULT 'UTC';

-- DropEnum
DROP TYPE "Language";

