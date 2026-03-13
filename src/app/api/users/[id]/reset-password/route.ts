import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperUser, generatePassword, hashPassword } from "@/lib/auth";
import { execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const superUser = await isSuperUser(session.id);
    if (!superUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const result = await execute(
      `UPDATE users SET password_hash = $1, password_plain = $2, updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, password, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit("UPDATE", "user", id, `Reset password for user ID: ${id}`);
    return NextResponse.json({ password });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
