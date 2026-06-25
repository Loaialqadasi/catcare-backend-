import pino from 'pino';
import { env } from './env.js';

// MED-10 Fix: Support log aggregation in production via Logtail or similar
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV === 'production' && env.LOGTAIL_TOKEN ? {
    transport: {
      target: '@logtail/pino',
      options: { sourceToken: env.LOGTAIL_TOKEN }
    }
  } : {}),
});
