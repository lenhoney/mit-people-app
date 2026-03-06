import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Day-level hours: only count hours for days whose actual date falls within the range
const DAY_HOURS_SQL = `(
  CASE WHEN date(t.week_starts_on, '+0 days') BETWEEN @startDate AND @endDate THEN t.sunday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+1 days') BETWEEN @startDate AND @endDate THEN t.monday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+2 days') BETWEEN @startDate AND @endDate THEN t.tuesday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+3 days') BETWEEN @startDate AND @endDate THEN t.wednesday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+4 days') BETWEEN @startDate AND @endDate THEN t.thursday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+5 days') BETWEEN @startDate AND @endDate THEN t.friday ELSE 0 END +
  CASE WHEN date(t.week_starts_on, '+6 days') BETWEEN @startDate AND @endDate THEN t.saturday ELSE 0 END
)`;

// Week overlaps the date range if the week's Saturday >= startDate AND week_starts_on <= endDate
const WEEK_OVERLAP_FILTER = `date(t.week_starts_on, '+6 days') >= @startDate AND t.week_starts_on <= @endDate`;

export async function GET(request: NextRequest) {
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

    // When clientId is provided, only show people who have projects for this client
    const clientPeopleFilter = clientId
      ? `AND p.id IN (
           SELECT DISTINCT pw2.person_id FROM planned_work pw2
           JOIN projects proj2 ON pw2.task_number = proj2.task_number
           WHERE proj2.client_id = @clientId
           UNION
           SELECT DISTINCT p2.id FROM people p2
           JOIN timesheets t2 ON t2.user_name = p2.person
           JOIN projects proj2 ON t2.task_number = proj2.task_number
           WHERE proj2.client_id = @clientId
         )`
      : "";

    // When clientId is provided, only count hours for projects belonging to this client
    const clientTimesheetFilter = clientId
      ? " AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = @clientId)"
      : "";

    // Get all active people with their total logged hours for the date range
    let query = `
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
        HAVING total_hours > 0
      ) hours ON hours.user_name = p.person
      WHERE COALESCE(p.status, 'Active') = 'Active'
        AND p.person NOT IN ('Dudley Kirkpatrick', 'Steven Petsinger', 'Terence Jordan', 'Werner Swiegers', 'Arno Grobler', 'Irene van der Walt', 'Johan le Roux', 'Avinash Mohan', 'Eric Abraham', 'Jay Santos')
        ${clientPeopleFilter}
    `;

    const params: Record<string, string | number> = { startDate, endDate };
    if (clientId) {
      params.clientId = Number(clientId);
    }

    if (person) {
      query += " AND p.person LIKE @person";
      params.person = `%${person}%`;
    }

    query += " ORDER BY COALESCE(hours.total_hours, 0) ASC, p.person ASC";

    const rows = db.prepare(query).all(params) as {
      id: number;
      person: string;
      photo: string | null;
      total_hours: number;
    }[];

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
