import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, execute } from "@/lib/db";
import { verifyPassword, createSessionCookie, getUserPermissions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/** Preferred landing-page order — first match with can_read wins. */
const LANDING_PRIORITY = [
  "dashboard",
  "gantt",
  "people",
  "projects",
  "planned-work",
  "timesheets",
  "time-off",
  "reports",
  "clients",
  "business-units",
  "users",
  "user-roles",
  "audit-trail",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Look up user by username or email — include quarantine fields
    const user = await queryOne<{
      id: number;
      username: string;
      email: string;
      name: string;
      password_hash: string;
      is_quarantined: boolean;
      failed_login_attempts: number;
    }>(
      `SELECT id, username, email, name, password_hash, is_quarantined, failed_login_attempts
       FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [username]
    );

    if (!user) {
      // Unknown user — log attempt but no counter to increment
      await logAudit(
        "LOGIN_FAILED",
        "auth",
        null,
        `Failed login attempt for unknown user: ${username}`,
        { name: username, email: null }
      );
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check quarantine BEFORE password verification (no timing leak)
    if (user.is_quarantined) {
      await logAudit(
        "LOGIN_FAILED",
        "auth",
        user.id.toString(),
        `Login rejected — account is quarantined: ${user.username}`,
        { name: user.name, email: user.email }
      );
      return NextResponse.json(
        { error: "Account is quarantined. Contact your administrator." },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const newFailCount = user.failed_login_attempts + 1;
      const shouldQuarantine = newFailCount >= 3;

      if (shouldQuarantine) {
        // Quarantine the account
        await execute(
          `UPDATE users SET failed_login_attempts = $1, is_quarantined = TRUE, quarantined_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [newFailCount, user.id]
        );
        await logAudit(
          "LOGIN_FAILED",
          "auth",
          user.id.toString(),
          `Failed login attempt (${newFailCount}/3) for user: ${user.username}`,
          { name: user.name, email: user.email }
        );
        await logAudit(
          "ACCOUNT_QUARANTINED",
          "user",
          user.id.toString(),
          `Account quarantined after ${newFailCount} consecutive failed login attempts: ${user.username}`,
          { name: "System", email: null }
        );
      } else {
        // Increment counter
        await execute(
          `UPDATE users SET failed_login_attempts = $1, updated_at = NOW() WHERE id = $2`,
          [newFailCount, user.id]
        );
        await logAudit(
          "LOGIN_FAILED",
          "auth",
          user.id.toString(),
          `Failed login attempt (${newFailCount}/3) for user: ${user.username}`,
          { name: user.name, email: user.email }
        );
      }

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Password correct — check roles
    const roleCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM user_role_assignments WHERE user_id = $1",
      [user.id]
    );
    if (parseInt(roleCount?.count ?? "0", 10) === 0) {
      // Correct password but no roles — reset counter, deny access
      await execute(
        `UPDATE users SET failed_login_attempts = 0, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      await logAudit(
        "LOGIN_FAILED",
        "auth",
        user.id.toString(),
        `Login denied — no roles assigned: ${user.username}`,
        { name: user.name, email: user.email }
      );
      return NextResponse.json(
        { error: "No role assigned. Contact your administrator." },
        { status: 403 }
      );
    }

    // Full success — reset counter, create session
    await execute(
      `UPDATE users SET failed_login_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    const sessionValue = createSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    await logAudit(
      "LOGIN_SUCCESS",
      "auth",
      user.id.toString(),
      `Successful login: ${user.username}`,
      { name: user.name, email: user.email }
    );

    // Determine the best landing page based on permissions
    const permissions = await getUserPermissions(user.id);
    let redirectTo = "/dashboard"; // default
    for (const item of LANDING_PRIORITY) {
      if (permissions[item]?.can_read) {
        redirectTo = `/${item}`;
        break;
      }
    }

    return NextResponse.json({ success: true, redirectTo });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
