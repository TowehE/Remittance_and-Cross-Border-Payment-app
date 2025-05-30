/*
  Warnings:

  - You are about to drop the column `checkoutSessionId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `paymentIntentId` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[StripecheckoutSessionId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[StripepaymentIntentId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Transaction_checkoutSessionId_key";

-- DropIndex
DROP INDEX "Transaction_paymentIntentId_key";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "checkoutSessionId",
DROP COLUMN "paymentIntentId",
ADD COLUMN     "StripecheckoutSessionId" TEXT,
ADD COLUMN     "StripepaymentIntentId" TEXT,
ADD COLUMN     "authorizationUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_StripecheckoutSessionId_key" ON "Transaction"("StripecheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_StripepaymentIntentId_key" ON "Transaction"("StripepaymentIntentId");
