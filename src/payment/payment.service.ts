import { PrismaClient } from '@prisma/client'
import { customError } from '../shared/middleware/error_middleware';
import { v4 as uuidv4 } from 'uuid';
import * as paystack_service from '../api-gateway/paystack.integration'
import * as stripe_service from '../api-gateway/stripe_integration'
import Decimal from 'decimal.js';
import { Request } from 'express';
import { create_account_transactions, create_transaction, find_transaction_by_Id, find_user_account_by_accountno, find_user_with_default_account, update_account_balance, update_transaction } from './payment.crud';
import { validate_intiate_remittance_data } from './payment_middleware';
import { transaction_queue } from '../rate/redis.service';



const prisma = new PrismaClient()

const APP_BASE_URL= process.env.APP_BASE_URL

// Define a  Account interface to use for type annotations
interface AccountType {
    id: string;
    currency: string;
     balance: number;
  provider: string;
  externalId?: string;
    
   
}

export interface intiate_payment_data{
    userId: string;
    amount: number;
    currency: string;
    targetCurrency: string
    receiverId?: string;
    receiver_account_number?: string;
  
}
export const intiate_remittance_payment = async ( payment_data: intiate_payment_data, req: Request) => {
  const {
    sender,
    receiver,
    sender_account,
    receiver_account,
    exchangeRate,
    fees,
    targetAmount
  } = await validate_intiate_remittance_data(payment_data);



  const target_amount_number = targetAmount.toNumber();
  const fees_number = fees.toNumber();

  

  const transaction = await prisma.transaction.create({
    data: {
      sourceAmount: payment_data.amount,
      targetAmount: target_amount_number,
      sourceCurrency: payment_data.currency,
      targetCurrency: payment_data.targetCurrency,
      exchangeRate: exchangeRate.toNumber(),
      fees: fees_number,
      status: 'PENDING',
      paymentMethod:
        sender_account.provider.toLowerCase() === 'paystack' ? 'PAYSTACK' : 'STRIPE',
      sender: {
        connect: { id: payment_data.userId }
      },
      receiver: {
        connect: { id: receiver.id }
      }
    }
  });

  await transaction_queue.add(
  'auto-cancel',
  { transactionId: transaction.id },
  { delay: 10 * 60 * 1000 } // 10 minutes
);

  const reference = `RM-${uuidv4()}`;
  const metadata = {
    transactionId: transaction.id,
    userId: payment_data.userId,
    receiverId: payment_data.receiverId || receiver.id,
    user_email:sender.email

  };

  let payment_initiation;

  if (sender_account.provider.toLowerCase() === 'paystack') {
    payment_initiation = await paystack_service.initiate_payment({
      email: sender.email,
      name: `${sender.firstName} ${sender.lastName}`,
      phoneNumber: sender.phoneNumber ?? undefined,
      amount: payment_data.amount,
      currency: payment_data.currency,
      reference,
      metadata
    });

    await update_transaction(transaction.id, {
      paymentReference: reference
    });

    return {
      transaction,
      paymentUrl: payment_initiation.authorization_url,
      reference
    };
  }

  if (sender_account.provider.toLowerCase() === 'stripe') {
    if (!sender_account.externalId)
      throw new customError('Stripe customer ID (externalId) not found for sender', 400);

    payment_initiation = await stripe_service.create_payment_session(
      {
        customerId: sender_account.externalId,
        email: sender.email,
        name: `${sender.firstName} ${sender.lastName}`,
        amount: payment_data.amount,
        currency: payment_data.currency,
        metadata,
        description: `Remittance from ${sender.email} to ${receiver.email}`
      },
      req
    );

    await update_transaction(transaction.id, {
      paymentReference: payment_initiation.id,
      StripecheckoutSessionId: payment_initiation.id,
      StripepaymentIntentId: payment_initiation.payment_intent,
      paystackReference: payment_initiation.reference ?? null,
      authorizationUrl: payment_initiation.authorization_url ?? null
    });

    return {
      transaction,
      paymentUrl: payment_initiation.authorization_url,
      reference: payment_initiation.id
    };
  }

  throw new customError('Unsupported payment provider', 400);
};



export const process_successful_payment = async (session: { id: string }) => {
    try {
      const transaction = await find_transaction_by_Id(session.id);
    if (!transaction) {
      console.error('Transaction not found for payment:', session.id);
      return;
    }
    if (transaction.status === 'COMPLETED') {
      console.log(`Transaction ${transaction.id} already processed. Skipping.`);
      return;
    }

    await update_transaction(transaction.id, { status: 'COMPLETED' });

   const sender_account = (transaction.sender?.accounts as AccountType[]).find((a) => a.currency === transaction.sourceCurrency
);

const receiver_account = (transaction.receiver?.accounts as AccountType[]).find((a) => a.currency === transaction.targetCurrency
);

    if (!sender_account || !receiver_account) {
      console.error('Accounts not found for transaction:', transaction.id);
      return;
    }

    const sourceAmount = new Decimal(transaction.sourceAmount);
    const targetAmount = new Decimal(transaction.targetAmount);

    const newSenderBalance = new Decimal(sender_account.balance).minus(sourceAmount);
    const newReceiverBalance = new Decimal(receiver_account.balance).plus(targetAmount);

    await update_account_balance(sender_account.id, parseFloat(newSenderBalance.toFixed(2)));
    await update_account_balance(receiver_account.id, parseFloat(newReceiverBalance.toFixed(2)));

    await create_account_transactions([
      {
        accountId: sender_account.id,
        amount: -parseFloat(sourceAmount.toFixed(2)),
        currency: transaction.sourceCurrency,
        type: 'DEBIT',
        reference: transaction.paymentReference,
        description: `Remittance to ${transaction.receiver.email}`
      },
      {
        accountId: receiver_account.id,
        amount: parseFloat(targetAmount.toFixed(2)),
        currency: transaction.targetCurrency,
        type: 'CREDIT',
        reference: transaction.paymentReference,
        description: `Remittance from ${transaction.sender.email}`
      }
    ]);

       console.log(`Payment processed successfully for transaction ${transaction.id}`);
    } catch (error) {
        console.error('Error processing payment:', error);
        throw new customError('Failed to process successful payment', 500);
    }
};;
