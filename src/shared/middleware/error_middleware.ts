import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

export class customError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error | customError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof customError ? err.statusCode : 500;
  
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};



export const redisClient = createClient({ url: process.env.REDIS_URL });

(async () => {
  await redisClient.connect();
})();

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});