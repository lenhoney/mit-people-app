import { NextRequest, NextResponse } from "next/server";
import db, { cleanupPlannedWork } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    // Clean up past-dated planned work before returning data
    cleanupPlannedWork();

    const { searchParams } = new URL(request.url);
    const viewBy = searchParams.get("viewBy") || "project";

    const orderClause =
      viewBy === "person"
        ? "ORDER BY p.person, pw.task_number"
        : "ORDER BY pw.task_number, p.person";

    const rows = db
      .prepare(
        `SELECT pw.id, pw.person_id, pw.task_number, pw.task_description,
                pw.planned_start, pw.planned_end, pw.allocation_pct,
                pw.created_at, pw.updated_at,
                p.person as person_name
         FROM planned_work pw
         JOIN people p ON pw.person_id = p.id
         ${orderClause}`
      )
      .all();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching planned work:", error);
    return NextResponse.json(
      { error: "Failed to fetch planned work" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { person_id, task_number, task_description, planned_start, planned_end, allocation_pct } =
      body;

    if (!person_id || !task_number || !planned_start || !planned_end) {
      return NextResponse.json(
        {
          error:
            "person_id, task_number, planned_start, and planned_end are required",
        },
        { status: 400 }
      );
    }

    if (planned_end < planned_start) {
      return NextResponse.json(
        { error: "planned_end must be on or after planned_start" },
        { status: 400 }
      );
    }

    const pct = allocation_pct != null ? Math.max(1, Math.min(100, Math.round(allocation_pct))) : 100;

    // Ensure the project exists in the projects table
    db.prepare(`
      INSERT OR IGNORE INTO projects (task_number, task_description)
      VALUES (?, ?)
    `).run(task_number, task_description || null);

    const stmt = db.prepare(`
      INSERT INTO planned_work (person_id, task_number, task_description, planned_start, planned_end, allocation_pct)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(person_id, task_number) DO UPDATE SET
        planned_start = excluded.planned_start,
        planned_end = excluded.planned_end,
        task_description = excluded.task_description,
        allocation_pct = excluded.allocation_pct,
        updated_at = datetime('now')
    `);

    const result = stmt.run(
      person_id,
      task_number,
      task_description || null,
      planned_start,
      planned_end,
      pct
    );

    // Look up person name for audit log
    const personRow = db.prepare("SELECT person FROM people WHERE id = ?").get(person_id) as { person: string } | undefined;
    await logAudit("CREATE", "planned_work", result.lastInsertRowid, `Created planned work: ${personRow?.person ?? person_id} → ${task_number}`);
    return NextResponse.json(
      { id: result.lastInsertRowid, message: "Planned work created/updated" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating planned work:", error);
    return NextResponse.json(
      { error: "Failed to create planned work" },
      { status: 500 }
    );
  }
}
