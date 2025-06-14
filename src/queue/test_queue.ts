import { PrismaClient, TransactionStatus } from "@prisma/client";
import { transaction_queue } from "../rate/redis.service";

const prisma = new PrismaClient();

const TEN_MINUTES = 10 * 60 * 1000;
function getTenMinutesAgo(): Date {
  return new Date(Date.now() - TEN_MINUTES);
}
  

async function schedule_pending_transactions() {
    try {
         const now = new Date();
    const tenMinutesAgo = getTenMinutesAgo();

        // Get some of the pending transactions from database
        const pending_transactions = await prisma.transaction.findMany({
            where: {
                 status: 'PENDING',
                 createdAt: { lt: new Date(), gte: tenMinutesAgo }
                },
            
            take: 10
        });
        console.log(`Found ${pending_transactions.length} pending transactions`);

        
        // Adding them to the queue
        for (const transaction of pending_transactions) {
            const job = await transaction_queue.add('process-transaction', {
                transactionId: transaction.id
                    }, {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
            });
            console.log(`Added job ${job.id} for transaction: ${transaction.id}`);
        }
        
        console.log('All jobs added to queue');
    } catch (error) {
        console.error('Error testing queue:', error);
    }
}


// Schedule only transactions that are older than 10 minutes and still PENDING
async function schedule_auto_cancel_jobs() {
     const threshold = getTenMinutesAgo();


  const stale_transactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      createdAt: { lt: threshold },
    },
    take: 5,
    
  });
 console.log(`Found ${stale_transactions.length} stale transactions to schedule for auto-cancel.`);

 for (const tx of stale_transactions) {
        await transaction_queue.add('auto-cancel', { 
            transactionId: tx.id 
        }, {
            attempts: 3,
            removeOnComplete: true,
            removeOnFail: false,
        });
        console.log(`Added auto-cancel job for stale transaction: ${tx.id}`);
    }
}

export function start_scheduled_jobs() {
  schedule_pending_transactions();
  schedule_auto_cancel_jobs();

  setInterval(schedule_pending_transactions, 5 * 60 * 1000);
  setInterval(schedule_auto_cancel_jobs, 5 * 60 * 1000);
}
