import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperUser } from "@/lib/auth";
import { queryOne, execute, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PUT(
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
    const body = await request.json();
    const { email, name, username, role_ids } = body;

    const result = await withTransaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE users SET email = $1, name = $2, username = $3, updated_at = NOW()
         WHERE id = $4`,
        [email, name, username, id]
      );

      if (updateResult.rowCount === 0) {
        return { notFound: true };
      }

      await client.query(
        `DELETE FROM user_role_assignments WHERE user_id = $1`,
        [id]
      );

      if (role_ids && Array.isArray(role_ids)) {
        for (const roleId of role_ids) {
          await client.query(
            `INSERT INTO user_role_assignments (user_id, role_id) VALUES ($1, $2)`,
            [id, roleId]
          );
        }
      }

      return { notFound: false };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit("UPDATE", "user", id, `Updated user: ${name}`);
    return NextResponse.json({ message: "User updated" });
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "A user with that username or email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
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

    const user = await queryOne<{ is_protected: boolean }>(
      `SELECT is_protected FROM users WHERE id = $1`,
      [id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.is_protected) {
      return NextResponse.json(
        { error: "Cannot delete protected user" },
        { status: 403 }
      );
    }

    const result = await execute("DELETE FROM users WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit("DELETE", "user", id, `Deleted user ID: ${id}`);
    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
