import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

interface PTORow {
  person_name: string;
  kerb: string;
  start_date: string;
  end_date: string;
  type: string;
  leave_status: string;
  country: string;
  message: string;
}

/**
 * Parse date field to YYYY-MM-DD.
 * Supports: YYYY-MM-DD, M/D/YY, M/D/YYYY
 */
function parseDateField(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const trimmed = raw.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // M/D/YY or M/D/YYYY format
  const parts = trimmed.split("/");
  if (parts.length !== 3) return "";

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // Handle 2-digit year (25 → 2025, 26 → 2026, etc.)
  if (year < 100) {
    year += 2000;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Calculate business days (Mon-Fri) between two dates (inclusive).
 */
function businessDaysBetween(startStr: string, endStr: string): number {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Parse the CSV text into structured rows
 */
function parseCSV(text: string): PTORow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Skip header row
  const rows: PTORow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Parse CSV line respecting quoted fields
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;

    const name = (fields[0] || "").trim();
    const peopleRaw = (fields[1] || "").trim();
    const startDateRaw = (fields[2] || "").trim();
    const endDateRaw = (fields[3] || "").trim();
    const type = (fields[4] || "").trim();
    const leaveStatus = (fields[5] || "").trim();
    const country = (fields[6] || "").trim();
    const message = (fields[7] || "").trim();

    // Skip rows without dates
    if (!startDateRaw || !endDateRaw) continue;

    // Extract kerb from People column (strip @mit.edu)
    let kerb = "";
    if (peopleRaw) {
      kerb = peopleRaw.replace(/@mit\.edu$/i, "").trim();
    }

    const startDate = parseDateField(startDateRaw);
    const endDate = parseDateField(endDateRaw);

    if (!startDate || !endDate) continue;

    rows.push({
      person_name: name,
      kerb,
      start_date: startDate,
      end_date: endDate,
      type: type || "Personal",
      leave_status: leaveStatus,
      country,
      message,
    });
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields with commas inside
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Prepare statements
    const findPersonByKerb = db.prepare(
      "SELECT id, person FROM people WHERE LOWER(kerb) = LOWER(?)"
    );

    const upsertStmt = db.prepare(`
      INSERT INTO personal_time_off (person_id, person_name, kerb, start_date, end_date, type, leave_status, country, message, business_days)
      VALUES (@person_id, @person_name, @kerb, @start_date, @end_date, @type, @leave_status, @country, @message, @business_days)
      ON CONFLICT(COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, '')) DO UPDATE SET
        person_id = excluded.person_id,
        leave_status = excluded.leave_status,
        message = excluded.message,
        business_days = excluded.business_days,
        updated_at = datetime('now')
    `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let matched = 0;
    let unmatched = 0;

    // ── Pass 2 helpers: compute billable_days ──────────────────────────
    // Find National Holiday entries for a given country that overlap a date range
    const findOverlappingHolidays = db.prepare(`
      SELECT start_date, end_date
      FROM personal_time_off
      WHERE type = 'National Holiday'
        AND country = @country
        AND start_date <= @leave_end
        AND end_date >= @leave_start
    `);

    const updateBillableDays = db.prepare(`
      UPDATE personal_time_off
      SET billable_days = @billable_days, updated_at = datetime('now')
      WHERE id = @id
    `);

    const transaction = db.transaction(() => {
      // ── Pass 1: Insert/upsert all rows ──────────────────────────────
      for (const row of rows) {
        // Try to match kerb to people table
        let personId: number | null = null;
        let personName = row.person_name;

        if (row.kerb) {
          const person = findPersonByKerb.get(row.kerb) as
            | { id: number; person: string }
            | undefined;
          if (person) {
            personId = person.id;
            // Use the canonical name from people table if available
            if (!personName) personName = person.person;
            matched++;
          } else {
            unmatched++;
          }
        } else {
          // National holidays without a person — skip matching
          skipped++;
        }

        const bizDays = businessDaysBetween(row.start_date, row.end_date);

        // Check if row already exists for upsert tracking (use COALESCE for NULL handling)
        const existing = db
          .prepare(
            "SELECT id FROM personal_time_off WHERE COALESCE(kerb, '') = ? AND COALESCE(person_name, '') = ? AND start_date = ? AND end_date = ? AND type = ? AND COALESCE(country, '') = ?"
          )
          .get(row.kerb || '', personName || '', row.start_date, row.end_date, row.type, row.country || '');

        upsertStmt.run({
          person_id: personId,
          person_name: personName,
          kerb: row.kerb || null,
          start_date: row.start_date,
          end_date: row.end_date,
          type: row.type,
          leave_status: row.leave_status || null,
          country: row.country || null,
          message: row.message || null,
          business_days: bizDays,
        });

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }

      // ── Pass 2: Compute billable_days for ALL Personal/Sick entries ──
      // We recompute all entries (not just newly inserted) because new
      // holiday entries may affect previously uploaded leave entries.
      const personalSickEntries = db
        .prepare(
          `SELECT id, start_date, end_date, business_days, country
           FROM personal_time_off
           WHERE type IN ('Personal', 'Sick')`
        )
        .all() as {
        id: number;
        start_date: string;
        end_date: string;
        business_days: number;
        country: string | null;
      }[];

      for (const entry of personalSickEntries) {
        if (!entry.country) {
          // No country → can't match holidays → billable = business
          updateBillableDays.run({
            billable_days: entry.business_days,
            id: entry.id,
          });
          continue;
        }

        const holidays = findOverlappingHolidays.all({
          country: entry.country,
          leave_start: entry.start_date,
          leave_end: entry.end_date,
        }) as { start_date: string; end_date: string }[];

        // Collect unique weekday holiday dates within the leave period
        const holidayDates = new Set<string>();
        for (const h of holidays) {
          const hStart = new Date(
            Math.max(
              new Date(h.start_date + "T00:00:00").getTime(),
              new Date(entry.start_date + "T00:00:00").getTime()
            )
          );
          const hEnd = new Date(
            Math.min(
              new Date(h.end_date + "T00:00:00").getTime(),
              new Date(entry.end_date + "T00:00:00").getTime()
            )
          );
          const d = new Date(hStart);
          while (d <= hEnd) {
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) {
              holidayDates.add(d.toISOString().slice(0, 10));
            }
            d.setDate(d.getDate() + 1);
          }
        }

        const billable = Math.max(0, entry.business_days - holidayDates.size);
        updateBillableDays.run({ billable_days: billable, id: entry.id });
      }

      // National Holiday entries: billable_days = 0
      db.prepare(
        `UPDATE personal_time_off SET billable_days = 0, updated_at = datetime('now')
         WHERE type = 'National Holiday'`
      ).run();
    });

    transaction();

    return NextResponse.json({
      message: "PTO upload successful",
      total: rows.length,
      inserted,
      updated,
      matched,
      unmatched,
      skippedNoPerson: skipped,
    });
  } catch (error) {
    console.error("Error uploading PTO data:", error);
    return NextResponse.json(
      { error: "Failed to process PTO upload" },
      { status: 500 }
    );
  }
}
