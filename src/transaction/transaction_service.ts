 import { PrismaClient } from "@prisma/client";
import { customError } from "../shared/middleware/error_middleware";

const prisma = new PrismaClient()

export const fund_user_wallet = async (userId: string, amount: number) => {
  if (!userId) {
    throw new customError("User ID is required", 400);
  }
  if (amount <= 0) {
    throw new customError("Amount must be greater than zero", 400);
  }
  
 
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: true }
  });

  if (!user) {
    throw new customError("User not found", 404);
  }

  // Assuming the first account is the default one
  const default_account = user.accounts[0];
  
  if (!default_account) {
    throw new customError("No account found for this user", 404);
  }

  const updated_account = await prisma.account.update({
    where: { id: default_account.id },
    data: { balance: { increment: amount } }
  });

  return updated_account;
};












export const check_wallet_balance = async (userId: string, accountNumber?: string) =>{
    let account

    if (accountNumber) {
    account = await prisma.account.findUnique({
      where: { accountNumber },
    });
  } else {
    account = await prisma.account.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });
  }

  if (!account) {
    throw new customError('Wallet not found', 404);
  }

  return {
    accountNumber: account.accountNumber,
    currency: account.currency,
    balance: account.balance,
    provider: account.provider,
  }
}
