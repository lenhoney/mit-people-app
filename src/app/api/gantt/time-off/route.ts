import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

interface PTORow {
  id: number;
  person_id: number | null;
  person_name: string;
  start_date: string;
  end_date: string;
  type: string;
  country: string | null;
  message: string | null;
  business_days: number;
  matched_person: string | null;
}

interface PhotoRow {
  id: number;
  photo: string;
}

const TYPE_ORDER: Record<string, number> = {
  "National Holiday": 0,
  Personal: 1,
  Sick: 2,
};

export async function GET(request: NextRequest) {
  const auth = await requirePermission("time-off", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const personFilter = searchParams.get("person");

    const params: unknown[] = [];
    const conditions: string[] = [];
    let paramIdx = 1;

    if (personFilter) {
      conditions.push(
        `(pto.person_name ILIKE $${paramIdx} OR p.person ILIKE $${paramIdx})`
      );
      params.push(`%${personFilter}%`);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";

    // Fetch PTO entries joined with people
    const rows = await query<PTORow>(
      `SELECT pto.id, pto.person_id, pto.person_name,
              pto.start_date, pto.end_date, pto.type,
              pto.country, pto.message, pto.business_days,
              p.person as matched_person
       FROM personal_time_off pto
       LEFT JOIN people p ON pto.person_id = p.id
       WHERE 1=1${whereClause}
       ORDER BY pto.type, COALESCE(p.person, pto.person_name), pto.start_date`,
      params
    );

    // Build photo lookup (same pattern as /api/gantt/route.ts)
    const photoRows = await query<PhotoRow>(
      "SELECT id, photo FROM people WHERE photo IS NOT NULL"
    );
    const photoMap = new Map<number, string>();
    for (const r of photoRows) {
      photoMap.set(r.id, r.photo);
    }

    // Group by type -> people -> entries
    const typeMap = new Map<
      string,
      Map<
        string,
        {
          person_key: string;
          person_id: number | null;
          person_name: string;
          photo: string | null;
          entries: {
            id: number;
            start_date: string;
            end_date: string;
            country: string | null;
            message: string | null;
            business_days: number;
          }[];
        }
      >
    >();

    let globalMinDate = "";
    let globalMaxDate = "";

    for (const row of rows) {
      const ptoType = row.type || "Personal";

      if (!typeMap.has(ptoType)) {
        typeMap.set(ptoType, new Map());
      }
      const peopleMap = typeMap.get(ptoType)!;

      // Use person_id as key when available, fallback to person_name
      const personKey = row.person_id
        ? String(row.person_id)
        : row.person_name || "Unknown";
      const displayName =
        row.matched_person || row.person_name || "Unknown";

      if (!peopleMap.has(personKey)) {
        peopleMap.set(personKey, {
          person_key: personKey,
          person_id: row.person_id,
          person_name: displayName,
          photo: row.person_id ? photoMap.get(row.person_id) || null : null,
          entries: [],
        });
      }

      peopleMap.get(personKey)!.entries.push({
        id: row.id,
        start_date: row.start_date,
        end_date: row.end_date,
        country: row.country,
        message: row.message,
        business_days: row.business_days,
      });

      // Track global date range
      if (!globalMinDate || row.start_date < globalMinDate)
        globalMinDate = row.start_date;
      if (!globalMaxDate || row.end_date > globalMaxDate)
        globalMaxDate = row.end_date;
    }

    // Build sorted response
    const types = Array.from(typeMap.entries())
      .sort(
        ([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99)
      )
      .map(([type, peopleMap]) => ({
        type,
        people: Array.from(peopleMap.values()).sort((a, b) =>
          a.person_name.localeCompare(b.person_name)
        ),
      }));

    return NextResponse.json({
      types,
      dateRange: {
        start: globalMinDate || new Date().toISOString().slice(0, 10),
        end: globalMaxDate || new Date().toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Error fetching time-off gantt data:", error);
    return NextResponse.json(
      { error: "Failed to fetch time-off gantt data" },
      { status: 500 }
    );
  }
}
