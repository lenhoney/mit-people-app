import crypto from "crypto";
import { cookies } from "next/headers";
import { query, queryOne, execute } from "./db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

export type MenuPermissions = Record<
  string,
  { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
>;

// ── Password Hashing (Node.js crypto.scrypt) ─────────────────────────────────

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [salt, key] = hash.split(":");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey));
    });
  });
}

// ── Password Generation ──────────────────────────────────────────────────────

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%&*?";
const ALL_CHARS = UPPER + LOWER + DIGITS + SPECIAL;

export function generatePassword(length = 10): string {
  const pick = (chars: string) => chars[crypto.randomInt(chars.length)];
  // Ensure at least one of each category
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const remaining = Array.from({ length: length - required.length }, () => pick(ALL_CHARS));
  const combined = [...required, ...remaining];
  // Shuffle using Fisher-Yates
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

// ── Password Validation ─────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 8;

/**
 * Validate a user-supplied password meets complexity requirements.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

// ── Session Cookie (HMAC-SHA256 signed) ──────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.AUTH0_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function signPayload(payload: string): string {
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return hmac.digest("base64url");
}

export function createSessionCookie(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })
  ).toString("base64url");

  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookie(value: string): SessionUser | null {
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;

    const expectedSig = signPayload(payload);
    if (signature !== expectedSig) return null;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;

    return { id: data.id, name: data.name, email: data.email };
  } catch {
    return null;
  }
}

// ── Server-side session access (from next/headers cookies) ───────────────────

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");
    if (!sessionCookie?.value) return null;
    return verifySessionCookie(sessionCookie.value);
  } catch {
    return null;
  }
}

// ── RBAC: Permissions ────────────────────────────────────────────────────────

/**
 * Get merged permissions for a user across all their roles.
 * If ANY assigned role grants a permission, the user has it (OR logic).
 */
export async function getUserPermissions(userId: number): Promise<MenuPermissions> {
  const rows = await query<{
    menu_item: string;
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
  }>(
    `SELECT rp.menu_item, rp.can_create, rp.can_read, rp.can_update, rp.can_delete
     FROM role_permissions rp
     JOIN user_role_assignments ura ON ura.role_id = rp.role_id
     WHERE ura.user_id = $1`,
    [userId]
  );

  const permissions: MenuPermissions = {};
  for (const row of rows) {
    const existing = permissions[row.menu_item];
    if (existing) {
      existing.can_create = existing.can_create || row.can_create;
      existing.can_read = existing.can_read || row.can_read;
      existing.can_update = existing.can_update || row.can_update;
      existing.can_delete = existing.can_delete || row.can_delete;
    } else {
      permissions[row.menu_item] = {
        can_create: row.can_create,
        can_read: row.can_read,
        can_update: row.can_update,
        can_delete: row.can_delete,
      };
    }
  }
  return permissions;
}

/**
 * Check if a user has the "Super User" role.
 */
export async function isSuperUser(userId: number): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM user_role_assignments ura
     JOIN user_roles ur ON ur.id = ura.role_id
     WHERE ura.user_id = $1 AND ur.name = 'Super User'`,
    [userId]
  );
  return parseInt(row?.count ?? "0", 10) > 0;
}

/**
 * API route helper: check the current user has a specific permission.
 * Returns the session user if authorized, or null + a NextResponse if not.
 */
export async function requirePermission(
  menuItem: string,
  action: "create" | "read" | "update" | "delete"
): Promise<{ authorized: true; session: SessionUser } | { authorized: false; status: number; error: string }> {
  const session = await getSession();
  if (!session) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  const permissions = await getUserPermissions(session.id);
  const perm = permissions[menuItem];
  const key = `can_${action}` as const;

  if (!perm || !perm[key]) {
    return { authorized: false, status: 403, error: "Forbidden" };
  }

  return { authorized: true, session };
}

// ── Admin user seeding ───────────────────────────────────────────────────────

export async function seedAdminUser(): Promise<void> {
  try {
    const row = await queryOne<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM users"
    );
    const count = parseInt(row?.count ?? "0", 10);

    if (count === 0) {
      const password = process.env.ADMIN_PASSWORD || "changeme";
      const hash = await hashPassword(password);
      await execute(
        `INSERT INTO users (username, email, name, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        ["admin", "admin@populus.local", "Admin", hash]
      );
      console.log(
        'Default admin user created (username: "admin"). Please change the password.'
      );
    }
  } catch (err) {
    console.error("Failed to seed admin user:", err);
  }
}
