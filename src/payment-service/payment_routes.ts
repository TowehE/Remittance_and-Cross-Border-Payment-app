import express from 'express';
import * as payment_controller from './payment.controller';
import { auth_middleware } from '../shared/middleware/auth_middleware';

const router = express.Router();

// Protected routes
router.post('/initiate', auth_middleware, payment_controller.intiate_payment);


export default router;