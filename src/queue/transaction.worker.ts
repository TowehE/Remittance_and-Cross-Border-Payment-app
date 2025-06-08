import { PrismaClient, TransactionStatus } from "@prisma/client";
import { transaction_queue } from "../rate/redis.service";
import { get_transaction_with_users, mark_transaction_as_failed } from "./transaction.crud.queue";
import { process_successful_payment } from "../payment/payment.service";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

let isShuttingDown = false;

// Graceful shutdown handler
process.on("SIGINT", () => {
  console.log("Shutting down worker...");
  isShuttingDown = true;
  transaction_queue.close().then(() => {
    console.log("Queue closed. Exiting process.");
    process.exit(0);
  });
});

transaction_queue.process(
  // Concurrency - adjust based on your capacity
  5, 
  async (job) => {
    if (isShuttingDown) {
      console.log("Worker shutting down, skipping job");
      return;
    }

    const { transactionId, action } = job.data;
    console.log(`Starting job for transaction: ${transactionId}, action: ${action}`);

    if (!transactionId || !action) {
      throw new Error("Job must include transactionId and action");
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      switch (action) {
        case "process": {
          if (transaction.status !== TransactionStatus.PENDING) {
            console.log(`Transaction ${transactionId} is not pending. Current status: ${transaction.status}`);
            return;
          }

          // Lock transaction
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
            console.log(`Transaction ${transactionId} already picked for processing`);
            return;
          }

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

          // Idempotent payment processing
          await process_successful_payment({ id: transactionId });
          console.log(`Transaction ${transactionId} processed successfully`);
          break;
        }

        case "auto-cancel": {
          if (transaction.status !== TransactionStatus.PENDING) {
            console.log(`Transaction ${transactionId} is not pending; skipping auto-cancel.`);
            return;
          }

          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          if (transaction.createdAt < tenMinutesAgo) {
            await prisma.transaction.update({
              where: { id: transactionId },
              data: { status: TransactionStatus.CANCELLED },
            });
            console.log(`Transaction ${transactionId} auto-cancelled due to expiration`);
          } else {
            console.log(`Transaction ${transactionId} not old enough to cancel`);
          }
          break;
        }

        default:
          throw new Error(`Unknown job action: ${action}`);
      }
    } catch (error: any) {
      console.error(`Failed to process transaction ${transactionId} with action ${action}:`, error);
      await mark_transaction_as_failed(transactionId, error.message || "Unknown error");
      throw error;
    }
  }
);

// Configure retries and backoff for jobs when added
transaction_queue.on("failed", (job, err) => {
  console.error(`Job failed for transactionId ${job.data.transactionId}, action ${job.data.action}:`, err);
});
