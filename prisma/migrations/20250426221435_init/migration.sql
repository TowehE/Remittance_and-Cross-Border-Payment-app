-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'PAYSTACK', 'STRIPE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "userType" TEXT NOT NULL,
    "country" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "externalId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "sourceAmount" DOUBLE PRECISION NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_sourceCurrency_targetCurrency_key" ON "ExchangeRate"("sourceCurrency", "targetCurrency");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
