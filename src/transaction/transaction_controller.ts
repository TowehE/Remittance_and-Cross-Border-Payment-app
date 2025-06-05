import { Request, Response, NextFunction } from 'express';
import * as transaction_service from './transaction_service';
import { customError } from '../shared/middleware/error_middleware';
import { PrismaClient } from '@prisma/client';


export const fund_user_wallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // check if the user is authenticated
    if(!req.user){
      throw new customError('Authentication required', 400)
    }
  
    const amount = req.body.amount;

    if (!amount || amount <= 0) {
      throw new customError('A valid amount is required', 400);
    }
  
    // Call service function to fund user wallet
    const updated_user = await transaction_service.fund_user_wallet(req.user.user_id, amount);

    
    // Send success response
    res.status(200).json({
      status: 'success',
      data: updated_user
    });
  } catch (error) {
    next(error);
  }
}


export const check_wallet_balance = async (req: Request, res: Response, next: NextFunction) =>{
    try {
      const userId = (req as any).user?.id;
      const { accountNumber } = req.query;

      if (!userId) {
            throw new customError ("User not authorized", 400)
      }

      const result = await transaction_service.check_wallet_balance(userId, accountNumber as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
