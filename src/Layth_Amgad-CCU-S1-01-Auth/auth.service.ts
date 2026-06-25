import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/env.js';
import { AuthenticationError, ConflictError, ValidationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { logger } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/logger.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/mailer.js';
import { authRepository } from './auth.repository.js';
import { AuthResult, LoginInput, RegisterInput, User, ForgotPasswordResult, ResetPasswordResult, RefreshTokenResult, VerifyEmailResult } from './auth.types.js';

// sign a JWT with the user's info — access token lasts however long JWT_EXPIRES_IN says
const signToken = (user: User, expiresIn?: string): string => {
  const exp = expiresIn ?? env.JWT_EXPIRES_IN;
  return jwt.sign(
    { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    env.JWT_SECRET,
    { expiresIn: exp as jwt.SignOptions['expiresIn'] }
  );
};

// sign a refresh token — 7 days by default
const signRefreshToken = (user: User): string => {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN;
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
};

// sign a verification token with a specific type claim
const signTypedToken = (userId: number, type: string, expiresIn: string): string => {
  return jwt.sign(
    { id: userId, type },
    env.JWT_SECRET,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
};

// verify a typed token (email_verification, refresh)
const verifyTypedToken = (token: string, expectedType: string): { id: number } => {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { id: number; type?: string };
  if (payload.type !== expectedType) {
    throw new ValidationError(`Invalid token type. Expected "${expectedType}".`);
  }
  return { id: payload.id };
};

// Hash a raw token with SHA-256 for database storage
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const existing = await authRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('This email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    // Auto-verify email on registration — email-based verification is not used.
    // Users can log in immediately after registering.
    const emailVerified = true;

    const user = await authRepository.create({
      fullName: input.fullName,
      email,
      passwordHash,
      role: 'student',
      emailVerified,
    });

    const token = signToken(user);
    const refreshToken = signRefreshToken(user);

    // C-3 FIX: Store refresh token hash server-side so it can be revoked later
    const refreshTokenHash = authRepository.hashRefreshToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    authRepository.storeRefreshToken(user.id, refreshTokenHash, refreshExpiresAt).catch((err) => {
      logger.error({ err }, 'Failed to store refresh token (non-blocking)');
    });

    return { user, token, refreshToken };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid UTM email or password');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid UTM email or password');
    }

    // Email verification check removed — users are auto-verified on registration.
    // If a user somehow has emailVerified=false, they can still log in.

    // never send the password hash back to the client
    const { passwordHash, ...safeUser } = user;
    const token = signToken(safeUser);
    const refreshToken = signRefreshToken(safeUser);

    // C-3 FIX: Store refresh token hash server-side so it can be revoked later
    const refreshTokenHash = authRepository.hashRefreshToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    authRepository.storeRefreshToken(user.id, refreshTokenHash, refreshExpiresAt).catch((err) => {
      logger.error({ err }, 'Failed to store refresh token (non-blocking)');
    });

    return { user: safeUser, token, refreshToken };
  },

  async getMe(userId: number): Promise<User> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('Invalid or expired token');
    }
    return user;
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    const user = await authRepository.findByEmail(email.toLowerCase());

    // Always return the same success message to prevent email enumeration
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // Generate a cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store SHA-256 hash of the token in the password_resets table, expires in 1 hour
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await authRepository.createPasswordReset(user.id, tokenHash, expiresAt);

    // Clean up expired reset tokens (best-effort, non-blocking)
    authRepository.deleteExpiredResets().catch(() => {});

    // Build the reset URL — attempt email delivery if SMTP is configured,
    // but always return the token so the frontend can handle the reset
    // directly within the web app (no email dependency required).
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      logger.error({ err, email: user.email }, 'Failed to send password reset email (non-blocking)');
    });

    // Always return the token so the frontend can redirect to the reset
    // password form directly — the app does not require email delivery.
    return { message: 'If an account with that email exists, a reset link has been sent.', token: rawToken };
  },

  async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
    // Hash the raw token with SHA-256 to look it up in the database
    const tokenHash = hashToken(token);

    // Find a valid (unused, not expired) reset record
    const reset = await authRepository.findValidReset(tokenHash);
    if (!reset) {
      throw new AuthenticationError('Invalid or expired reset link');
    }

    // Hash the new password with bcrypt cost 12
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update the user's password
    await authRepository.updatePasswordHash(reset.userId, newPasswordHash);

    // Mark the reset token as used so it can't be reused
    await authRepository.markResetUsed(tokenHash);

    // C-4 FIX: Revoke all refresh tokens for this user on password reset
    await authRepository.revokeAllUserRefreshTokens(reset.userId);

    return { message: 'Password has been reset successfully.' };
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const userWithPassword = await authRepository.findByIdWithPassword(userId);
    if (!userWithPassword) {
      throw new AuthenticationError('User not found');
    }
    const isValid = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePasswordHash(userId, newPasswordHash);
    // C-4 FIX: Revoke all refresh tokens when password changes
    await authRepository.revokeAllUserRefreshTokens(userId);
    return { message: 'Password changed successfully' };
  },

  async adminResetPassword(userId: number, newPassword: string): Promise<{ message: string }> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePasswordHash(userId, passwordHash);
    // C-4 FIX: Revoke all refresh tokens when admin resets a user's password
    await authRepository.revokeAllUserRefreshTokens(userId);
    return { message: 'Password reset successfully' };
  },

  async refreshToken(token: string): Promise<RefreshTokenResult> {
    try {
      const { id } = verifyTypedToken(token, 'refresh');

      // C-3 FIX: Check if the refresh token is still valid in the database
      const tokenHash = authRepository.hashRefreshToken(token);
      const tokenRecord = await authRepository.isRefreshTokenValid(tokenHash);
      if (!tokenRecord) {
        throw new AuthenticationError('Refresh token has been revoked or expired');
      }

      const user = await authRepository.findById(id);
      if (!user) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const newAccessToken = signToken(user);
      return { token: newAccessToken };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  },

  // ─── Admin: User Management ───

  async listUsers(page?: number, pageSize?: number): Promise<{ items: User[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
    const safePage = Math.max(1, page ?? 1);
    const safePageSize = Math.max(1, Math.min(100, pageSize ?? 50));
    const offset = (safePage - 1) * safePageSize;
    const [items, totalItems] = await Promise.all([
      authRepository.listAll(safePageSize, offset),
      authRepository.countAll(),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    return { items, pagination: { page: safePage, pageSize: safePageSize, totalItems, totalPages } };
  },

  async adminCreateUser(input: { fullName: string; email: string; password: string; role: string }): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await authRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('This email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await authRepository.create({
      fullName: input.fullName,
      email,
      passwordHash,
      role: input.role as User['role'],
      emailVerified: true,
    });

    return user;
  },

  async updateUser(userId: number, data: { fullName?: string; email?: string }): Promise<User> {
    // If email is being changed, check for conflicts
    if (data.email) {
      const existing = await authRepository.findByEmail(data.email.toLowerCase());
      if (existing && existing.id !== userId) {
        throw new ConflictError('This email is already registered by another user');
      }
    }

    const user = await authRepository.updateDetails(userId, data);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return user;
  },

  // C-6 FIX: Protect admin@utm.my from role changes by other admins
  async updateUserRole(userId: number, role: string): Promise<User> {
    // Check if the target user is the primary admin
    const targetUser = await authRepository.findById(userId);
    if (!targetUser) {
      throw new AuthenticationError('User not found');
    }
    if (targetUser.email === 'admin@utm.my') {
      throw new AuthenticationError('Cannot change the role of the primary admin account (admin@utm.my)');
    }
    const user = await authRepository.updateRole(userId, role);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return user;
  },

  async deleteUser(userId: number): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    // C-6 FIX (extended): protect the primary admin account from being deleted
    if (user.email === 'admin@utm.my') {
      throw new AuthenticationError('Cannot delete the primary admin account (admin@utm.my)');
    }
    await authRepository.deleteById(userId);
  },

  // ─── Email Verification ───

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    try {
      const { id } = verifyTypedToken(token, 'email_verification');
      const user = await authRepository.verifyEmail(id);
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      return { message: 'Email verified successfully. You can now log in.' };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired verification link');
    }
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await authRepository.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal whether the email exists
      return { message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.' };
    }
    if (user.emailVerified) {
      return { message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.' };
    }

    const verificationToken = signTypedToken(user.id, 'email_verification', '24h');
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    sendVerificationEmail(user.email, verificationUrl).catch((err) => {
      logger.error({ err, email: user.email }, 'Failed to resend verification email (non-blocking)');
    });

    return { message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.' };
  },
};
