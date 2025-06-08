import { transaction_queue } from "../rate/redis.service";
import { PrismaClient, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 5;

async function scheduleTransactionJobs() {
    const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  console.log("\n========== SCHEDULER START ==========");
  console.log("Current Time (UTC):", now.toISOString());
  console.log("10 Minutes Ago (UTC):", tenMinutesAgo.toISOString());

  console.log("Scheduling pending transaction processing jobs...");
  
  const pendingTransactions = await prisma.transaction.findMany({
    where: { status: TransactionStatus.PENDING },
    take: BATCH_SIZE,
  });

  for (const txn of pendingTransactions) {
     console.log("\n[PROCESSING]");
    console.log("  Transaction ID:", txn.id);
    console.log("  createdAt (UTC):", txn.createdAt.toISOString());
    console.log("  createdAt (Local):", txn.createdAt.toLocaleString());

    
    await transaction_queue.add("process-transaction", {
      transactionId: txn.id,
      action: "process",
    }, {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
    });
    console.log("Now (UTC):", new Date().toISOString());
console.log("CrezatedAt:", txn.createdAt.toISOString());

  }

  console.log("Scheduling auto-cancel jobs for expired transactions...");


  const expiredTransactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      createdAt: { lt: tenMinutesAgo },
    },
    take: BATCH_SIZE,
  });

  for (const txn of expiredTransactions) {

        console.log("\n[AUTO-CANCEL]");
    console.log("  Transaction ID:", txn.id);
    console.log("  createdAt (UTC):", txn.createdAt.toISOString());
    console.log("  createdAt (Local):", txn.createdAt.toLocaleString());
    console.log("  Threshold for expiration (UTC):", tenMinutesAgo.toISOString());

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
