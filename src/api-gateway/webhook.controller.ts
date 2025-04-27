// import { Request, Response } from 'express'; 
// import crypto from 'crypto';
// import { buffer } from 'micro';
// import Stripe from 'stripe';
// import { PrismaClient } from '@prisma/client';
// import { PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET } from '../shared/config';
// import { process_successful_payment } from '../payment-service/payment.service';
// import { customError } from '../shared/middleware/error_middleware';

// const prisma = new PrismaClient(); 
// const stripe = new Stripe(STRIPE_SECRET_KEY, { 
//   apiVersion: '2025-03-31.basil' 
// });

// // Handles Stripe webhook events
// export const handleStripeWebhook = async (req: Request, res: Response) => {
//   let event: Stripe.Event;
  
//   try {
//     const signature = req.headers['stripe-signature'] as string;
//     const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    
//     // Verify the Stripe webhook signature
//     if (!signature || !STRIPE_WEBHOOK_SECRET) {
//       console.error('Missing Stripe signature or webhook secret');
//       return res.status(400).json({ error: 'Missing signature or webhook secret' });
//     }

//     const rawBody = await buffer(req);
    
//     // Verify the event with Stripe
//     try {
//       event = stripe.webhooks.constructEvent(
//         rawBody.toString(),
//         signature,
//         STRIPE_WEBHOOK_SECRET
//       );
//     } catch (err) {
//       console.error('Stripe webhook signature verification failed:', err);
//       return res.status(400).json({ error: 'Invalid signature' });
//     }

//     console.log(`Received Stripe webhook event: ${event.type}`);

//     // Handle different Stripe events
//     switch (event.type) {
//       case 'checkout.session.completed':
//         const session = event.data.object as Stripe.Checkout.Session;
//         // Handle successful payment
//         break;
//       case 'payment_intent.succeeded':
//         const paymentIntent = event.data.object as Stripe.PaymentIntent;
//         // Handle successful payment intent
//         break;
//       case 'payment_intent.payment_failed':
//         const paymentFailure = event.data.object as Stripe.PaymentIntent;
//         // Handle payment failure
//         break;
//       default:
//         console.log(`Unhandled event type: ${event.type}`);
//     }

//     res.status(200).send('Event received');
//   } catch (error) {
//     console.error('Error handling Stripe webhook:', error);
//     res.status(500).send('Webhook error');
//   }
// };

// // Handles Paystack webhook events
// export const handlePaystackWebhook = async (req: Request, res: Response) => {
//   try {
//     // Verify the Paystack webhook signature
//     const hash = crypto
//       .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
//       .update(JSON.stringify(req.body))
//       .digest('hex');
    
//     if (hash !== req.headers['x-paystack-signature']) {
//       console.error('Invalid Paystack webhook signature');
//       return res.status(400).json({ error: 'Invalid signature' });
//     }

//     const event = req.body;
//     console.log(`Received Paystack webhook event: ${event.event}`);

//     // Handle different Paystack events
//     switch (event.event) {
//       case 'charge.success': {
//         const data = event.data;
//         console.log(`Processing successful charge: ${data.reference}`);
//         await process_successful_payment({ id: data.reference });
//         break;
//       }

//       case 'transfer.failed': {
//         const data = event.data;
//         console.log(`Transfer failed: ${data.reference}, reason: ${data.reason}`);
        
//         // Update the corresponding transaction status if needed
//         break;
//       }
      
//       case 'charge.failed': {
//         const data = event.data;
//         console.log(`Charge failed: ${data.reference}`);
//         // Update transaction status to FAILED
//         await prisma.transaction.updateMany({
//           where: { paymentReference: data.reference },
//           data: { status: 'FAILED' }
//         });
//         break;
//       }
//       default:
//         console.log(`Unhandled Paystack event type: ${event.event}`);
//     }

//     res.status(200).json({ received: true });
//   } catch (error) {
//     console.error('Error processing Paystack webhook:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

// // Helper function to verify Paystack webhook signature
// export const verifyPaystackSignature = (req: Request): boolean => {
//   try {
//     const signature = req.headers['x-paystack-signature'] as string;
//     if (!signature) return false;
    
//     const hash = crypto
//       .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
//       .update(JSON.stringify(req.body))
//       .digest('hex');
    
//     return hash === signature;
//   } catch (error) {
//     console.error('Error verifying Paystack signature:', error);
//     return false;
//   }
// };
