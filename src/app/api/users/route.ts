import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperUser, generatePassword, hashPassword } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    const users = await query(`
      SELECT u.id, u.username, u.email, u.name, u.password_plain, u.is_protected,
             u.is_quarantined, u.failed_login_attempts, u.quarantined_at, u.created_at,
             COALESCE(json_agg(json_build_object('id', ur.id, 'name', ur.name)) FILTER (WHERE ur.id IS NOT NULL), '[]') as roles
      FROM users u
      LEFT JOIN user_role_assignments ura ON ura.user_id = u.id
      LEFT JOIN user_roles ur ON ur.id = ura.role_id
      GROUP BY u.id
      ORDER BY u.name
    `);

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
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
    const { email, name, username, role_ids } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return NextResponse.json({ error: "At least one role is required" }, { status: 400 });
    }

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const result = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (username, email, name, password_hash, password_plain)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [username, email, name, passwordHash, password]
      );

      const userId = userResult.rows[0].id;

      for (const roleId of role_ids) {
        await client.query(
          `INSERT INTO user_role_assignments (user_id, role_id) VALUES ($1, $2)`,
          [userId, roleId]
        );
      }

      return { id: userId };
    });

    await logAudit("CREATE", "user", result.id, `Created user: ${name}`);

    return NextResponse.json(
      { id: result.id, password, message: "User created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "A user with that username or email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
