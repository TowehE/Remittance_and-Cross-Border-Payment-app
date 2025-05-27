import express from 'express';
import { Request } from 'express';  

declare global {
  namespace Express {
    interface Request {
      rawBody?: any;
      user?: {
        user_id: string;
        email?: string;
        
      };
    }
  }
}
