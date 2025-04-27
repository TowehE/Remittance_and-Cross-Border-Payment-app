import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 2345;
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-toweh';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
export const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const STRIPE_SECRET_KEY= process.env.STRIPE_SECRET_KEY || '';
export const EXCHANGE_RATE_BASE_URL= process.env.EXCHANGE_RATE_BASE_URL || '';
