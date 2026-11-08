-- AlterTable
ALTER TABLE "User" ADD COLUMN "welcomeEmailAt" TIMESTAMP(3);

-- Accounts that already exist don't get a late welcome email.
UPDATE "User" SET "welcomeEmailAt" = NOW() WHERE "welcomeEmailAt" IS NULL;
