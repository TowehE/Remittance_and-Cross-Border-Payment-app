import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient()

// Finds a user by ID and includes their default account
export async function find_user_with_default_account (userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        include:{ accounts: 
            {where: { isDefault: true }}
         },
    })
}

// Finds a user account by account number and returns user with default accounts
export async function find_user_account_by_accountno (accountNumber : string){
    const receiver_account = await prisma.account.findUnique({
         where: { accountNumber },
    include: { user: true }
  })
if (!receiver_account) return null;

  const accounts = await prisma.account.findMany({
    where: { userId: receiver_account.userId, isDefault: true }
  });

  return { ...receiver_account.user, accounts };
}


// Creates a new transaction record in the database
export async function create_transaction(data: any) {
  return prisma.transaction.create({ data });
}

// Updates an existing transaction by ID
export async function update_transaction(id: string, data: any) {
  return prisma.transaction.update({ where: { id }, data });
}


// Finds a transaction by ID with sender and receiver details including their accounts
export async function find_transaction_by_Id(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      sender: { include: { accounts: true } },
      receiver: { include: { accounts: true } }
    }
  });
}


// Updates the balance of a specific account
export async function update_account_balance(accountId: string, balance: number) {
  return prisma.account.update({
    where: { id: accountId },
    data: { balance }
  });
}

// Creates multiple account transaction records atomically
export async function create_account_transactions(transactions: any[]) {
  return prisma.$transaction(
    transactions.map(tx => prisma.accountTransaction.create({ data: tx }))
  );
}
