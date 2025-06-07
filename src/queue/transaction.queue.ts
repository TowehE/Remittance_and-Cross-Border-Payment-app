import { PrismaClient, TransactionStatus } from "@prisma/client";
import { transaction_queue } from "../rate/redis.service";
import { get_transaction_with_users, mark_transaction_as_failed, mark_transation_as_success } from "./transaction.crud.queue";
import { process_successful_payment } from "../payment/payment.service";
import Decimal from "decimal.js";

const prisma = new PrismaClient()
 const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
transaction_queue.process('process-transaction', async (job) => {
 console.log(`Processing job ${job.id} for transaction: ${job.data.transactionId}`);
 const { transactionId } = job.data
 try{
  const transaction = await get_transaction_with_users(transactionId);

  if (!transaction) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  if (transaction.status !== TransactionStatus.PENDING) {
   console.log(`Transaction ${transactionId} is not pending. Skipping.`);
    return; 
  }
  
  console.log(`Processing pending transaction: ${transactionId}`);

     if (transaction.createdAt < tenMinsAgo) {
      console.log(`Transaction ${transactionId} is expired.`);
      await mark_transaction_as_failed(transactionId, "Transaction expired");
      return;
    }

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
      console.log(`Transaction ${transactionId} already picked or updated.`);
      return;
    }


   // Check for insufficient funds before processing
    const fullTransaction = await get_transaction_with_users(transactionId);

    if (!fullTransaction) {
      throw new Error(`Transaction with user details not found: ${transactionId}`);
    }

  const senderAccount = fullTransaction.sender?.accounts.find(
    (account) => account.currency === fullTransaction.sourceCurrency
  );


  if (!senderAccount) {
    await mark_transaction_as_failed(transactionId, "Sender account not found");
    return;
  }

  const senderBalance = new Decimal(senderAccount.balance);
  const sourceAmount = new Decimal(fullTransaction.sourceAmount);

  if (senderBalance.lessThan(sourceAmount)) {
    await mark_transaction_as_failed(transactionId, "Insufficient funds");
    console.log(`Transaction ${transactionId} failed: Insufficient funds`);
    return;
  }
 // Step 4: Process
    await process_successful_payment({ id: transactionId });

  } catch (error: any) {
    console.error(`Error processing transaction ${transactionId}:`, error);
    await mark_transaction_as_failed(transactionId, error.message || "Unknown error");
    throw error;
  }
});



// Auto-cancel old transactions never paid for
transaction_queue.process('auto-cancel', async (job) => {
  const { transactionId } = job.data;
  try {
    // const transaction = await prisma.transaction.findUnique({
    //   where: { id: transactionId },
    // });

    const ten_mins_ago = new Date(Date.now() - 10 * 60 * 1000);

  const result = await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: TransactionStatus.PENDING,
        createdAt: { lt: ten_mins_ago },
      },
      data: {
        status: TransactionStatus.CANCELLED,
      },
    });

    


    if (result.count > 0) {
      console.log(`Transaction ${transactionId} auto-cancelled`);
    } else {
      console.log(`Transaction ${transactionId} not eligible for auto-cancel`);
    }
  } catch (error) {
    console.error(`Error auto-cancelling transaction ${transactionId}:`, error);
    throw error; 
  }
});
