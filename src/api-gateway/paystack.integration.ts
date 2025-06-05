import axios from "axios"
import { PAYSTACK_SECRET_KEY } from "../shared/config"
import { customError } from "../shared/middleware/error_middleware";
import { PrismaClient } from '@prisma/client'
import { send_email } from "../utilis/email";

const prisma = new PrismaClient()

// Configure paystack
const paystack_API = axios.create({
    baseURL: 'https://api.paystack.co',
    headers:{
        Authorization :`Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

export interface initiate_payment_data{
    email: string;
    name: string;
    phoneNumber?: string;
    amount: number;
    currency?: string;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
}

export interface verify_payment_data{
    reference: string
}

export interface dedicated_account_number_data {
    customer: string;
    preferred_bank: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}

export const initiate_payment = async (payment_data : initiate_payment_data) => {
    try {
        const amount = Math.round(payment_data.amount * 100);
        
        const response = await paystack_API.post('/transaction/initialize', {
            ...payment_data,
            amount
        })

    const currency = payment_data.currency?.toUpperCase() || 'USD';

          const user_email = payment_data.email;
    if (user_email) {
      await send_email({
        to: user_email,
        subject: 'Payment Initiated',
        html: `<p>Hello,</p>
               <p>Your payment of ${payment_data.amount} ${currency} has been initiated.</p>
               <p>Please complete your payment by visiting this <a href="${response.data.data.authorization_url}">payment link</a>.</p>
               <p>If you did not initiate this payment, please ignore this message or contact support.</p>`
      });
    }
        return response.data.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new customError(`Paystack payment initialization failed: ${error.response?.data?.message || error.message}`, 400);
        }
        throw new customError('Failed to initialize payment', 500);
    }
}


export const verify_payment = async (verify_data : verify_payment_data) => {
    try {
    const response = await paystack_API.get(`/transaction/verify/${verify_data.reference}`)
    const data= response.data.data;
        
    return {
      reference: data.reference ?? null,
      status: data.status ?? null,
      authorization_url: data.authorization_url ?? null,
    };
        
    } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new customError(`Payment verification failed: ${error.response?.data?.message || error.message}`, 400);
        }
        throw new customError('Failed to verify payment', 500);
      }
    };


  export const create_dedicated_account = async( dedicated_data: dedicated_account_number_data ) =>{
    try {
         // Step 1: Create the customer
         const customerResponse = await paystack_API.post('/customer', {
          email: dedicated_data.email,
          first_name: dedicated_data.firstName,
          last_name: dedicated_data.lastName,
          phone: dedicated_data.phoneNumber,
        });
        
        // Extract the customer code from the response
        const customerCode = customerResponse.data.data.customer_code;
        
        // Step 2: Create the Dedicated Virtual Account
        const response = await paystack_API.post('/dedicated_account', {
          customer: customerCode,
          preferred_bank: dedicated_data.preferred_bank, // e.g., 'wema-bank' or 'paystack-titan'
        });
        
        return response.data.data;
            
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new customError(`Payment verification failed: ${error.response?.data?.message || error.message}`, 400);
        }
        throw new customError('Failed to create an account', 500);
      }
    };


    export const list_banks = async (country = 'nigeria') =>{
        try {
         const response = await paystack_API.get(`/bank?country=${country}`)
         return response.data.data
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
              throw new customError(`Failed to fetch banks: ${error.response?.data?.message || error.message}`, 400);
            }
            throw new customError('Failed to fetch banks', 500);
          }
        };

    export const resolve_account_number = async (accountNumber: string, bankCode: string)=>{
        try{
        const response = await paystack_API.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        return response.data.data;

      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new customError(`Account resolution failed: ${error.response?.data?.message || error.message}`, 400);
        }
        throw new customError('Failed to resolve account number', 500);
      }
    }


    export const intiate_transfer = async (amount: number, recipient: string, reason?: string) =>{
        try {
            // Convert amount to kobo (for Naira)
            const amount_in_kobo = Math.round(amount * 100);
            
            const response = await paystack_API.post('/transfer', {
              source: 'balance',
              amount: amount_in_kobo,
              recipient,
              reason
            });
            
            return response.data.data;
          } catch (error) {
            if (axios.isAxiosError(error)) {
              throw new customError(`Failed to initiate transfer: ${error.response?.data?.message || error.message}`, 400);
            }
            throw new customError('Failed to initiate transfer', 500);
          }
        };

     
        export const transferRecipient = async (name: string, accountNumber: string, bankCode: string) => {
            try {
              const response = await paystack_API.post('/transferrecipient', {
                type: 'nuban',
                name,
                account_number: accountNumber,
                bank_code: bankCode,
                currency: 'NGN'
              });
              
              return response.data.data;
            } catch (error) {
              if (axios.isAxiosError(error)) {
                throw new customError(`Failed to create transfer recipient: ${error.response?.data?.message || error.message}`, 400);
              }
              throw new customError('Failed to create transfer recipient', 500);
            }
          };
    


          