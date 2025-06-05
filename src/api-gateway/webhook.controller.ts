// import { Request, Response } from 'express';
import { Request as ExpressRequest } from "express";
import { Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client';
import { PAYSTACK_WEBHOOK_SECRET, PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../shared/config';
import { process_successful_payment } from '../payment/payment.service';
import { send_email } from "../utilis/email";
import { transaction_queue } from "../rate/redis.service";


export interface RequestWithRawBody extends ExpressRequest {
  rawBody?: any;
}


const prisma = new PrismaClient();

const stripe = new Stripe(STRIPE_SECRET_KEY)

  // Handles Stripe webhook events on webhook endpoint
 export const handle_stripe_webhook_event = async (req: RequestWithRawBody, res: Response) => {
   let event: Stripe.Event;

  
  const signature = req.headers['stripe-signature'] as string;
  const rawBody = req.rawBody;

  // Check for missing components
  if (!signature) {
    console.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing Stripe signature or webhook secret.' });
  }

  if (!rawBody) {
    console.error('Missing raw body');
    return res.status(400).json({ error: 'Missing Stripe signature or webhook secret.' });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Missing webhook secret in environment variables');
    return res.status(400).json({ error: 'Missing Stripe signature or webhook secret.' });
  }

 
   try {
     event = stripe.webhooks.constructEvent(
       rawBody,
       signature,
       STRIPE_WEBHOOK_SECRET
     );
  

   } catch (err) {
     console.error('Stripe signature verification failed:', err);
     return res.status(400).json({ error: 'Invalid Stripe signature' });

      
   }
 try{
   switch (event.type) {
     case 'checkout.session.completed': {
       const session = event.data.object as Stripe.Checkout.Session;
       const transactionId = session.metadata?.transactionId;
     if (transactionId) {
  await transaction_queue.add('process-transaction', { transactionId });
}
      // send confirmation emailafter webhook has been processed
      const email = session.customer_details?.email || session.metadata?.email

      if(email) {
        await send_email({
          to: email,
           subject: 'Payment Successful',
        html: `<p>Hi,</p>
               <p>Your payment of ${session.amount_total! / 100} ${session.currency!.toUpperCase()} was successful.</p>
               <p>Transaction ID: ${transactionId}</p>
               <p>Thank you for using our service.</p>`

        })
      }
       break;
     }
 
     case 'payment_intent.succeeded': {
       const intent = event.data.object as Stripe.PaymentIntent;
       const transactionId = intent.metadata?.transactionId;
       if (transactionId) await process_successful_payment({ id: transactionId });
       break;
     }
  case 'charge.succeeded':
    break;
     case 'payment_intent.payment_failed': {
       const intent = event.data.object as Stripe.PaymentIntent;
       const transactionId = intent.metadata?.transactionId;
       if (transactionId) {
        await prisma.transaction.updateMany({
           where: { id: transactionId },
           data: { status: 'FAILED' },
         });
       }
       break;
     }
 
     default:

   } } catch (error) {
    console.error('Error handling Stripe event:', error);
    return res.status(500).json({ error: 'Webhook handler error' });
  }
 
   return res.status(200).json({ received: true });
 };


// Handles Paystack webhook events
export const handle_paystack_webhook_event = async (req: RequestWithRawBody, res: Response) => {
  try {
    const rawBody = req.rawBody;

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody ?? '')
      .digest("hex");
  
    if (hash !== req.headers['x-paystack-signature']) {
      console.error('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString());
 
    // Handle different Paystack events
    switch (event.event) {
      case 'charge.success': {
        const data = event.data;
        console.log(`Processing successful charge: ${data.reference}`);
        
        // Get transaction by payment reference
        const transaction = await prisma.transaction.findFirst({
          where: { paymentReference: data.reference }
        });
        
        if (transaction) {
          // await process_successful_payment({ id: transaction.id });
          await transaction_queue.add('process-transaction', { transactionId: transaction.id });


            const user = await prisma.user.findUnique({
            where: { id: transaction.senderId },
            });
            if(user?.email){
              await send_email({
                 to: user.email,
                    subject: 'Payment Successful',
                    html: `<p>Hi ${user.lastName } ${user.firstName || ''},</p>
                          <p>Your payment of ${transaction.sourceAmount} ${transaction.sourceCurrency} was successful.</p>
                          <p>Reference: ${transaction.paymentReference}</p>
                          <p>Thank you.</p>`
              })
            }
            

        } else {
          console.error(`Transaction not found for reference: ${data.reference}`);
        }
        break;
      }

      case 'transfer.failed': {
        const data = event.data;
        console.log(`Transfer failed: ${data.reference}, reason: ${data.reason}`);
        
        // Find and update transaction by reference
        const transaction = await prisma.transaction.findFirst({
          where: { paymentReference: data.reference }
        });
        
        if (transaction) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'FAILED', failureReason: data.reason }
          });
        }
        break;
      }
      
      case 'charge.failed': {
        const data = event.data;
        console.log(`Charge failed: ${data.reference}`);
        
        // Update transaction status to FAILED
        await prisma.transaction.updateMany({
          where: { paymentReference: data.reference },
          data: { status: 'FAILED', failureReason: data.gateway_response }
        });
        break;
      }
      
      default:
        console.log(`Unhandled Paystack event type: ${event.event}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Paystack webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};