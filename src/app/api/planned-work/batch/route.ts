import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/planned-work/batch
 *
 * Extends planned work for ALL people on a given project to the specified end date.
 * Each person's planned_start is set to their own actual_end (last timesheet week).
 *
 * Body: { task_number, task_description, planned_end }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_number, task_description, planned_end } = body;

    if (!task_number || !planned_end) {
      return NextResponse.json(
        { error: "task_number and planned_end are required" },
        { status: 400 }
      );
    }

    // Find all people who have timesheet entries for this project
    const peopleResult = await query<{
      person_id: number;
      user_name: string;
      actual_end: string;
    }>(
      `SELECT p.id as person_id, p.person as user_name,
              MAX(t.week_starts_on) as actual_end
       FROM timesheets t
       JOIN people p ON t.user_name = p.person
       WHERE t.task_number = $1
         AND t.category = 'Project'
       GROUP BY p.id, p.person`,
      [task_number]
    );

    const people = peopleResult;

    if (people.length === 0) {
      return NextResponse.json(
        { error: "No people found for this project" },
        { status: 404 }
      );
    }

    let created = 0;
    let removed = 0;

    await withTransaction(async (client) => {
      for (const person of people) {
        if (planned_end > person.actual_end) {
          // Look up existing allocation_pct for this person/project
          const existingResult = await client.query(
            `SELECT allocation_pct FROM planned_work WHERE person_id = $1 AND task_number = $2`,
            [person.person_id, task_number]
          );
          const existing = existingResult.rows[0] as { allocation_pct: number } | undefined;
          const alloc = existing?.allocation_pct ?? 100;

          // Extend: upsert planned work from their actual_end to the project planned_end
          await client.query(
            `INSERT INTO planned_work (person_id, task_number, task_description, planned_start, planned_end, allocation_pct)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT(person_id, task_number) DO UPDATE SET
              planned_start = excluded.planned_start,
              planned_end = excluded.planned_end,
              task_description = excluded.task_description,
              allocation_pct = excluded.allocation_pct,
              updated_at = NOW()`,
            [
              person.person_id,
              task_number,
              task_description || null,
              person.actual_end,
              planned_end,
              alloc,
            ]
          );
          created++;
        } else {
          // Dragged back: remove any existing planned work for this person/project
          const result = await client.query(
            `DELETE FROM planned_work WHERE person_id = $1 AND task_number = $2`,
            [person.person_id, task_number]
          );
          if ((result.rowCount ?? 0) > 0) removed++;
        }
      }
    });

    await logAudit("CREATE", "planned_work_batch", null, `Batch update for ${task_number}: ${created} created, ${removed} removed`);
    return NextResponse.json({
      message: "Batch planned work updated",
      peopleCount: people.length,
      created,
      removed,
    });
  } catch (error) {
    console.error("Error batch updating planned work:", error);
    return NextResponse.json(
      { error: "Failed to batch update planned work" },
      { status: 500 }
    );
  }
}
