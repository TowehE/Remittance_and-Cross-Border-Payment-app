/*
  Warnings:

  - A unique constraint covering the columns `[checkoutSessionId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentIntentId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paystackReference]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "checkoutSessionId" TEXT,
ADD COLUMN     "paymentIntentId" TEXT,
ADD COLUMN     "paystackReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_checkoutSessionId_key" ON "Transaction"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_paymentIntentId_key" ON "Transaction"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_paystackReference_key" ON "Transaction"("paystackReference");
