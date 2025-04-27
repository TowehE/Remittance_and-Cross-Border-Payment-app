import { Request, Response } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../shared/config';
import { process_successful_payment } from '../payment-service/payment.service';
import { customError } from '../shared/middleware/error_middleware';

export interface RequestWithRawBody extends Request {
    rawBody?: Buffer; // Make it optional and only accept Buffer type
  }
const prisma = new PrismaClient();
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil'
});

// Handles Stripe webhook events
export const handle_stripe_webhook_event = async (req: Request, res: Response) => {
  let event: Stripe.Event;
  
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe signature or webhook secret');
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    // Use the raw body captured by middleware with type assertion
    const reqWithRaw = req as RequestWithRawBody;
    if (!reqWithRaw.rawBody) {
      console.error('Raw body not available for Stripe signature verification');
      return res.status(400).json({ error: 'Raw body not available' });
    }
    
    try {
      event = stripe.webhooks.constructEvent(
        reqWithRaw.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`Received Stripe webhook event: ${event.type}`);

    // Handle different Stripe events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.transactionId) {
          console.log(`Processing successful payment for transaction: ${session.metadata.transactionId}`);
          await process_successful_payment({ id: session.metadata.transactionId });
        } else {
          console.error('TransactionId missing in session metadata');
        }
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        if (paymentIntent.metadata?.transactionId) {
          console.log(`Processing successful payment intent for transaction: ${paymentIntent.metadata.transactionId}`);
          await process_successful_payment({ id: paymentIntent.metadata.transactionId });
        } else {
          console.error('TransactionId missing in payment intent metadata');
        }
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentFailure = event.data.object as Stripe.PaymentIntent;
        
        if (paymentFailure.metadata?.transactionId) {
          console.log(`Payment failed for transaction: ${paymentFailure.metadata.transactionId}`);
          // Update transaction status to FAILED
          await prisma.transaction.updateMany({
            where: { id: paymentFailure.metadata.transactionId },
            data: { status: 'FAILED' }
          });
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
};

// Handles Paystack webhook events
export const handle_paystack_webhook_event = async (req: Request, res: Response) => {
  try {
    // Verify the Paystack webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
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