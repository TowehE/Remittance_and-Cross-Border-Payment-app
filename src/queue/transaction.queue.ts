import { PrismaClient, TransactionStatus } from "@prisma/client";
import { transaction_queue } from "../rate/redis.service";
import { get_transaction_with_users, mark_transaction_as_failed } from "./transaction.crud.queue";
import { process_successful_payment } from "../payment/payment.service";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

transaction_queue.process("process-transaction", async (job) => {
  const { transactionId } = job.data;
  console.log(`Processing transaction: ${transactionId}`);

  try {
    // Step 1: Fetch transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
         throw new Error(`Transaction ${transactionId} not found`);
       }
   
       if (transaction.status !== TransactionStatus.PENDING) {
         console.log(`Transaction ${transactionId} is not pending. Current status: ${transaction.status}`);
         return;
       }
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (transaction.createdAt < tenMinutesAgo) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.CANCELLED },
      });
      console.log(`Transaction ${transactionId} cancelled due to expiration`);
      return;
    }

    // Step 3: Lock it for processing
    const locked = await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.PROCESSING,
      },
    });

    if (locked.count === 0) {
      console.log(`Transaction ${transactionId} already picked`);
      return;
    }

    // Step 4: Re-fetch with related user/accounts
    const fullTransaction = await get_transaction_with_users(transactionId);
    if (!fullTransaction) throw new Error("Transaction with users not found");

    const senderAccount = fullTransaction.sender?.accounts.find(
      (acc) => acc.currency === fullTransaction.sourceCurrency
    );

    if (!senderAccount) {
      await mark_transaction_as_failed(transactionId, "Sender account not found");
      return;
    }

    const senderBalance = new Decimal(senderAccount.balance);
    const amount = new Decimal(fullTransaction.sourceAmount);

    if (senderBalance.lessThan(amount)) {
      await mark_transaction_as_failed(transactionId, "Insufficient funds");
      return;
    }

    // Step 5: Process
    await process_successful_payment({ id: transactionId });

  } catch (error: any) {
    console.error(`Failed to process transaction ${transactionId}:`, error);
    await mark_transaction_as_failed(transactionId, error.message || "Unknown error");
    throw error;
  }
});




transaction_queue.process("auto-cancel", async (job) => {
  const { transactionId } = job.data;
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (
      transaction &&
      transaction.status === TransactionStatus.PENDING &&
      transaction.createdAt < new Date(Date.now() - 10 * 60 * 1000)
    ) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.CANCELLED },
      });
      console.log(`Transaction ${transactionId} auto-cancelled`);
    } else {
      console.log(`Transaction ${transactionId} not eligible for auto-cancel`);
    }
  } catch (error) {
    console.error(`Error auto-cancelling transaction ${transactionId}:`, error);
    throw error;
  }
});
