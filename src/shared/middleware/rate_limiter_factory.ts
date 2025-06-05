import { createClient } from "redis";
import { REDIS_URL } from "../config";
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';


export const redisClient = createClient({ url: REDIS_URL });
redisClient.connect().catch((err) => {
  console.error('Redis connection error:', err);
});


type rate_limit_options = {
  keyPrefix: string;
  points: number;
  duration: number;
};

export const create_rate_limit_middleware = ({
  keyPrefix,
  points,
  duration,
}: rate_limit_options) => {
  const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix,
    points,
    duration,
  });

return async (req: Request, res: Response, next: NextFunction) => {
     const key = (req as any).user?.id || req.ip

    try {
      await rateLimiter.consume(key);
      next();
    } catch {
      res.status(429).json({
        message: 'Too many requests. Please try again later.',
      });
    }
  };
};
