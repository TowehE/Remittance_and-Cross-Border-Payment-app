import { create_rate_limit_middleware } from "./rate_limiter_factory";

export const intiate_payment_rate_limiter = create_rate_limit_middleware({
  keyPrefix: 'remittance_limit',
  points: 5,
  duration: 15 * 60, 
});

export const login_rate_limiter = create_rate_limit_middleware({
  keyPrefix: 'login_limit',
  points: 5,
  duration: 60 * 5, 
});

export const status_check_rate_limiter = create_rate_limit_middleware({
  keyPrefix: 'status_limit',
  points: 30,
  duration: 60, 
});

export const balance_check_rate_limiter = create_rate_limit_middleware({
  keyPrefix: 'balance_limit',
  points: 20,
  duration: 60,
});

export const webhook_rate_limiter = create_rate_limit_middleware({
  keyPrefix: 'webhook_limit',
  points: 100,
  duration: 60,
});
