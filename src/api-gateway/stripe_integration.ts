import { Request } from 'express';
import Stripe from 'stripe'
import { STRIPE_SECRET_KEY } from '../shared/config'
import { customError } from '../shared/middleware/error_middleware';
import { send_email } from '../utilis/email';


const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
    const base_url = APP_BASE_URL;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil'
  })

export interface stripe_customer_params{
    // customerId: string;
    email: string;
    name: string;
    phone?: string | null;
    // amount: number;
    metadata?: Record<string, string>;
}


export interface create_payment_intent_data {
  amount: number;
  currency: string;
  name: string;
  email: string;
  customerId: string;
  description: string;
  metadata?: Record<string, any>; 
  successUrl?: string;  
  cancelUrl?: string;
}

export interface create_payout_data {
  amount: number;
  currency: string;
  destination: string;
  description: string;
}

export const create_stripe_account = async (params:stripe_customer_params)=>{
    try {
      const create_params: Stripe.CustomerCreateParams = {
        email: params.email,
        name: params.name,
        metadata: params.metadata || {
          source: 'remittance_platform',
        },
      };
         // Only add phone if it exists
    if (params.phone) {
      create_params.phone = params.phone;
    }

    const customer = await stripe.customers.create(create_params);
    return customer;

    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw error;
      }
    };

    export const create_payment_intent = async (params: create_payment_intent_data) => {
      try {
        const payment_intent = await stripe.paymentIntents.create({
          amount: Math.round(params.amount * 100),
          currency: params.currency.toLowerCase(),
          customer: params.customerId,
          description: params.description,
          metadata: params.metadata,
          payment_method_types: ['card'],
          setup_future_usage: 'off_session',
        });
    
        return payment_intent;
      } catch (error) {
        throw new customError('Failed to create payment intent with Stripe', 500);
      }
    };




    export const create_payout = async (data: create_payout_data) => {
      try {
        const payout = await stripe.payouts.create({
          amount: Math.round(data.amount * 100),
          currency: data.currency.toLowerCase(),
          destination: data.destination,
          description: data.description,
        });
    
        return payout;
      } catch (error) {
        throw new customError('Failed to create payout with Stripe', 500);
      }
    };


export const create_payment_session = async (params: create_payment_intent_data, req: Request) => {
  try {
    const amountInSmallestUnit = Math.round(params.amount * 100);


    const successUrl = params.successUrl || `${base_url}/success`;
    const cancelUrl = params.cancelUrl || `${base_url}/cancel`;

    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.description || 'Money Transfer',
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: params.metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    if (!session.url) {
      console.error('Stripe session URL is undefined', session);
      throw new customError('Failed to get payment URL from Stripe', 500);
    }

     const user_email = params.metadata?.user_email;
     console.log('User email for payment:', user_email);

    if (user_email) {
      await send_email({
        to: user_email,
        subject: 'Payment Initiated',
        html: `<p>Hello,</p>
               <p>Your payment of ${params.amount} ${params.currency.toLowerCase()} has been initiated.</p>
               <p>Please complete your payment by visiting this <a href="${session.url}">payment link</a>.</p>
               <p>If you did not initiate this payment, please ignore this message or contact support.</p>`
      });
    }

    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['payment_intent'],
  });

    const paymentIntentId = 
  typeof fullSession.payment_intent === 'string' 
    ? fullSession.payment_intent 
    : fullSession.payment_intent?.id ?? null;

return {
  id: fullSession.id,
  authorization_url: fullSession.url ?? '',
  status: fullSession.status,
  reference: fullSession.id,
  payment_intent: paymentIntentId,
};

  } catch (error) {
    console.error('Stripe payment session error:', error);
    throw new customError('Failed to create payment session with Stripe', 500);
  }
};



export const verify_payment = async (reference: string) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(reference);
    
    return {
      status: session.payment_status === 'paid' ? 'success' : 'failed',
      data: {
        reference: session.id,
        amount: session.amount_total ? session.amount_total / 100 : 0, 
        currency: session.currency,
        customer: session.customer,
        metadata: session.metadata
      }
    };
  } catch (error) {
    console.error('Stripe payment verification error:', error);
    throw new customError('Failed to verify payment with Stripe', 500);
  }
};