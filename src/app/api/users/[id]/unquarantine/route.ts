import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperUser } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
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

    const user = await queryOne<{ is_quarantined: boolean; username: string }>(
      "SELECT is_quarantined, username FROM users WHERE id = $1",
      [id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.is_quarantined) {
      return NextResponse.json({ error: "User is not quarantined" }, { status: 400 });
    }

    await execute(
      `UPDATE users SET is_quarantined = FALSE, failed_login_attempts = 0, quarantined_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await logAudit("ACCOUNT_UNQUARANTINED", "user", id, `Un-quarantined user: ${user.username}`);

    return NextResponse.json({ message: "User un-quarantined" });
  } catch (error) {
    console.error("Error un-quarantining user:", error);
    return NextResponse.json({ error: "Failed to un-quarantine user" }, { status: 500 });
  }
}
