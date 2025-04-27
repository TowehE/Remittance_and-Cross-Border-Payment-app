
import express from 'express';
import * as rate_controller from './rate.controller';

const router = express.Router();

// Public routes
// router.get('/currencies', rate_controller.getSupportedCurrencies);
router.get('/:sourceCurrency/:targetCurrency', rate_controller.get_exchange_rate);

// Calculate transfer amount with fees
router.post('/calculate', rate_controller.calculate_amount);

// This route could be protected for admins only
// router.post('/update', rate_controller.updateRates);

export default router;