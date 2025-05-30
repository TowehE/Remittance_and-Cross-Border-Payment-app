
import { Request, Response, NextFunction } from 'express';
import * as rate_service from './rate.service';

// import { customError } from '../shared/middleware/error.middleware';
import { customError } from '../shared/middleware/error_middleware';

export const get_exchange_rate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceCurrency, targetCurrency } = req.params;
    
    if (!sourceCurrency || !targetCurrency) {
      throw new customError('Source and target currencies are required', 400);
    }
    
    const exchange_rate = await rate_service.get_exchange_rate(
      sourceCurrency.toUpperCase(),
      targetCurrency.toUpperCase()
    );
    
    res.status(200).json({
      status: 'success',
      data: exchange_rate
    });
  } catch (error) {
    next(error);
  }
};

export const calculate_amount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, sourceCurrency, targetCurrency , isLocalPayment} = req.body;
    
    if (!amount || !sourceCurrency || !targetCurrency || !isLocalPayment) {
      throw new customError('Amount, source currency, and target currency are required', 400);
    }
    
    const calculation = await rate_service.calculate_transfer_amount(
      parseFloat(amount),
      sourceCurrency.toUpperCase(),
      targetCurrency.toUpperCase(),
      isLocalPayment
    );
    
    res.status(200).json({
      status: 'success',
      data: calculation
    });
  } catch (error) {
    next(error);
  }
};

// export const getSupportedCurrencies = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const currencies = await rate_service.getSupportedCurrencies();
    
//     res.status(200).json({
//       status: 'success',
//       data: currencies
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateRates = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     // This could be protected by an admin middleware
//     const updatedRates = await rate_service.updateRates();
    
//     res.status(200).json({
//       status: 'success',
//       data: {
//         count: updatedRates.length,
//         rates: updatedRates
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };