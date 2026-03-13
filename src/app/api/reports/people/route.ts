import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface PeopleReportRow {
  user_name: string;
  task_number: string;
  task_description: string;
  total_hours: number;
  revenue: number;
}

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

    // Build params array: $1 = startDate, $2 = endDate, then dynamic params
    let paramIdx = 2;
    const params: (string | number)[] = [startDate, endDate];

    const clientFilter = clientId && clientId !== "null" && clientId !== "undefined"
      ? ` AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = $${++paramIdx})`
      : "";
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      params.push(Number(clientId));
    }

    let personFilter = "";
    if (person) {
      personFilter = ` AND t.user_name ILIKE $${++paramIdx}`;
      params.push(`%${person}%`);
    }

    const detailQuery = `
      SELECT
        t.user_name,
        t.task_number,
        t.task_description,
        SUM(${DAY_HOURS_SQL}) as total_hours,
        SUM(${DAY_HOURS_SQL} * COALESCE(pr.rate, 0)) as revenue
      FROM timesheets t
      JOIN people p ON t.user_name = p.person
      LEFT JOIN people_rates pr ON pr.person_id = p.id
        AND t.week_starts_on >= pr.fy_start
        AND t.week_starts_on <= pr.fy_end
      WHERE t.category = 'Project'
        AND ${WEEK_OVERLAP_FILTER}
        ${clientFilter}
        ${personFilter}
      GROUP BY t.user_name, t.task_number, t.task_description HAVING SUM(${DAY_HOURS_SQL}) > 0 ORDER BY t.user_name, SUM(${DAY_HOURS_SQL}) DESC
    `;

    const rows = await query<PeopleReportRow>(detailQuery, params);

    // Summary grouped by person
    const summaryQuery = `
      SELECT
        t.user_name,
        p.role,
        p.sow,
        COUNT(DISTINCT t.task_number) as project_count,
        SUM(${DAY_HOURS_SQL}) as total_hours,
        SUM(${DAY_HOURS_SQL} * COALESCE(pr.rate, 0)) as revenue
      FROM timesheets t
      JOIN people p ON t.user_name = p.person
      LEFT JOIN people_rates pr ON pr.person_id = p.id
        AND t.week_starts_on >= pr.fy_start
        AND t.week_starts_on <= pr.fy_end
      WHERE t.category = 'Project'
        AND ${WEEK_OVERLAP_FILTER}
        ${clientFilter}
        ${personFilter}
      GROUP BY t.user_name, p.role, p.sow HAVING SUM(${DAY_HOURS_SQL}) > 0 ORDER BY SUM(${DAY_HOURS_SQL}) DESC
    `;

    const summary = await query(summaryQuery, params);

    return NextResponse.json({ details: rows, summary });
  } catch (error) {
    console.error("Error generating people report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
