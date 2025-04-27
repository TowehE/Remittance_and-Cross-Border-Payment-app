// src/utils/account_utils.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generate a unique account number (10 digits)
export const generate_account_number = async (): Promise<string> => {
  // Generate a random 10-digit number
  const prefix = Date.now().toString().slice(-2);
  const random_num = prefix + Math.floor(10000000 + Math.random() * 90000000).toString();
  
  // Check if this account number already exists
//   const existing_account = await prisma.account.findUnique({
//     where: { accountNumber: randomNum }
//   });
  
//   // If it exists, recursively try again
//   if (existing_account) {
//     return generate_account_number();
//   }
  
  return random_num;
};