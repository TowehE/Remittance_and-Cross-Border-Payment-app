import express from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: {
        user_id: string;
        email?: string;
        
      };
    }
  }
}





