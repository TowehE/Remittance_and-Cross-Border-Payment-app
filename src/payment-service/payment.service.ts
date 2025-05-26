import { PrismaClient } from '@prisma/client'
import { customError } from '../shared/middleware/error_middleware';
import { v4 as uuidv4 } from 'uuid';
import * as paystack_service from '../api-gateway/paystack.integration'
import * as stripe_service from '../api-gateway/stripe_integration'
import { get_exchange_rate } from '../rate-service/rate.controller';
import { get_minimum_transfer_amount } from '../utilis';
import * as rate_service from '../rate-service/rate.service'
import Decimal from 'decimal.js';

const prisma = new PrismaClient()

const APP_BASE_URL= process.env.APP_BASE_URL

// Define a simple Account interface to use for type annotations
interface AccountType {
    id: string;
    currency: string;
    // Add other properties you might need, but at minimum what's used in the code
}

export interface intiate_payment_data{
    userId: string;
    amount: number;
    currency: string;
    targetCurrency: string
    receiverId?: string;
    receiverAccountNumber?: string;
    // callbackUrl?: string;
}

export const intiate_remittance_payment = async (payment_data : intiate_payment_data) =>{
    
    const sender = await prisma.user.findUnique({
        where: { 
            id: payment_data.userId },
        include:{
            accounts: {
                where:{ isDefault: true }
            }
        }
    })
    if (!sender || sender.accounts.length === 0) {
        throw new customError('Sender account not found', 404);
      }
   // Find receiver by ID or account number
   let receiver;
   if (payment_data.receiverId) {
       receiver = await prisma.user.findUnique({
           where: { id: payment_data.receiverId },
           include: {
               accounts: {
                   where: { isDefault: true }
               }
           }
       });
   } else if (payment_data.receiverAccountNumber) {
       // Find user by account number
       const receiverAccount = await prisma.account.findUnique({
           where: { accountNumber: payment_data.receiverAccountNumber },
           include: { user: true }
       });
       
       if (receiverAccount) {
           // Get the user's default account
           const accounts = await prisma.account.findMany({
               where: { 
                   userId: receiverAccount.userId,
                   isDefault: true 
               }
           });
           
           receiver = {
               ...receiverAccount.user,
               accounts: accounts
           };
       }
   }
   
   if (!receiver || receiver.accounts.length === 0) {
       throw new customError('Receiver account not found', 404);
   }

   
 // Prevent sending to self (by user ID)
 if (sender.id === receiver.id) {
    throw new customError('You cannot send money to yourself', 400);
}

const senderAccount = sender.accounts[0];
const receiverAccount = receiver.accounts[0];

// Validate sender's currency matches the source currency
if (senderAccount.currency !== payment_data.currency) {
    throw new customError(`You can only send ${senderAccount.currency} from this account`, 400);
}

// Validate receiver's currency is NGN
// if (receiverAccount.currency !== 'NGN') {
//     throw new customError('The recipient must have an NGN account for receiving transfers', 400);
// }

// // Validate target currency is also NGN
// if (payment_data.targetCurrency !== 'NGN') {
//     throw new customError('Target currency must be NGN for all transfers', 400);
// }

  const balance = new Decimal(senderAccount.balance);
if (balance.lessThan(payment_data.amount)) {
  throw new customError('Insufficient funds', 400);
}

// Get the exchange rate
const exchange_rate = await rate_service.get_exchange_rate(
    payment_data.currency,
    payment_data.targetCurrency
);

console.log(exchange_rate)
if (!exchange_rate) {
    throw new customError('Exchange rate not available for the selected currencies', 400);
  }

// Calculate with Decimal for precision
const amount = new Decimal(payment_data.amount);
const fees_percentage = new Decimal(0.015);
const exchange_rate_value = new Decimal(exchange_rate.rate);

// Calculate fees
const fees = amount.mul(fees_percentage);

// Calculate target amount
const target_amount = amount.minus(fees).mul(exchange_rate_value);

// Convert Decimal objects to numbers before using with Prisma
const target_amount_number = target_amount.toNumber();
const fees_number = fees.toNumber();

// Check minimum based on currency
const minimum_amount = get_minimum_transfer_amount(payment_data.targetCurrency)


const minimum_amount_decimal = new Decimal(minimum_amount);
if (target_amount.lessThan(minimum_amount_decimal)) { 
    throw new customError('Target amount is too small after fees and exchange rate. Please send a higher amount.', 400);
}


//   /Create transaction with proper relations using number values
  const transaction = await prisma.transaction.create({
    data: {
      sourceAmount: payment_data.amount,
      targetAmount: target_amount_number, 
      sourceCurrency: payment_data.currency,
      targetCurrency: payment_data.targetCurrency,
      exchangeRate: exchange_rate.rate,
      fees: fees_number, 
      status: 'PENDING',
      paymentMethod: senderAccount.provider.toLowerCase() === 'paystack' 
          ? 'PAYSTACK' 
          : 'STRIPE',
      sender: {
          connect: { id: payment_data.userId }
      },
      receiver: {
          connect: { id: receiver.id }
      }
    }
  });


// Generate a unique reference for the payment
const reference = `RM-${uuidv4()}`

 // Store metadata about the transaction
 const metadata = {
    transactionId: transaction.id,
    userId: payment_data.userId,
    receiverId: payment_data.receiverId  || receiver.id,
  };
  
  let payment_initiation

// initiate payment based on the sender payment provider
if(senderAccount.provider.toLowerCase() === 'paystack'){
    payment_initiation = await paystack_service.initiate_payment({
        email: sender.email,
        name: `${sender.firstName} ${sender.lastName}`,
        phoneNumber: sender.phoneNumber ?? undefined,
        amount: payment_data.amount,
        currency: payment_data.currency,
        reference,
        metadata
    })

// update the transaction using the payment reference
await prisma.transaction.update({
    where: { id:transaction.id },
    data: { paymentReference: reference}
})

return{
    transaction,
    paymentUrl:  payment_initiation.authorization_url,
    reference
}
}
else if( senderAccount.provider.toLowerCase() === 'stripe'){
    if (!senderAccount.externalId) {
        throw new customError('Stripe customer ID (externalId) not found for sender', 400);
      }

    payment_initiation = await stripe_service.create_payment_session({
    customerId: senderAccount.externalId,
    email: sender.email,
    name: `${sender.firstName} ${sender.lastName}`,
    // phone: sender.phone,
    amount: payment_data.amount,
    currency: payment_data.currency,
    metadata,
    description: `Remittance from ${sender.email} to ${receiver.email}`,
    // successUrl: `${APP_BASE_URL}/payment-success` ,
    // cancelUrl: `${APP_BASE_URL}/payment-cancel`
    // successUrl: payment_data.callbackUrl,
    // cancelUrl: `${payment_data.callbackUrl}?canceled=true`
})

    
    // / Update transaction with payment reference
    await prisma.transaction.update({
        where: { id: transaction.id },
        data: { paymentReference: payment_initiation.id }
    });

    return {
        transaction,
        paymentUrl: payment_initiation.authorization_url,
        reference: payment_initiation.id
    };
} else {
    throw new customError('Unsupported payment provider', 400);
}
};

