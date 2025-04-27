import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

interface decoded_token {
  user_id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: decoded_token;
    }
  }
}

export const auth_middleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as decoded_token;
    req.user = decoded;
    console.log('Decoded token:', decoded);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
    return;
  }
};
