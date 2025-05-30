import express from 'express';
import { auth_middleware } from '../shared/middleware/auth_middleware';
import { Payment_controllerr } from './payment.controller';
import { rawBodyMiddleware } from '../shared/middleware/raw_body_middleware';


const router = express.Router();

// Protected routes
router.post('/initiate', auth_middleware, Payment_controllerr.intiate_payment);

// router.post(
//     '/webhook/stripe', 
//     raw_body_middleware,
//     (req, res, next) => Payment_controllerr.handle_stripe_webhook(req, res, next)
//   );
router.post('/webhook/stripe', rawBodyMiddleware, Payment_controllerr.handle_stripe_webhook);

router.post('/webhook/paystack', express.json(), Payment_controllerr.handle_paystack_webhook);

router.get('/status/:transactionId', auth_middleware, Payment_controllerr.get_payment_status)

router.post('/status', auth_middleware, Payment_controllerr.process_successful_payment)




export default router;