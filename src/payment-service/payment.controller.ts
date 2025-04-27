import { Request, Response, NextFunction } from 'express';
import * as payment_service from './payment.service';
import * as paystack_service from '../api-gateway/paystack.integration';
import { customError } from '../shared/middleware/error_middleware';

export const intiate_payment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new customError('Authentication required', 401);
    }
    
    const { amount, currency, targetCurrency, receiverId , receiverAccountNumber } = req.body;
    
    if (!amount || !currency || !targetCurrency || (!receiverId && !receiverAccountNumber)) {
      throw new customError('Missing required fields', 400);
    }
    
    const result = await payment_service.intiate_remittance_payment({
      userId: req.user.user_id,
      amount,
      currency,
      targetCurrency,
      receiverId,
      receiverAccountNumber
    //   callbackUrl
    });
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};