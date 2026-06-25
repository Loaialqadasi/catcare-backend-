// CSRF protection setup — extracted from app.ts to avoid circular imports
// (routes can import this without importing the entire app)

import { doubleCsrf } from 'csrf-csrf';
import crypto from 'node:crypto';
import { env } from './env.js';
import { Request, Response } from 'express';

// Cross-origin CSRF cookies (Vercel ↔ Render) require:
// 1. sameSite: 'none'  — allows the cookie to be sent with cross-origin requests
// 2. secure: true      — required by browsers when sameSite is 'none'
//
// NOTE: `partitioned` was removed — it caused session drops on hard navigation
// in some browsers (the cookie would be scoped to the top-level site and
// invisible on cross-origin requests after a redirect). sameSite:'none' +
// secure is sufficient for cross-origin cookie flow.
//
// IMPORTANT: `secure: true` only works if Express trusts the reverse proxy
// (see `app.set('trust proxy', 1)` in app.ts). Without trust proxy, Express
// sees req.protocol as 'http' and REFUSES to set Secure cookies, which causes
// browsers to reject SameSite=None cookies entirely.
const isProd = env.NODE_ENV === 'production';

// C-2 FIX: Use a per-session identifier instead of the hardcoded "catcare-utm".
// Each user/browser gets a unique CSRF token, preventing cross-user CSRF attacks.
//
// The csrf-csrf library v4 calls getSessionIdentifier(req) — only req is available.
// For authenticated users, we use their user ID (set by authMiddleware).
// For unauthenticated users, we use a per-browser random ID stored in a cookie.
export const SESSION_ID_COOKIE = 'catcare-session-id';

// Helper: generate a new session ID and set the cookie on the response.
// Called from the /api/csrf-token endpoint where we have access to res.
export function ensureSessionCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[SESSION_ID_COOKIE];
  if (existing && typeof existing === 'string' && existing.length >= 16) {
    return existing;
  }
  const newId = crypto.randomBytes(32).toString('hex');
  res.cookie(SESSION_ID_COOKIE, newId, {
    sameSite: isProd ? 'none' as const : 'lax' as const,
    path: '/',
    secure: isProd,
    httpOnly: false, // Must be readable by the browser for CSRF double-submit
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return newId;
}

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET || env.JWT_SECRET,
  getSessionIdentifier: (req: Request): string => {
    // 1. If the user is authenticated (req.user set by authMiddleware), use their user ID.
    //    This provides the strongest CSRF binding: each user has their own token.
    if (req.user?.id) {
      return `user-${req.user.id}`;
    }

    // 2. For unauthenticated requests, use the per-browser session ID cookie.
    //    This prevents all unauthenticated users from sharing the same CSRF token.
    const sessionId = req.cookies?.[SESSION_ID_COOKIE];
    if (sessionId && typeof sessionId === 'string' && sessionId.length >= 16) {
      return sessionId;
    }

    // 3. Fallback: a default identifier for first-time visitors who don't have
    //    the session cookie yet. The /api/csrf-token endpoint will set it.
    //    This is better than the old hardcoded "catcare-utm" because it's
    //    temporary — the next request will have the cookie.
    return 'anonymous';
  },
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: isProd ? 'none' as const : 'lax' as const,
    path: '/',
    secure: isProd,
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'] as const,
});

export { generateCsrfToken, doubleCsrfProtection as csrfProtection };