export const process_successful_payment = async (session: { id: string }) => {
    try {
        // Fetch transaction along with sender and receiver details
        const transaction = await prisma.transaction.findUnique({
            where: { id: session.id },
            include: {
                sender: { include: { accounts: true } },
                receiver: { include: { accounts: true } }
            }
        });

        if (!transaction) {
            console.error('Transaction not found for payment:', session.id);
            return;
        }
        if (transaction.status === 'COMPLETED') {
            console.log(`Transaction ${transaction.id} already processed. Skipping.`);
            return;
        }


        // Update transaction status to 'COMPLETED'
        await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' }
        });

        // Find sender's and receiver's accounts based on the transaction currencies
        // Add explicit type annotations to fix the TS7006 errors
        const senderAccount = transaction.sender?.accounts.find(
            (account: AccountType) => account.currency === transaction.sourceCurrency
        );
        
        const receiverAccount = transaction.receiver?.accounts.find(
            (account: AccountType) => account.currency === transaction.targetCurrency
        );
        
        if (!senderAccount || !receiverAccount) {
            console.error('Accounts not found for transaction:', transaction.id);
            return;
        }


        // Use Decimal for precise calculations
        const sourceAmount = new Decimal(transaction.sourceAmount);
        const targetAmount = new Decimal(transaction.targetAmount);
        
        // Get current balances
        const senderBalance = new Decimal(senderAccount.balance);
        const receiverBalance = new Decimal(receiverAccount.balance);
        
        // Calculate new balances
        const newSenderBalance = senderBalance.minus(sourceAmount);
        const newReceiverBalance = receiverBalance.plus(targetAmount);

        // Format to 2 decimal places and convert back to number
        const formattedSenderBalance = parseFloat(newSenderBalance.toFixed(2));
        const formattedReceiverBalance = parseFloat(newReceiverBalance.toFixed(2));


        
        // Update sender's balance with exact value instead of decrementing
        await prisma.account.update({
            where: { id: senderAccount.id },
            data: { balance: formattedSenderBalance }
        });

        // Update receiver's balance with exact value instead of incrementing
        await prisma.account.update({
            where: { id: receiverAccount.id },
            data: { balance: formattedReceiverBalance }
        });




        // Create account transactions for debit and credit
        await prisma.$transaction([
            prisma.accountTransaction.create({
                data: {
                    accountId: senderAccount.id,
                    amount: -parseFloat(sourceAmount.toFixed(2)),
                    currency: transaction.sourceCurrency,
                    type: 'DEBIT',
                    reference: transaction.paymentReference,
                    description: `Remittance to ${transaction.receiver.email}`
                }
            }),
            prisma.accountTransaction.create({
                data: {
                    accountId: receiverAccount.id,
                    amount: parseFloat(targetAmount.toFixed(2)),
                    currency: transaction.targetCurrency,
                    type: 'CREDIT',
                    reference: transaction.paymentReference,
                    description: `Remittance from ${transaction.sender.email}`
                }
            })
        ]);

        console.log(`Payment processed successfully for transaction ${transaction.id}`);
    } catch (error) {
        console.error('Error processing payment:', error);
        throw new customError('Failed to process successful payment', 500);
    }
};




 