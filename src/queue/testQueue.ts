import { PrismaClient } from "@prisma/client";
import { transaction_queue } from "../rate-service/redis.service";

const prisma = new PrismaClient();

async function schedule_pending_transactions() {
    try {
        // Get some of the pending transactions from database
        const pending_transactions = await prisma.transaction.findMany({
            where: { status: 'PENDING' },
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

setInterval(schedule_pending_transactions, 1000 * 60 *5)
schedule_pending_transactions();