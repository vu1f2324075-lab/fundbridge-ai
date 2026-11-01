/**
 * Audit logging for security-relevant actions (spec §32).
 *
 * Writes are best-effort: an audit failure must never break the action the user
 * was performing, so errors are logged and swallowed. Only non-sensitive
 * metadata is recorded — never passwords, tokens, or financial figures.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'business.updated'
  | 'proposal.uploaded'
  | 'proposal.analysed'
  | 'scheme.created'
  | 'scheme.updated'
  | 'scheme.verified'
  | 'scheme.archived'
  | 'matching_config.updated'
  | 'user.suspended'
  | 'user.reactivated'
  | 'user.role_changed';

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? {}) as object,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, 'failed to write audit log');
  }
}
