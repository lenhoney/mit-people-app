import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let matched = 0;
    let unmatched = 0;

    await withTransaction(async (client) => {
      // ── Pass 1: Insert/upsert all rows ──────────────────────────────
      for (const row of rows) {
        // Try to match kerb to people table
        let personId: number | null = null;
        let personName = row.person_name;

        if (row.kerb) {
          const personResult = await client.query(
            "SELECT id, person FROM people WHERE LOWER(kerb) = LOWER($1)",
            [row.kerb]
          );
          const person = personResult.rows[0] as
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
        const existingResult = await client.query(
          "SELECT id FROM personal_time_off WHERE COALESCE(kerb, '') = $1 AND COALESCE(person_name, '') = $2 AND start_date = $3 AND end_date = $4 AND type = $5 AND COALESCE(country, '') = $6",
          [row.kerb || '', personName || '', row.start_date, row.end_date, row.type, row.country || '']
        );
        const existing = existingResult.rows[0];

        // Upsert PTO entry
        await client.query(
          `INSERT INTO personal_time_off (person_id, person_name, kerb, start_date, end_date, type, leave_status, country, message, business_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT(COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, '')) DO UPDATE SET
             person_id = EXCLUDED.person_id,
             leave_status = EXCLUDED.leave_status,
             message = EXCLUDED.message,
             business_days = EXCLUDED.business_days,
             updated_at = NOW()`,
          [personId, personName, row.kerb || null, row.start_date, row.end_date, row.type, row.leave_status || null, row.country || null, row.message || null, bizDays]
        );

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }

      // ── Pass 2: Compute billable_days for ALL Personal/Sick entries ──
      // We recompute all entries (not just newly inserted) because new
      // holiday entries may affect previously uploaded leave entries.
      const personalSickResult = await client.query(
        `SELECT id, start_date, end_date, business_days, country
         FROM personal_time_off
         WHERE type IN ('Personal', 'Sick')`
      );
      const personalSickEntries = personalSickResult.rows as {
        id: number;
        start_date: string;
        end_date: string;
        business_days: number;
        country: string | null;
      }[];

      for (const entry of personalSickEntries) {
        if (!entry.country) {
          // No country → can't match holidays → billable = business
          await client.query(
            `UPDATE personal_time_off
             SET billable_days = $1, updated_at = NOW()
             WHERE id = $2`,
            [entry.business_days, entry.id]
          );
          continue;
        }

        // Find National Holiday entries for a given country that overlap a date range
        const holidaysResult = await client.query(
          `SELECT start_date, end_date
           FROM personal_time_off
           WHERE type = 'National Holiday'
             AND country = $1
             AND start_date <= $2
             AND end_date >= $3`,
          [entry.country, entry.end_date, entry.start_date]
        );
        const holidays = holidaysResult.rows as { start_date: string; end_date: string }[];

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
        await client.query(
          `UPDATE personal_time_off
           SET billable_days = $1, updated_at = NOW()
           WHERE id = $2`,
          [billable, entry.id]
        );
      }

      // National Holiday entries: billable_days = 0
      await client.query(
        `UPDATE personal_time_off SET billable_days = 0, updated_at = NOW()
         WHERE type = 'National Holiday'`
      );
    });

    await logAudit("CREATE", "pto_upload", null, `Uploaded ${rows.length} PTO entries (${inserted} new, ${updated} updated, ${matched} matched, ${unmatched} unmatched)`);
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
