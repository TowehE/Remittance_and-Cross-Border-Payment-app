import { PrismaClient } from '@prisma/client'
import { customError } from '../shared/middleware/error_middleware';
import { v4 as uuidv4 } from 'uuid';
import * as paystack_service from '../api-gateway/paystack.integration'
import * as stripe_service from '../api-gateway/stripe_integration'
import { get_exchange_rate } from '../rate-service/rate.controller';
import { get_minimum_transfer_amount } from '../utilis';
import * as rate_service from '../rate-service/rate.service'

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

  const senderAccount = sender.accounts[0]
  const receiverAccount = receiver.accounts[0]

// Get the exchange rate
const exchange_rate = await rate_service.get_exchange_rate(
    payment_data.currency,
    payment_data.targetCurrency
);

console.log(exchange_rate)
if (!exchange_rate) {
    throw new customError('Exchange rate not available for the selected currencies', 400);
  }


//  calculate the service charge percentage
const fees_percentage_charge = 0.015
const fees = payment_data.amount * fees_percentage_charge
console.log('Payment Amount:', payment_data.amount);
console.log('Fees:', fees);
console.log('Exchange Rate:', exchange_rate.rate);
// calculate the amount the receiver is getting
// const target_amount = (payment_data.amount - fees) * exchange_rate

const target_amount = (payment_data.amount - fees) * exchange_rate.rate;

console.log('Target Amount:', target_amount);

// Check minimum based on currency
const minimum_amount = get_minimum_transfer_amount(payment_data.targetCurrency)


if (target_amount < minimum_amount) { 
    throw new customError('Target amount is too small after fees and exchange rate. Please send a higher amount.', 400);
  }


  // Create transaction with proper relations
  const transaction = await prisma.transaction.create({
    data: {
        sourceAmount: payment_data.amount,
        targetAmount: target_amount,
        sourceCurrency: payment_data.currency,
        targetCurrency: payment_data.targetCurrency,
        exchangeRate: exchange_rate.rate,
        fees,
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
    receiverId: payment_data.receiverId,
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
    paymentURL:  payment_initiation.authorization_url,
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

        // Decrease sender's balance
        await prisma.account.update({
            where: { id: senderAccount.id },
            data: { balance: { decrement: transaction.sourceAmount } }
        });

        // Increase receiver's balance
        await prisma.account.update({
            where: { id: receiverAccount.id },
            data: { balance: { increment: transaction.targetAmount } }
        });

        // Create account transactions for debit and credit
        await prisma.$transaction([
            prisma.accountTransaction.create({
                data: {
                    accountId: senderAccount.id,
                    amount: -transaction.sourceAmount,
                    currency: transaction.sourceCurrency,
                    type: 'DEBIT',
                    reference: transaction.paymentReference,
                    description: `Remittance to ${transaction.receiver.email}`
                }
            }),
            prisma.accountTransaction.create({
                data: {
                    accountId: receiverAccount.id,
                    amount: transaction.targetAmount,
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

 