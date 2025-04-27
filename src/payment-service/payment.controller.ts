import { Request, Response, NextFunction } from 'express';
import * as payment_service from './payment.service';
import * as paystack_service from '../api-gateway/paystack.integration';
import { customError } from '../shared/middleware/error_middleware';
// import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client'
import { handle_paystack_webhook_event, handle_stripe_webhook_event } from '../api-gateway/webhook.controller';

const prisma = new PrismaClient();


class PaymentController {
  async intiate_payment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new customError('Authentication required', 401);
      }
      
      const { amount, currency, targetCurrency, receiverId, receiverAccountNumber } = req.body;
      
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
      });
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async process_successful_payment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.body.session;
      
      if (!id) {
        throw new customError('Missing session ID', 400);
      }
      
      await payment_service.process_successful_payment({ id });
      
      res.status(200).json({
        status: 'success',
        message: 'Payment processed successfully' 
      });
    } catch (error) {
      next(error);
    }
  }


  async handle_stripe_webhook(req: Request, res: Response, next: NextFunction) {
    try {
      await handle_stripe_webhook_event(req, res);
 
    } catch (error) {
   
      console.error('Error in stripe webhook:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Webhook error' });
      }
    }
  }

  async handle_paystack_webhook(req: Request, res: Response) {
    await handle_paystack_webhook_event(req, res);
  }

  async get_payment_status(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        throw new customError('Missing transaction ID', 400);
      }
      
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          status: true,
          sourceAmount: true,
          sourceCurrency: true,
          targetAmount: true,
          targetCurrency: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (!transaction) {
        throw new customError('Transaction not found', 404);
      }
      
      res.status(200).json({
        status: 'success',
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }

  }




// Export a
export const Payment_controllerr = new PaymentController();