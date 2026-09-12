import 'server-only'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import type { User } from '@/lib/db/schema'

/**
 * Append-only trail for security-sensitive actions. Deliberately small and
 * synchronous-looking (callers `await` it) but non-fatal — a logging
 * failure should never take down the mutation it's describing, so every
 * call site should treat this as best-effort (see the `.catch()` pattern
 * used at call sites, or use `logAuditBestEffort` below).
 *
 * What NOT to put in `metadata` (enforced by convention here, not by a
 * schema-level guarantee — reviewed at call sites):
 *   - passwords, API keys, auth tokens, session ids
 *   - signed URLs (they're bearer credentials for their lifetime)
 *   - full document contents or PII beyond an id/name needed to identify
 *     the record (e.g. a document's fileName is fine; its extracted text
 *     is not)
 */
export interface AuditEntry {
  /** The acting user, when there is one. Omit for system/cron/webhook actions. */
  user?: Pick<User, 'id' | 'email' | 'role'> | null
  /** Fallback label when there's no `user` (e.g. 'cron', 'clerk-webhook', 'lead-intake-webhook'). */
  actorLabel?: string
  /** e.g. 'document.upload', 'document.download', 'document.delete', 'deal.delete', 'user.role_change' */
  action: string
  entityType: string
  entityId?: string | number | null
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const actorLabel = entry.user ? `${entry.user.role}:${entry.user.id}` : (entry.actorLabel ?? 'system')

  await db.insert(auditLogs).values({
    userId: entry.user?.id ?? null,
    actorLabel,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId != null ? String(entry.entityId) : null,
    metadata: entry.metadata ?? null,
  })
}

/**
 * Same as logAudit, but swallows failures so a logging hiccup never turns
 * into a 500 for the actual mutation. Failures are still surfaced via
 * console.error for server-side log visibility.
 */
export async function logAuditBestEffort(entry: AuditEntry): Promise<void> {
  try {
    await logAudit(entry)
  } catch (err) {
    console.error('Audit log write failed', { action: entry.action, entityType: entry.entityType, err })
  }
}
