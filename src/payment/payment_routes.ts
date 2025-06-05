import express from 'express';
import { auth_middleware } from '../shared/middleware/auth_middleware';
import { Payment_controllerr } from './payment.controller';
import { rawBodyMiddleware } from '../shared/middleware/raw_body_middleware';
import { intiate_payment_rate_limiter, webhook_rate_limiter } from '../shared/middleware/redis_rate_limits';


const router = express.Router();

// Protected routes
router.post('/initiate', auth_middleware, intiate_payment_rate_limiter, Payment_controllerr.intiate_payment);

router.post('/webhook/stripe',webhook_rate_limiter, rawBodyMiddleware, Payment_controllerr.handle_stripe_webhook);

router.post('/webhook/paystack',webhook_rate_limiter, express.json(), Payment_controllerr.handle_paystack_webhook);

router.get('/status/:transactionId', auth_middleware, Payment_controllerr.get_payment_status)

router.post('/status', auth_middleware, Payment_controllerr.process_successful_payment)




export default router;















