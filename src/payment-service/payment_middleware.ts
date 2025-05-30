// payment.validation.ts

import { customError } from '../shared/middleware/error_middleware';
import { intiate_payment_data } from './payment.service';
import { find_user_with_default_account, find_user_account_by_accountno } from './payment.crud';

import { get_minimum_transfer_amount } from '../utilis';
import Decimal from 'decimal.js';
import { get_exchange_rate } from '../rate-service/rate.service';


// Define AccountType if not already globally declared
interface AccountType {
  id: string;
  currency: string;
  balance: number;
  provider: string;
  externalId?: string;
}

// Return type interface
interface ValidationResult {
  sender: any;
  receiver: any;
  sender_account: AccountType;
  receiver_account: AccountType;
  exchangeRate: Decimal;
  fees: Decimal;
  targetAmount: Decimal;
}

export const validate_intiate_remittance_data = async (
  payment_data: intiate_payment_data
): Promise<ValidationResult> => {
  // Validate sender
  const sender = await find_user_with_default_account(payment_data.userId);
  if (!sender || sender.accounts.length === 0) {
    throw new customError('Sender account not found', 404);
  }

  // Validate receiver by ID or account number
  let receiver;
  if (payment_data.receiverId) {
    receiver = await find_user_with_default_account(payment_data.receiverId);
  } else if (payment_data.receiver_account_number) {
    receiver = await find_user_account_by_accountno(payment_data.receiver_account_number);
  }

  if (!receiver || receiver.accounts.length === 0) {
    throw new customError('Receiver account not found', 404);
  }

  if (sender.id === receiver.id) {
    throw new customError('You cannot send money to yourself', 400);
  }

  const sender_account = sender.accounts[0] as AccountType;
  const receiver_account = receiver.accounts[0] as AccountType;

  // Validate currency match
  if (sender_account.currency !== payment_data.currency) {
    throw new customError(
      `You can only send ${sender_account.currency} from this account`,
      400
    );
  }

  // Check balance
  const balance = new Decimal(sender_account.balance);
  if (balance.lessThan(payment_data.amount)) {
    throw new customError('Insufficient funds', 400);
  }

  // Get exchange rate
  const rate = await get_exchange_rate(payment_data.currency, payment_data.targetCurrency);
  if (!rate) {
    throw new customError(
      'Exchange rate not available for the selected currencies',
      400
    );
  }

  const exchangeRate = new Decimal(rate.rate);
  const amount = new Decimal(payment_data.amount);
  const fees = amount.mul(0.015);
  const targetAmount = amount.minus(fees).mul(exchangeRate);

  // Check minimum transfer amount
  const minimumAmount = new Decimal(
    get_minimum_transfer_amount(payment_data.targetCurrency)
  );

  if (targetAmount.lessThan(minimumAmount)) {
    throw new customError(
      'Target amount is too small after fees and exchange rate. Please send a higher amount.',
      400
    );
  }

  return {
    sender,
    receiver,
    sender_account,
    receiver_account,
    exchangeRate,
    fees,
    targetAmount
  };
};
