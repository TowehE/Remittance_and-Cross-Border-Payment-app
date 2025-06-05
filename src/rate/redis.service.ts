// src/rate-service/redis.service.ts
import { createClient } from 'redis';
import { REDIS_URL } from '../shared/config';
import Bull from "bull"

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


export const transaction_queue = new Bull('transaction_queue', REDIS_URL)

// Monitor successful job completion
transaction_queue.on('completed', (job) => {
  console.log(`Job ${job.id} [${job.name}] completed for transaction ${job.data.transactionId}`);
});

transaction_queue.on('failed', (job, err) => {
  console.error(`Job ${job.id} [${job.name}] failed for transaction ${job.data.transactionId}. Error: ${err.message}`);
});


export const get_cached_rate = async (sourceCurrency: string, targetCurrency: string) => {
  const cacheKey = `rate:${sourceCurrency}:${targetCurrency}`;
  const cachedRate = await redisClient.get(cacheKey);
  // console.log('Data being parsed:', cachedRate);
  return cachedRate ? cachedRate : null;
};

export const cache_rate = async (sourceCurrency: string, targetCurrency: string, data: any, expirationSeconds = 36000  ) => {
  const cacheKey = `rate:${sourceCurrency}:${targetCurrency}`;
  await redisClient.set(cacheKey, JSON.stringify(data), { EX: expirationSeconds });
};

export const clear_cache = async () => {
  await redisClient.flushAll();
};

async function gracefulShutdown() {
  console.log('Closing Redis client and Bull queue...');
  await transaction_queue.close();
  await redisClient.quit();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


















