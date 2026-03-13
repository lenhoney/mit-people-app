import { NextRequest, NextResponse } from "next/server";
import { cleanupPlannedWork, query, queryOne, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    // Clean up past-dated planned work before returning data
    await cleanupPlannedWork();

    const { searchParams } = new URL(request.url);
    const viewBy = searchParams.get("viewBy") || "project";
    const clientId = searchParams.get("clientId");

    const orderClause =
      viewBy === "person"
        ? "ORDER BY p.person, pw.task_number"
        : "ORDER BY pw.task_number, p.person";

    const clientJoin = clientId && clientId !== "null" && clientId !== "undefined"
      ? "JOIN projects proj ON pw.task_number = proj.task_number"
      : "";
    const clientFilter = clientId && clientId !== "null" && clientId !== "undefined"
      ? "WHERE proj.client_id = $1"
      : "";
    const clientParams: unknown[] = clientId && clientId !== "null" && clientId !== "undefined"
      ? [Number(clientId)]
      : [];

    const result = await query(
      `SELECT pw.id, pw.person_id, pw.task_number, pw.task_description,
              pw.planned_start, pw.planned_end, pw.allocation_pct,
              pw.created_at, pw.updated_at,
              p.person as person_name
       FROM planned_work pw
       JOIN people p ON pw.person_id = p.id
       ${clientJoin}
       ${clientFilter}
       ${orderClause}`,
      clientParams
    );

    return NextResponse.json(result);
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
    await execute(
      `INSERT INTO projects (task_number, task_description)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING`,
      [task_number, task_description || null]
    );

    const result = await execute(
      `INSERT INTO planned_work (person_id, task_number, task_description, planned_start, planned_end, allocation_pct)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(person_id, task_number) DO UPDATE SET
        planned_start = excluded.planned_start,
        planned_end = excluded.planned_end,
        task_description = excluded.task_description,
        allocation_pct = excluded.allocation_pct,
        updated_at = NOW()
      RETURNING id`,
      [
        person_id,
        task_number,
        task_description || null,
        planned_start,
        planned_end,
        pct,
      ]
    );

    const newId = result.rows[0].id as number;

    // Look up person name for audit log
    const personRow = await queryOne<{ person: string }>(
      "SELECT person FROM people WHERE id = $1",
      [person_id]
    );
    await logAudit("CREATE", "planned_work", newId, `Created planned work: ${personRow?.person ?? person_id} → ${task_number}`);
    return NextResponse.json(
      { id: newId, message: "Planned work created/updated" },
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
