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
    const { name, description, permissions } = body;

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE user_roles
         SET name = $1, description = $2, updated_at = NOW()
         WHERE id = $3`,
        [name || null, description || null, id]
      );

      if (result.rowCount === 0) {
        return false;
      }

      // Replace all permissions for this role
      await client.query(
        `DELETE FROM role_permissions WHERE role_id = $1`,
        [id]
      );

      if (permissions && typeof permissions === "object") {
        for (const [menuItem, perm] of Object.entries(permissions)) {
          const p = perm as {
            can_create: boolean;
            can_read: boolean;
            can_update: boolean;
            can_delete: boolean;
          };
          await client.query(
            `INSERT INTO role_permissions (role_id, menu_item, can_create, can_read, can_update, can_delete)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, menuItem, p.can_create, p.can_read, p.can_update, p.can_delete]
          );
        }
      }

      return true;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    await logAudit("UPDATE", "user_role", id, `Updated role: ${name}`);

    return NextResponse.json({ message: "Role updated" });
  } catch (error: unknown) {
    console.error("Error updating user role:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "A role with that name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
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

    // Check if role exists and whether it's a system role
    const role = await queryOne<{ is_system: boolean; name: string }>(
      `SELECT is_system, name FROM user_roles WHERE id = $1`,
      [id]
    );

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    if (role.is_system) {
      return NextResponse.json(
        { error: "Cannot delete system role" },
        { status: 403 }
      );
    }

    // Check if any users are assigned to this role
    const assignmentCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM user_role_assignments
       WHERE role_id = $1`,
      [id]
    );

    if (parseInt(assignmentCount?.count ?? "0", 10) > 0) {
      return NextResponse.json(
        { error: "Cannot delete role with assigned users. Remove user assignments first." },
        { status: 409 }
      );
    }

    // Delete role permissions and then the role itself
    const result = await execute(
      `DELETE FROM user_roles WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    await logAudit("DELETE", "user_role", id, `Deleted role: ${role.name}`);

    return NextResponse.json({ message: "Role deleted" });
  } catch (error) {
    console.error("Error deleting user role:", error);
    return NextResponse.json(
      { error: "Failed to delete user role" },
      { status: 500 }
    );
  }
}
