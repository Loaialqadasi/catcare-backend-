import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { logger } from './logger.js';
import { success } from './response.js';
import { errorHandler } from './error.middleware.js';
import { notFoundHandler } from './not-found.middleware.js';
import { generateCsrfToken, csrfProtection, ensureSessionCookie } from './csrf.js';
import { authRoutes } from '../Layth_Amgad-CCU-S1-01-Auth/auth.routes.js';
import { optionalAuthMiddleware } from '../Layth_Amgad-CCU-S1-01-Auth/auth.middleware.js';
import { catsRoutes } from '../Loai_Rafaat-CCU-S1-02-Cats/cats.routes.js';
import { emergenciesRoutes } from '../Youssef_Mostafa-CCU-S1-03-Emergencies/emergencies.routes.js';
import { donationsRoutes } from '../Layth_Amgad-CCU-S1-28-Donations/donations.routes.js';
import { mapRoutes } from '../Mohamed_Amgad-CCU-S1-04-Map/map.routes.js';
import { volunteersRoutes } from './volunteers.routes.js';
import { db } from './database.js';
import { getStorageStatus, ensureBucketExists } from './supabase-storage.js';

const app = express();

// CRIT-FIX: Trust the reverse proxy used by Render (and other cloud hosts).
// Without this, Express sees req.protocol as 'http' (because the proxy
// terminates TLS), which prevents `secure: true` cookies from being set.
// Browsers reject SameSite=None cookies that lack the Secure flag, so
// the CSRF cookie and JWT cookies were NEVER stored — causing 403 errors
// on every state-changing request from the Vercel frontend.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// skip HTTP logging in tests to keep output clean
if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp());
}

// MED-03 Fix: CORS multi-origin support (comma-separated env var)
const allowedOrigins = env.CORS_ORIGIN.split(',').map(u => u.trim()).filter(Boolean);

// MIN-08 Fix: Add Content-Security-Policy via Helmet
// MED-03: CSP connect-src includes all allowed CORS origins
// CRIT-FIX: Disable CSP on API responses — CSP is a browser-enforced header
// that only makes sense for HTML pages. On an API it has no effect except
// potentially confusing preflight checks. The frontend (Next.js) should set
// its own CSP.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-side)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // H-4 FIX: Only allow Vercel preview deployments from the project's specific subdomain
      // Previously: any *.vercel.app was allowed — this was too permissive.
      // Now: only allow the specific CatCare Vercel deployment domains
      if (origin.match(/catcare-utm.*\.vercel\.app$/)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true, // Required for HttpOnly cookie support
  })
);

// CRIT-1 Fix: Parse cookies for HttpOnly JWT
app.use(cookieParser());

// CRIT-4: CSRF protection — defined in csrf.ts (shared with routes that need per-route CSRF)
// See csrf.ts for the doubleCsrf configuration

// MED-01 Fix: Global rate limiter for all endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});
app.use(globalLimiter);

// MED-06 Fix: Request timeout — 30 seconds (increased for file uploads)
app.use((req, res, next) => {
  const timeout = req.path.includes('/cats') || req.path.includes('/donations') ? 30000 : 10000;
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: { code: 'TIMEOUT', message: 'Request timed out' } });
    }
  });
  next();
});

// 2mb limit to prevent abuse (increased from 1mb for better compatibility)
app.use(express.json({ limit: '2mb' }));



// quick health check for monitoring (includes DB connectivity check)
app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    return success(res, { status: 'ok', service: 'catcare-utm-api', db: 'connected' });
  } catch {
    return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database disconnected' } });
  }
});

// Storage health check — diagnose Supabase Storage connectivity
app.get('/api/health/storage', async (_req, res) => {
  const storageStatus = await getStorageStatus();
  const statusCode = storageStatus.connected && storageStatus.bucketExists && storageStatus.bucketPublic ? 200 : 503;
  return res.status(statusCode).json({ success: statusCode === 200, data: storageStatus });
});

// CRIT-4: CSRF token endpoint — frontend calls this to obtain a token
// C-2 FIX: Also ensure the per-browser session ID cookie is set
// IMPORTANT: optionalAuthMiddleware sets req.user if a valid JWT cookie exists,
// so the CSRF token is generated with the user's ID as the session identifier.
// This matches the identifier used when CSRF is validated on subsequent
// authenticated requests (via authMiddleware + csrfProtection), preventing
// "CSRF_INVALID" 403 errors caused by session identifier mismatch.
app.get('/api/csrf-token', optionalAuthMiddleware, (req, res) => {
  try {
    ensureSessionCookie(req, res);
    const token = generateCsrfToken(req, res);
    if (!token) {
      logger.warn('CSRF token generation returned empty string — check CSRF_SECRET or JWT_SECRET env vars');
    }
    return res.json({ success: true, data: { token } });
  } catch (err) {
    logger.error({ err }, 'CSRF token generation failed');
    return res.json({ success: true, data: { token: '' } });
  }
});

// CRIT-4: CSRF protection enforced on all state-changing routes.
// /api/auth is intentionally excluded — login/register happen before a CSRF token exists.
// However, admin auth routes (user management) do need CSRF — applied per-route in auth.routes.ts
//
// IMPORTANT: optionalAuthMiddleware runs before csrfProtection so that req.user is
// available for getSessionIdentifier(). This ensures the CSRF token is validated
// with the same session identifier (user ID) it was generated with.
app.use('/api/cats', optionalAuthMiddleware, csrfProtection);
app.use('/api/emergencies', optionalAuthMiddleware, csrfProtection);
app.use('/api/donations', optionalAuthMiddleware, csrfProtection);
app.use('/api/map', optionalAuthMiddleware, csrfProtection);
app.use('/api/volunteers', optionalAuthMiddleware, csrfProtection);

// mount each team member's routes
app.use('/api/auth', authRoutes);
app.use('/api/cats', catsRoutes);
app.use('/api/emergencies', emergenciesRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/volunteers', volunteersRoutes);

// catch-all: 404 then error handler
app.use(notFoundHandler);
app.use(errorHandler);

// Auto-create Supabase bucket on startup (non-blocking)
ensureBucketExists().catch(() => {});

export default app;
