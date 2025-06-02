import { customError } from '../shared/middleware/error_middleware';
import { intiate_payment_data } from './payment.service';
import { find_user_with_default_account, find_user_account_by_accountno } from './payment.crud';

import { get_minimum_transfer_amount } from '../utilis';
import Decimal from 'decimal.js';
import { calculate_transfer_amount, get_exchange_rate } from '../rate/rate.service';


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

export const validate_intiate_remittance_data = async ( payment_data: intiate_payment_data): Promise<ValidationResult> => {

  
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

    // Check balance
  const balance = new Decimal(sender_account.balance);
  if (balance.lessThan(payment_data.amount)) {
    throw new customError('Insufficient funds', 400);
  }


  // Validate currency match
  if (sender_account.currency !== payment_data.currency) {
    throw new customError(
      `You can only send ${sender_account.currency} from this account`,
      400
    );
  }


 // Determine if payment is local: both sender and receiver are local users
  const isLocalPayment = sender.userType === 'local' && receiver.userType === 'local';

  
  // Calculate fees and target amount
  const { fees, targetAmount, rate } = await calculate_transfer_amount(
    payment_data.amount,
    payment_data.currency,
    payment_data.targetCurrency,
    isLocalPayment
  );

  const feesDecimal = new Decimal(fees);
  const targetAmountDecimal = new Decimal(targetAmount);
  const exchangeRate = new Decimal(rate);
 


  // Check minimum transfer amount after fees & exchange rate
  const minimumAmount = new Decimal(get_minimum_transfer_amount(payment_data.targetCurrency));
  if (targetAmountDecimal.lessThan(minimumAmount)) {
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
    fees : feesDecimal,
    targetAmount: targetAmountDecimal
  };
};
