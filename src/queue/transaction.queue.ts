import { PrismaClient, TransactionStatus } from "@prisma/client";
import { transaction_queue } from "../rate-service/redis.service";
import { get_transaction_with_users, mark_transaction_as_failed, mark_transation_as_success } from "./transaction.crud.queue";
import { process_successful_payment } from "../payment-service/payment.service";
import Decimal from "decimal.js";

const prisma = new PrismaClient()

transaction_queue.process('process-transaction', async (job) => {
        console.log(`Processing job ${job.id} for transaction: ${job.data.transactionId}`);
 const { transactionId } = job.data
 
  const transaction = await get_transaction_with_users(transactionId);

  if (!transaction) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  if (transaction.status !== TransactionStatus.PENDING) {
   console.log(`Transaction ${transactionId} is not pending. Skipping.`);
    return; 
  }
  console.log(`Processing pending transaction: ${transactionId}`);
   // Check for insufficient funds before processing
  const senderAccount = transaction.sender?.accounts.find(
    (account) => account.currency === transaction.sourceCurrency
  );

  if (!senderAccount) {
    await mark_transaction_as_failed(transactionId, "Sender account not found");
    return;
  }

  const senderBalance = new Decimal(senderAccount.balance);
  const sourceAmount = new Decimal(transaction.sourceAmount);

  if (senderBalance.lessThan(sourceAmount)) {
    await mark_transaction_as_failed(transactionId, "Insufficient funds");
    console.log(`Transaction ${transactionId} failed: Insufficient funds`);
    return;
  }

  try {
     await process_successful_payment({ id: transactionId });
  } catch (error: any) {
    await mark_transaction_as_failed(transactionId, error.message);
    throw error;
  }
});