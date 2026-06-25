import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Auth rate limiter — applies to login, register, password reset endpoints.
 *
 * 20 attempts per 15 minutes per IP. Loose enough for legitimate users
 * (who rarely fail more than 2-3 times) but tight enough to stop credential
 * stuffing from a single IP. Botnets behind many IPs are not mitigated by
 * this — for that, add a WAF or Cloudflare in front of Render.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter login limiter — 5 attempts per 15 minutes per IP+email.
 * Stops targeted brute force against a single account even if the attacker
 * has many IPs. Uses `keyGenerator` to combine IP and email so that an
 * attacker cannot reset their counter by changing IP.
 *
 * IMPORTANT: We use `ipKeyGenerator(req)` (the library helper) instead of
 * `req.ip` directly. Without this, express-rate-limit v7+ throws
 * `ERR_ERL_KEY_GEN_IPV6` at module load time — it refuses to start the
 * server because a naive `req.ip` key allows IPv6 users to bypass limits
 * (each IPv6 address has 2^64 subnets that all resolve to the same client).
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ipKey = ipKeyGenerator(req.ip ?? '');
    const email = (req.body as { email?: string } | undefined)?.email?.toLowerCase().trim() ?? '';
    return `${ipKey}:${email}`;
  },
  message: {
    success: false,
    error: 'Too many login attempts for this account. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Generic API limiter — 300 requests per minute per IP.
 * Apply to any route that needs basic abuse protection but isn't auth.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});
