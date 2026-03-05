import db from "@/lib/db";
import { auth0 } from "@/lib/auth0";

/**
 * Log an audit trail entry for a database mutation.
 *
 * Retrieves the current Auth0 user from the session automatically.
 * Errors are caught and logged — audit failures never break the main operation.
 *
 * @param action    - "CREATE" | "UPDATE" | "DELETE"
 * @param entityType - e.g. "person", "project", "timesheet", "planned_work", "pto"
 * @param entityId  - the ID of the affected record (string or null for bulk ops)
 * @param details   - human-readable description of the change
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: string
): Promise<void> {
  try {
    let userName = "System";
    let userEmail: string | null = null;

    try {
      const session = await auth0.getSession();
      if (session?.user) {
        userName = session.user.name ?? session.user.nickname ?? session.user.email ?? "Unknown";
        userEmail = session.user.email ?? null;
      }
    } catch {
      // Session unavailable (e.g. during server-side operations) — use "System"
    }

    db.prepare(
      `INSERT INTO audit_trail (user_name, user_email, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userName, userEmail, action, entityType, entityId?.toString() ?? null, details);
  } catch (err) {
    console.error("Audit trail logging failed:", err);
  }
}
