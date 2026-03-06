import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
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
    const people = db.prepare("SELECT person FROM people").all() as { person: string }[];
    const knownPeople = new Set(people.map((p) => p.person));

    const upsertStmt = db.prepare(`
      INSERT INTO timesheets (week_starts_on, category, user_name, task_description, task_number, state, sunday, monday, tuesday, wednesday, thursday, friday, saturday, total)
      VALUES (@week_starts_on, @category, @user_name, @task_description, @task_number, @state, @sunday, @monday, @tuesday, @wednesday, @thursday, @friday, @saturday, @total)
      ON CONFLICT(week_starts_on, user_name, COALESCE(task_number, ''), COALESCE(category, '')) DO UPDATE SET
        task_description = excluded.task_description,
        state = excluded.state,
        sunday = excluded.sunday,
        monday = excluded.monday,
        tuesday = excluded.tuesday,
        wednesday = excluded.wednesday,
        thursday = excluded.thursday,
        friday = excluded.friday,
        saturday = excluded.saturday,
        total = excluded.total,
        updated_at = datetime('now')
    `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const skippedUsers = new Set<string>();

    // Prepared statement to auto-create projects
    const projectUpsertStmt = db.prepare(`
      INSERT INTO projects (task_number, task_description, client_id)
      VALUES (?, ?, ?)
      ON CONFLICT(task_number) DO UPDATE SET
        client_id = COALESCE(projects.client_id, excluded.client_id)
    `);

    const transaction = db.transaction(() => {
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
          projectUpsertStmt.run(row.task_number, row.task_description || null, clientId ? Number(clientId) : null);
        }

        // Check if record exists (use COALESCE to handle NULL task_number/category)
        const existing = db.prepare(
          "SELECT id FROM timesheets WHERE week_starts_on = ? AND user_name = ? AND COALESCE(task_number, '') = ? AND COALESCE(category, '') = ?"
        ).get(row.week_starts_on, row.user_name, row.task_number || '', row.category || '');

        upsertStmt.run(row);

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }
    });

    transaction();

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
