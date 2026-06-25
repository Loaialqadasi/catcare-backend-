import crypto from 'node:crypto';
import { DatabaseError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { db } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js';
import { User, UserWithPassword, CreateUserInput } from './auth.types.js';

interface UserRow {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface PasswordResetRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

// DB rows use snake_case, our app uses camelCase
const mapUser = (row: UserRow): User => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role as User['role'],
  emailVerified: row.email_verified,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapUserWithPassword = (row: UserRow): UserWithPassword => ({
  ...mapUser(row),
  passwordHash: row.password_hash
});

export const authRepository = {
  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const { rows } = await db.query<UserRow>(
      'SELECT id, full_name, email, password_hash, role, email_verified, created_at, updated_at FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapUserWithPassword(rows[0]);
  },

  async findById(id: number): Promise<User | null> {
    const { rows } = await db.query<UserRow>(
      'SELECT id, full_name, email, password_hash, role, email_verified, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapUser(rows[0]);
  },

  async findByIdWithPassword(id: number): Promise<UserWithPassword | null> {
    const { rows } = await db.query<UserRow>(
      'SELECT id, full_name, email, password_hash, role, email_verified, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return mapUserWithPassword(rows[0]);
  },

  async create(input: CreateUserInput): Promise<User> {
    const emailVerified = input.emailVerified ?? false;
    const { rows } = await db.query<UserRow>(
      'INSERT INTO users (full_name, email, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, password_hash, role, email_verified, created_at, updated_at',
      [input.fullName, input.email, input.passwordHash, input.role, emailVerified]
    );
    return mapUser(rows[0]);
  },

  async verifyEmail(userId: number): Promise<User | null> {
    const { rows } = await db.query<UserRow>(
      'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, password_hash, role, email_verified, created_at, updated_at',
      [userId]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapUser(rows[0]);
  },

  async updatePassword(userId: number, passwordHash: string): Promise<User | null> {
    const { rows } = await db.query<UserRow>(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, password_hash, role, email_verified, created_at, updated_at',
      [passwordHash, userId]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapUser(rows[0]);
  },

  // ─── Password Reset Methods ───

  async createPasswordReset(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt.toISOString()]
    );
  },

  async findValidReset(tokenHash: string): Promise<{ userId: number } | null> {
    const { rows } = await db.query<PasswordResetRow>(
      'SELECT id, user_id, token_hash, expires_at, used_at, created_at FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (rows.length === 0) {
      return null;
    }
    return { userId: rows[0].user_id };
  },

  async markResetUsed(tokenHash: string): Promise<void> {
    await db.query(
      'UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
  },

  async updatePasswordHash(userId: number, newPasswordHash: string): Promise<void> {
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );
  },

  async deleteExpiredResets(): Promise<void> {
    await db.query(
      'DELETE FROM password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL'
    );
  },

  // ─── Admin: User Management ───

  async listAll(limit = 100, offset = 0): Promise<User[]> {
    const { rows } = await db.query<UserRow>(
      'SELECT id, full_name, email, password_hash, role, email_verified, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return rows.map(mapUser);
  },

  async countAll(): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM users'
    );
    return Number(rows[0]?.count ?? 0);
  },

  async updateRole(userId: number, role: string): Promise<User | null> {
    const { rows } = await db.query<UserRow>(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, password_hash, role, email_verified, created_at, updated_at',
      [role, userId]
    );
    if (rows.length === 0) return null;
    return mapUser(rows[0]);
  },

  async updateDetails(userId: number, data: { fullName?: string; email?: string }): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(data.fullName);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email.toLowerCase());
    }

    if (updates.length === 0) {
      // No updates requested, return current user
      return this.findById(userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await db.query<UserRow>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, full_name, email, password_hash, role, email_verified, created_at, updated_at`,
      values
    );
    if (rows.length === 0) return null;
    return mapUser(rows[0]);
  },

  async deleteById(userId: number): Promise<void> {
    // First delete related records
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    // Then delete the user
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  },

  // ─── C-3 FIX: Refresh Token Storage Methods ───
  // Store refresh token hashes server-side so they can be revoked on logout,
  // password change, or admin action.

  /** Hash a raw refresh token with SHA-256 for database storage */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  /** Store a refresh token hash in the database */
  async storeRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt.toISOString()]
    );
  },

  /** Check if a refresh token hash exists and is not revoked */
  async isRefreshTokenValid(tokenHash: string): Promise<{ userId: number } | null> {
    const { rows } = await db.query<RefreshTokenRow>(
      'SELECT id, user_id, token_hash, expires_at, revoked_at, created_at FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (rows.length === 0) {
      return null;
    }
    return { userId: rows[0].user_id };
  },

  /** Revoke a specific refresh token (used during logout) */
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
  },

  /** Revoke ALL refresh tokens for a user (used on password change or admin action) */
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  },

  /** Clean up expired/revoked refresh tokens (called periodically) */
  async cleanExpiredRefreshTokens(): Promise<void> {
    await db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL'
    );
  },
};
