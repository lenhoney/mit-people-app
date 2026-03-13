import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
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

    let insertedPeople = 0;
    let updatedPeople = 0;
    let ratesSet = 0;

    await withTransaction(async (client) => {
      for (const row of rows) {
        // Check if person already exists
        const existingResult = await client.query(
          "SELECT id FROM people WHERE person = $1",
          [row.person]
        );
        const existing = existingResult.rows[0] as { id: number } | undefined;

        // Upsert person: on conflict, update fields but NEVER overwrite status
        // (status is only changed manually via the Edit Person dialog)
        await client.query(
          `INSERT INTO people (person, sow, role, kerb, managed_services, architecture, app_support, computing, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')
           ON CONFLICT(person) DO UPDATE SET
             sow = EXCLUDED.sow,
             role = EXCLUDED.role,
             kerb = EXCLUDED.kerb,
             managed_services = EXCLUDED.managed_services,
             architecture = EXCLUDED.architecture,
             app_support = EXCLUDED.app_support,
             computing = EXCLUDED.computing,
             updated_at = NOW()`,
          [row.person, row.sow, row.role, row.kerb, row.managed_services, row.architecture, row.app_support, row.computing]
        );

        if (existing) {
          updatedPeople++;
        } else {
          insertedPeople++;
        }

        // Get the person id (either existing or newly inserted)
        const personResult = await client.query(
          "SELECT id FROM people WHERE person = $1",
          [row.person]
        );
        const personRow = personResult.rows[0] as { id: number };

        if (row.rate !== null && row.rate > 0) {
          await client.query(
            `INSERT INTO people_rates (person_id, fy_start, fy_end, fy_label, rate)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT(person_id, fy_label) DO UPDATE SET
               rate = EXCLUDED.rate,
               fy_start = EXCLUDED.fy_start,
               fy_end = EXCLUDED.fy_end`,
            [personRow.id, fy.fy_start, fy.fy_end, fy.fy_label, row.rate]
          );
          ratesSet++;
        }
      }
    });

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
