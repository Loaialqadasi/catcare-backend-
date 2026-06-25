import type { Request } from 'express';
import { db } from './database.js';
import { logger } from './logger.js';

/**
 * Lightweight audit logger — writes a row to audit_log for security-relevant
 * actions. Failures are logged but never block the calling request, so a
 * broken audit log never breaks the user flow.
 *
 * Actor resolution order:
 *   1. event.actor — explicit override (use this for endpoints that run
 *      BEFORE authMiddleware, e.g. /login, /register, /verify-email,
 *      /reset-password — where req.user is NOT populated yet)
 *   2. req.user     — populated by authMiddleware on authenticated routes
 *
 * Example (authenticated route — actor comes from req.user):
 *   audit(req, 'user.role.update', { target_type: 'user', target_id: '42',
 *           metadata: { oldRole: 'student', newRole: 'manager' } });
 *
 * Example (login route — req.user is undefined, pass actor explicitly):
 *   audit(req, 'auth.login', {
 *     target_type: 'user', target_id: user.id,
 *     actor: { id: user.id, email: user.email },
 *   });
 */
export interface AuditActor {
  id?: number | string;
  email?: string;
}

export interface AuditEvent {
  action: string;
  target_type?: string;
  target_id?: string | number;
  metadata?: Record<string, unknown>;
  /**
   * Explicit actor override. Use this on endpoints that do NOT run
   * authMiddleware (login, register, verify-email, reset-password),
   * where req.user would otherwise be undefined and the audit row would
   * be written with NULL actor_user_id / actor_email.
   */
  actor?: AuditActor;
}

export async function audit(req: Request | undefined, event: AuditEvent): Promise<void> {
  try {
    // Prefer explicit actor override; fall back to req.user from authMiddleware.
    const actor = event.actor ?? req?.user;
    const sql = `
      INSERT INTO audit_log
        (actor_user_id, actor_email, action, target_type, target_id, metadata, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const params = [
      actor?.id ?? null,
      actor?.email ?? null,
      event.action,
      event.target_type ?? null,
      event.target_id != null ? String(event.target_id) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      req?.ip ?? null,
      req?.get('user-agent')?.slice(0, 500) ?? null,
    ];
    await db.query(sql, params);
  } catch (err) {
    // Audit failures must never break the request flow.
    logger.error({ err, event }, 'audit log write failed (non-blocking)');
  }
}