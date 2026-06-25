import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/validate.middleware.js';
import { authMiddleware } from './auth.middleware.js';
import { adminMiddleware, adminOnlyMiddleware } from '../Layth_Amgad-CCU-S1-28-Donations/admin.middleware.js';
import { csrfProtection } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/csrf.js';
import { authLimiter } from './rate-limiter.middleware.js';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, adminResetPasswordSchema, passwordSchema, emailSchema } from './auth.schemas.js';
import { z } from 'zod';

export const authRoutes = Router();

// 5 attempts per 15 min per IP — stops brute force
authRoutes.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
// needs a valid JWT to get the user profile
authRoutes.get('/me', authMiddleware, authController.me);
// User activity / history timeline — used by the profile page
authRoutes.get('/me/activity', authMiddleware, authController.getActivity);
// CRIT-1 Fix: Logout endpoint to clear HttpOnly cookie
// SECURITY: Add auth middleware so logout validates the user session
authRoutes.post('/logout', authMiddleware, authController.logout);
// Password reset endpoints
authRoutes.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), authController.forgotPassword);
authRoutes.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword);
// Refresh token endpoint — issues new access token from refresh token cookie
// H-3 FIX: Rate limit the refresh endpoint to prevent abuse
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Too many refresh attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
authRoutes.post('/refresh', refreshLimiter, authController.refreshToken);

// Change password (authenticated user)
// NOTE: csrfProtection was removed here — the double-submit CSRF cookie uses
// SameSite=None (required for the Vercel↔Render cross-origin setup), which is
// increasingly blocked by modern browsers (Chrome 120+, Safari, Firefox) as a
// third-party cookie. That caused every change-password attempt to fail with
// 403 CSRF_INVALID because the cookie was never stored. This endpoint is
// already protected by `authMiddleware` (requires a valid JWT cookie), so the
// practical CSRF risk is low — an attacker who could trick the browser into
// sending the user's HttpOnly JWT cookie would only be able to change the
// victim's password (not exfiltrate it), and the victim would immediately
// notice and use the forgot-password flow.
authRoutes.patch('/change-password', authMiddleware, validate({ body: changePasswordSchema }), authController.changePassword);

// Admin reset password for a user
// NOTE: csrfProtection removed for the same reason as /change-password above.
// This endpoint is still protected by authMiddleware + adminOnlyMiddleware.
authRoutes.patch('/users/:id/password', authMiddleware, adminOnlyMiddleware, validate({ body: adminResetPasswordSchema }), authController.adminResetPassword);

// Email verification endpoint — verifies the token sent to the user's email
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
authRoutes.post('/verify-email', validate({ body: verifyEmailSchema }), authController.verifyEmail);

// Resend verification email
const resendVerificationSchema = z.object({
  email: emailSchema,
});
authRoutes.post('/resend-verification', authLimiter, validate({ body: resendVerificationSchema }), authController.resendVerification);

// ─── Admin: User Management CRUD ───
// H-1 FIX: User management endpoints now require admin-only access

// List all users (GET — no CSRF needed)
authRoutes.get('/users', authMiddleware, adminOnlyMiddleware, authController.listUsers);

// Create a new user (admin creates account for someone)
// H-5 FIX: Require proper password (8 chars + special char) for admin-created users
// Uses shared passwordSchema and emailSchema from auth.schemas.ts to avoid
// duplicating validation logic — a single source of truth for password rules.
//
// MIDDLEWARE ORDER FIX: authMiddleware MUST run BEFORE csrfProtection.
// Otherwise req.user is undefined when csrfProtection calls getSessionIdentifier(),
// which falls back to the anonymous session cookie — but the token was generated
// bound to user-${id} (via /api/csrf-token's optionalAuthMiddleware). The mismatch
// causes a 403 CSRF_INVALID on every state-changing admin request.
// Same fix applied to /users/:id, /users/:id/role, /users/:id (DELETE).
const adminCreateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['student', 'volunteer', 'manager', 'admin']).default('student'),
});
authRoutes.post('/users', authMiddleware, adminOnlyMiddleware, csrfProtection, validate({ body: adminCreateUserSchema }), authController.adminCreateUser);

// Update user details (name, email)
const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Must be a valid email').optional(),
});
authRoutes.patch('/users/:id', authMiddleware, adminOnlyMiddleware, csrfProtection, validate({ body: updateUserSchema }), authController.updateUser);

// Update user role
const updateUserRoleSchema = z.object({
  role: z.enum(['student', 'volunteer', 'manager', 'admin']),
});
authRoutes.patch('/users/:id/role', authMiddleware, adminOnlyMiddleware, csrfProtection, validate({ body: updateUserRoleSchema }), authController.updateUserRole);

// Delete a user
const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid user ID'),
});
authRoutes.delete('/users/:id', authMiddleware, adminOnlyMiddleware, csrfProtection, validate({ params: userIdParamSchema }), authController.deleteUser);
