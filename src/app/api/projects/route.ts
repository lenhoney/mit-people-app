import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");

    let sql = `SELECT id, task_number, task_description, group_label, budget, COALESCE(status, 'Started') as status, project_lead, client_id, created_at, updated_at
         FROM projects`;
    const params: unknown[] = [];

    if (clientId && clientId !== "null" && clientId !== "undefined") {
      sql += ` WHERE client_id = $1`;
      params.push(Number(clientId));
    }

    sql += ` ORDER BY COALESCE(group_label, 'zzz') ASC, task_description ASC, task_number ASC`;

    const result = await query(sql, params);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_number, task_description, group_label, budget, project_lead, client_id } = body;

    if (!task_number) {
      return NextResponse.json(
        { error: "Project code (task_number) is required" },
        { status: 400 }
      );
    }

    const result = await execute(
      `INSERT INTO projects (task_number, task_description, group_label, budget, project_lead, client_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        task_number,
        task_description || null,
        group_label || null,
        budget != null && budget !== "" ? Number(budget) : null,
        project_lead || null,
        client_id ?? null,
      ]
    );

    const newId = result.rows[0].id as number;
    await logAudit("CREATE", "project", newId, `Created project: ${task_number}`);
    return NextResponse.json(
      { id: newId, message: "Project created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating project:", error);
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: "A project with that code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
