import { PrismaClient, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient()

export const get_transaction_with_users = async (transactionId: string) => {
    return await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
            sender: { 
                include: { accounts: true } 
            },
            receiver: { 
                include: { accounts: true } 
            },
        },
    });
};

export const mark_transaction_as_failed = async (transactionId: string, reason: string) => {
  return await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'FAILED',
      failureReason: reason,
      updatedAt: new Date()
    },
  });
};


//  Mark transaction as success
export const mark_transation_as_success = async (transactionId: string) => {
   await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: TransactionStatus.COMPLETED,
      updatedAt: new Date(), 
      
    }
  });
};


export const debit_sender_and_credit_receiver =  async (senderId: string, receiverId: string, sourceAmount: number, targetAmount: number) => {
  const [senderAccount, receiverAccount] = await Promise.all([
    prisma.account.findFirst({ where: { userId: senderId, isDefault: true } }),
    prisma.account.findFirst({ where: { userId: receiverId, isDefault: true } }),
  ]);

  if (!senderAccount || !receiverAccount) {
    throw new Error('Sender or receiver account not found');
  }

  if (senderAccount.balance < sourceAmount) {
    throw new Error('Insufficient balance');
  }

  await prisma.$transaction([
    prisma.account.update({
      where: { id: senderAccount.id },
      data: {
        balance: { decrement: sourceAmount },
      }
    }),
    prisma.account.update({
      where: { id: receiverAccount.id },
      data: {
        balance: { increment: targetAmount },
      }
    }),
  ]);
};
