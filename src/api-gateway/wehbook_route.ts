import express from 'express';
import { Payment_controllerr } from '../payment/payment.controller';

const router = express.Router();

// Apply raw body middleware BEFORE JSON parsing ONLY for Stripe
router.post('/stripe', Payment_controllerr.handle_stripe_webhook);

// JSON body parsing is fine for Paystack
router.post('/paystack', Payment_controllerr.handle_paystack_webhook);

export default router;
