-- AlterTable
ALTER TABLE "InternetClient" ADD COLUMN "retiredAt" DATETIME;
ALTER TABLE "InternetClient" ADD COLUMN "retiredReason" TEXT;
ALTER TABLE "InternetClient" ADD COLUMN "retiredDebtMonths" TEXT;
