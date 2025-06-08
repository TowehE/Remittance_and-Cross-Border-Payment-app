import { transaction_queue } from "../rate/redis.service";
import { PrismaClient, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 5;

async function scheduleTransactionJobs() {
  console.log("Scheduling pending transaction processing jobs...");
  
  const pendingTransactions = await prisma.transaction.findMany({
    where: { status: TransactionStatus.PENDING },
    take: BATCH_SIZE,
  });

  for (const txn of pendingTransactions) {
    await transaction_queue.add("process-transaction", {
      transactionId: txn.id,
      action: "process",
    }, {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    });
  }

  console.log("Scheduling auto-cancel jobs for expired transactions...");
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const expiredTransactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      createdAt: { lt: tenMinutesAgo },
    },
    take: BATCH_SIZE,
  });

  for (const txn of expiredTransactions) {
    await transaction_queue.add("auto-cancel-transaction", {
      transactionId: txn.id,
      action: "auto-cancel",
    }, {
      attempts: 3,
      backoff: { type: "fixed", delay: 10000 },
      removeOnComplete: true,
    });
  }

  console.log("Scheduling completed.");
}

export function startScheduler() {
  // Run once immediately
  scheduleTransactionJobs().catch(console.error);

  // Schedule to run every 5 minutes
  setInterval(() => {
    scheduleTransactionJobs().catch(console.error);
  }, 5 * 60 * 1000);
}
