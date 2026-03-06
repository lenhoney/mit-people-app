import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");

    let query = `SELECT id, task_number, task_description, group_label, budget, COALESCE(status, 'Started') as status, project_lead, client_id, created_at, updated_at
         FROM projects`;
    const params: unknown[] = [];

    if (clientId) {
      query += ` WHERE client_id = ?`;
      params.push(clientId);
    }

    query += ` ORDER BY COALESCE(group_label, 'zzz') ASC, task_description ASC, task_number ASC`;

    const projects = db.prepare(query).all(...params);

    return NextResponse.json(projects);
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

    const stmt = db.prepare(`
      INSERT INTO projects (task_number, task_description, group_label, budget, project_lead, client_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      task_number,
      task_description || null,
      group_label || null,
      budget != null && budget !== "" ? Number(budget) : null,
      project_lead || null,
      client_id ?? null
    );

    await logAudit("CREATE", "project", result.lastInsertRowid, `Created project: ${task_number}`);
    return NextResponse.json(
      { id: result.lastInsertRowid, message: "Project created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating project:", error);
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
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
