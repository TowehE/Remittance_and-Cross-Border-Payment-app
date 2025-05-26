// src/rate-service/redis.service.ts
import { createClient } from 'redis';
import { REDIS_URL } from '../shared/config';

export const redisClient = createClient({ url: REDIS_URL });

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully');
  } catch (error) {
    console.error('Redis connection error:', error);
  }
})();


// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});



export const get_cached_rate = async (sourceCurrency: string, targetCurrency: string) => {
  const cacheKey = `rate:${sourceCurrency}:${targetCurrency}`;
  const cachedRate = await redisClient.get(cacheKey);
  // console.log('Data being parsed:', cachedRate);
  return cachedRate ? cachedRate : null;
};

export const cache_rate = async (sourceCurrency: string, targetCurrency: string, data: any, expirationSeconds = 36000  ) => {
  const cacheKey = `rate:${sourceCurrency}:${targetCurrency}`;
  await redisClient.set(cacheKey, JSON.stringify(data), {
    EX: expirationSeconds
  });
};

export const clear_cache = async () => {
  await redisClient.flushAll();
};