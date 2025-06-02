import { Request, Response, NextFunction } from 'express';
import * as user_service from './user_service';
import { customError } from '../shared/middleware/error_middleware';
import { auth_middleware } from '../shared/middleware/auth_middleware';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, userType, country } = req.body;

    if (!email || !password || !firstName || !lastName || !userType) {
      throw new customError('Missing required fields', 400);
    }

    const result = await user_service.register_user({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      userType,
      country
    });

    
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};


export const login = async(req:Request, res: Response, next:NextFunction) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new customError('Email and password are required', 400);
    }
    
    const result = await user_service.login({ email, password });
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
  




export const update_user_profile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new customError('Authentication required', 401);
    }


    const updated_user = await user_service.update_user_profile(req.user.user_id, req.body);

    // Send success response
    res.status(200).json({
      status: 'success',
      data: updated_user
    });
  } catch (error) {
    // Pass the error to the next middleware (error handler)
    next(error);
  }
};



export const get_all_users = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Call service function to get all users
    const users = await user_service.get_all_users_admin();
    if (!users || users.length === 0) {
      res.status(200).json({
        status: 'success',
        data: []
      })
    }

    // Send success response
    res.status(200).json({
      status: 'success',
      data: users
    });
  } catch (error) {
    // Pass the error to the next middleware (error handler)
    next(error);
  }
};


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
    const updated_user = await user_service.fund_user_wallet(req.user.user_id, amount);

    
    // Send success response
    res.status(200).json({
      status: 'success',
      data: updated_user
    });
  } catch (error) {
    next(error);
  }
}