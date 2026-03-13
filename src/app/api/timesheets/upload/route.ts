import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { parseTimesheets } from "@/lib/excel-parser";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const clientId = formData.get("clientId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const rows = parseTimesheets(buffer);

    // Get all known people for validation
    const people = await query<{ person: string }>("SELECT person FROM people");
    const knownPeople = new Set(people.map((p) => p.person));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const skippedUsers = new Set<string>();

    await withTransaction(async (client) => {
      const seenProjects = new Set<string>();

      for (const row of rows) {
        // Validate user exists in people table
        if (!knownPeople.has(row.user_name)) {
          skipped++;
          skippedUsers.add(row.user_name);
          continue;
        }

        // Auto-create project if it doesn't exist yet
        if (
          row.category === "Project" &&
          row.task_number &&
          !seenProjects.has(row.task_number)
        ) {
          seenProjects.add(row.task_number);
          await client.query(
            `INSERT INTO projects (task_number, task_description, client_id)
             VALUES ($1, $2, $3)
             ON CONFLICT(task_number) DO UPDATE SET
               client_id = COALESCE(projects.client_id, EXCLUDED.client_id)`,
            [row.task_number, row.task_description || null, clientId ? Number(clientId) : null]
          );
        }

        // Check if record exists (use COALESCE to handle NULL task_number/category)
        const existingResult = await client.query(
          "SELECT id FROM timesheets WHERE week_starts_on = $1 AND user_name = $2 AND COALESCE(task_number, '') = $3 AND COALESCE(category, '') = $4",
          [row.week_starts_on, row.user_name, row.task_number || '', row.category || '']
        );
        const existing = existingResult.rows[0];

        // Upsert timesheet entry
        await client.query(
          `INSERT INTO timesheets (week_starts_on, category, user_name, task_description, task_number, state, sunday, monday, tuesday, wednesday, thursday, friday, saturday, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT(week_starts_on, user_name, COALESCE(task_number, ''), COALESCE(category, '')) DO UPDATE SET
             task_description = EXCLUDED.task_description,
             state = EXCLUDED.state,
             sunday = EXCLUDED.sunday,
             monday = EXCLUDED.monday,
             tuesday = EXCLUDED.tuesday,
             wednesday = EXCLUDED.wednesday,
             thursday = EXCLUDED.thursday,
             friday = EXCLUDED.friday,
             saturday = EXCLUDED.saturday,
             total = EXCLUDED.total,
             updated_at = NOW()`,
          [row.week_starts_on, row.category, row.user_name, row.task_description, row.task_number, row.state, row.sunday, row.monday, row.tuesday, row.wednesday, row.thursday, row.friday, row.saturday, row.total]
        );

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }
    });

    await logAudit("CREATE", "timesheets_upload", null, `Uploaded ${rows.length} timesheets (${inserted} inserted, ${updated} updated, ${skipped} skipped)`);
    return NextResponse.json({
      message: "Upload successful",
      total: rows.length,
      inserted,
      updated,
      skipped,
      skippedUsers: Array.from(skippedUsers),
    });
  } catch (error) {
    console.error("Error uploading timesheets:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
