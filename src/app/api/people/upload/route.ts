import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { parsePeopleRates, makeFY, dateToFYEndYear } from "@/lib/excel-parser";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fyEndYearParam = formData.get("fyEndYear") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Determine the financial year for this rate upload
    // Default to the current FY based on today's date
    const fyEndYear = fyEndYearParam
      ? parseInt(fyEndYearParam)
      : dateToFYEndYear(new Date().toISOString().split("T")[0]);

    const fy = makeFY(fyEndYear);

    const buffer = await file.arrayBuffer();
    const rows = parsePeopleRates(buffer);

    // Upsert people: on conflict, update fields but NEVER overwrite status
    // (status is only changed manually via the Edit Person dialog)
    const upsertPersonStmt = db.prepare(`
      INSERT INTO people (person, sow, role, kerb, managed_services, architecture, app_support, computing, status)
      VALUES (@person, @sow, @role, @kerb, @managed_services, @architecture, @app_support, @computing, 'Active')
      ON CONFLICT(person) DO UPDATE SET
        sow = excluded.sow,
        role = excluded.role,
        kerb = excluded.kerb,
        managed_services = excluded.managed_services,
        architecture = excluded.architecture,
        app_support = excluded.app_support,
        computing = excluded.computing,
        updated_at = datetime('now')
    `);

    const getPersonId = db.prepare("SELECT id FROM people WHERE person = ?");

    const upsertRateStmt = db.prepare(`
      INSERT INTO people_rates (person_id, fy_start, fy_end, fy_label, rate)
      VALUES (@person_id, @fy_start, @fy_end, @fy_label, @rate)
      ON CONFLICT(person_id, fy_label) DO UPDATE SET
        rate = excluded.rate,
        fy_start = excluded.fy_start,
        fy_end = excluded.fy_end
    `);

    let insertedPeople = 0;
    let updatedPeople = 0;
    let ratesSet = 0;

    const transaction = db.transaction(() => {
      for (const row of rows) {
        const existing = getPersonId.get(row.person) as { id: number } | undefined;
        upsertPersonStmt.run(row);

        if (existing) {
          updatedPeople++;
        } else {
          insertedPeople++;
        }

        const personRow = getPersonId.get(row.person) as { id: number };

        if (row.rate !== null && row.rate > 0) {
          upsertRateStmt.run({
            person_id: personRow.id,
            fy_start: fy.fy_start,
            fy_end: fy.fy_end,
            fy_label: fy.fy_label,
            rate: row.rate,
          });
          ratesSet++;
        }
      }
    });

    transaction();

    await logAudit("CREATE", "people_upload", null, `Uploaded ${rows.length} people (${insertedPeople} new, ${updatedPeople} updated, ${ratesSet} rates set) for ${fy.fy_label}`);
    return NextResponse.json({
      message: "Upload successful",
      total: rows.length,
      insertedPeople,
      updatedPeople,
      ratesSet,
      financialYear: fy.fy_label,
      fyPeriod: `${fy.fy_start} to ${fy.fy_end}`,
    });
  } catch (error) {
    console.error("Error uploading people rates:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
