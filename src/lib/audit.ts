import { execute } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Log an audit trail entry for a database mutation.
 *
 * Retrieves the current user from the session cookie automatically.
 * Errors are caught and logged — audit failures never break the main operation.
 *
 * @param action       - "CREATE" | "UPDATE" | "DELETE" | "LOGIN_SUCCESS" | "LOGIN_FAILED" | etc.
 * @param entityType   - e.g. "person", "project", "auth", "user"
 * @param entityId     - the ID of the affected record (string or null for bulk ops)
 * @param details      - human-readable description of the change
 * @param explicitUser - optional override for pre-auth contexts (login attempts)
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | number | bigint | null,
  details: string,
  explicitUser?: { name: string; email: string | null }
): Promise<void> {
  try {
    let userName = "System";
    let userEmail: string | null = null;

    if (explicitUser) {
      userName = explicitUser.name;
      userEmail = explicitUser.email;
    } else {
      try {
        const session = await getSession();
        if (session) {
          userName = session.name ?? session.email ?? "Unknown";
          userEmail = session.email ?? null;
        }
      } catch {
        // Session unavailable (e.g. during server-side operations) — use "System"
      }
    }

    await execute(
      `INSERT INTO audit_trail (user_name, user_email, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userName, userEmail, action, entityType, entityId?.toString() ?? null, details]
    );
  } catch (err) {
    console.error("Audit trail logging failed:", err);
  }
}
