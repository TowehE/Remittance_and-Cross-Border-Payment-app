// import { Request, Response } from 'express';
import { Request as ExpressRequest } from "express";
import { Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client';
import { PAYSTACK_WEBHOOK_SECRET, PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../shared/config';
import { process_successful_payment } from '../payment-service/payment.service';

export interface RequestWithRawBody extends ExpressRequest {
  rawBody?: any;
}


const prisma = new PrismaClient();
const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil'
  });
  
  // Handles Stripe webhook events
 export const handle_stripe_webhook_event = async (req: RequestWithRawBody, res: Response) => {
   let event: Stripe.Event;
 
   const signature = req.headers['stripe-signature'] as string;
  //  const reqWithRaw = req as RequestWithRawBody;
  // Access the raw body
  const rawBody = req.rawBody;

 
   if (!signature || !rawBody || !STRIPE_WEBHOOK_SECRET) {
     return res.status(400).json({ error: 'Missing signature, raw body, or secret' });
   }
   console.log("signature", signature)
   console.log("this is stripe webhook secret", STRIPE_WEBHOOK_SECRET)
   console.log("this is your req body", rawBody)
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
       if (transactionId) await process_successful_payment({ id: transactionId });
       break;
     }
 
     case 'payment_intent.succeeded': {
       const intent = event.data.object as Stripe.PaymentIntent;
       const transactionId = intent.metadata?.transactionId;
       if (transactionId) await process_successful_payment({ id: transactionId });
       break;
     }
 
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

       console.log('Unhandled event type:', event.type);
   } } catch (error) {
    console.error('Error handling Stripe event:', error);
    // Respond 500, or 200 to avoid webhook retries if you prefer
    return res.status(500).json({ error: 'Webhook handler error' });
  }
 
   return res.status(200).json({ received: true });
 };


// Handles Paystack webhook events
// Handles Paystack webhook events
export const handle_paystack_webhook_event = async (req: RequestWithRawBody, res: Response) => {
  try {
    const rawBody = req.rawBody;
    // Verify the Paystack webhook signature
    // const hash = crypto
    //   .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    //   .update(JSON.stringify(req.body))
    //   .digest('hex');


    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody ?? '')
      .digest("hex");
      console.log("Raw Body:", rawBody);
      console.log("Paystack Webhook Secret:", PAYSTACK_SECRET_KEY);
      console.log("Computed Hash:", hash);
      console.log("Request Body:", req.body);
      console.log("Request Headers:", req.headers);
    
    if (hash !== req.headers['x-paystack-signature']) {
      console.error('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log(`Received Paystack webhook event: ${event.event}`);

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
          await process_successful_payment({ id: transaction.id });
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