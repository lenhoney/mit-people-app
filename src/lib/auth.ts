import crypto from "crypto";
import { cookies } from "next/headers";
import { queryOne, execute } from "./db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

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
