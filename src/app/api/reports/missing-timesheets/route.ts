import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

// Day-level hours: only count hours for days whose actual date falls within the range
// $1 = startDate, $2 = endDate
const DAY_HOURS_SQL = `(
  CASE WHEN (t.week_starts_on::date + 0) BETWEEN $1::date AND $2::date THEN t.sunday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 1) BETWEEN $1::date AND $2::date THEN t.monday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 2) BETWEEN $1::date AND $2::date THEN t.tuesday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 3) BETWEEN $1::date AND $2::date THEN t.wednesday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 4) BETWEEN $1::date AND $2::date THEN t.thursday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 5) BETWEEN $1::date AND $2::date THEN t.friday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 6) BETWEEN $1::date AND $2::date THEN t.saturday ELSE 0 END
)`;

// Week overlaps the date range if the week's Saturday >= startDate AND week_starts_on <= endDate
const WEEK_OVERLAP_FILTER = `(t.week_starts_on::date + 6) >= $1::date AND t.week_starts_on <= $2::date`;

export async function GET(request: NextRequest) {
  const auth = await requirePermission("reports", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const person = searchParams.get("person");
    const clientId = searchParams.get("clientId");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Calculate expected business days in the range
    let expectedBusinessDays = 0;
    {
      const d = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      while (d <= end) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) expectedBusinessDays++;
        d.setDate(d.getDate() + 1);
      }
    }
    const expectedHours = expectedBusinessDays * 8;

    // Build params array: $1 = startDate, $2 = endDate, then dynamic params
    let paramIdx = 2;
    const params: (string | number)[] = [startDate, endDate];

    // When clientId is provided, only show people who have projects for this client
    // clientId uses the same positional param in both filters
    let clientIdParam = "";
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      clientIdParam = `$${++paramIdx}`;
      params.push(Number(clientId));
    }

    const clientPeopleFilter = clientId && clientId !== "null" && clientId !== "undefined"
      ? `AND p.id IN (
           SELECT DISTINCT pw2.person_id FROM planned_work pw2
           JOIN projects proj2 ON pw2.task_number = proj2.task_number
           WHERE proj2.client_id = ${clientIdParam}
           UNION
           SELECT DISTINCT p2.id FROM people p2
           JOIN timesheets t2 ON t2.user_name = p2.person
           JOIN projects proj2 ON t2.task_number = proj2.task_number
           WHERE proj2.client_id = ${clientIdParam}
         )`
      : "";

    // When clientId is provided, only count hours for projects belonging to this client
    const clientTimesheetFilter = clientId && clientId !== "null" && clientId !== "undefined"
      ? ` AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = ${clientIdParam})`
      : "";

    let personFilter = "";
    if (person) {
      personFilter = ` AND p.person ILIKE $${++paramIdx}`;
      params.push(`%${person}%`);
    }

    // Get all active people with their total logged hours for the date range
    const queryText = `
      SELECT
        p.id,
        p.person,
        p.photo,
        COALESCE(hours.total_hours, 0) as total_hours
      FROM people p
      LEFT JOIN (
        SELECT
          t.user_name,
          SUM(${DAY_HOURS_SQL}) as total_hours
        FROM timesheets t
        WHERE ${WEEK_OVERLAP_FILTER}
          ${clientTimesheetFilter}
        GROUP BY t.user_name
        HAVING SUM(${DAY_HOURS_SQL}) > 0
      ) hours ON hours.user_name = p.person
      WHERE COALESCE(p.status, 'Active') = 'Active'
        AND p.person NOT IN ('Dudley Kirkpatrick', 'Steven Petsinger', 'Terence Jordan', 'Werner Swiegers', 'Arno Grobler', 'Irene van der Walt', 'Johan le Roux', 'Avinash Mohan', 'Eric Abraham', 'Jay Santos')
        ${clientPeopleFilter}
        ${personFilter}
      ORDER BY COALESCE(hours.total_hours, 0) ASC, p.person ASC
    `;

    const rows = await query<{
      id: number;
      person: string;
      photo: string | null;
      total_hours: number;
    }>(queryText, params);

    return NextResponse.json({
      rows,
      expectedHours,
      expectedBusinessDays,
    });
  } catch (error) {
    console.error("Error generating missing timesheets report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
