import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperUser } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

interface PermissionRow {
  menu_item: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const superUser = await isSuperUser(session.id);
    if (!superUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roles = await query<RoleRow>(
      `SELECT id, name, description, is_system, created_at
       FROM user_roles
       ORDER BY name`
    );

    const result = await Promise.all(
      roles.map(async (role) => {
        const perms = await query<PermissionRow>(
          `SELECT menu_item, can_create, can_read, can_update, can_delete
           FROM role_permissions
           WHERE role_id = $1`,
          [role.id]
        );

        const userCountRow = await queryOne<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM user_role_assignments
           WHERE role_id = $1`,
          [role.id]
        );

        const permissions: Record<
          string,
          { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
        > = {};
        for (const p of perms) {
          permissions[p.menu_item] = {
            can_create: p.can_create,
            can_read: p.can_read,
            can_update: p.can_update,
            can_delete: p.can_delete,
          };
        }

        return {
          ...role,
          permissions,
          user_count: parseInt(userCountRow?.count ?? "0", 10),
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const superUser = await isSuperUser(session.id);
    if (!superUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const roleId = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO user_roles (name, description)
         VALUES ($1, $2)
         RETURNING id`,
        [name.trim(), description || null]
      );

      const newId = result.rows[0].id;

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
            [newId, menuItem, p.can_create, p.can_read, p.can_update, p.can_delete]
          );
        }
      }

      return newId;
    });

    await logAudit("CREATE", "user_role", roleId, `Created role: ${name}`);

    return NextResponse.json(
      { id: roleId, message: "Role created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating user role:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "A role with that name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create user role" },
      { status: 500 }
    );
  }
}
