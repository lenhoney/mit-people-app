import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

interface ProjectReportRow {
  task_number: string;
  task_description: string;
  user_name: string;
  total_hours: number;
  revenue: number;
}

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
    const project = searchParams.get("project");
    const clientId = searchParams.get("clientId");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const clientFilter = clientId
      ? " AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = @clientId)"
      : "";

    let query = `
      SELECT
        t.task_number,
        t.task_description,
        t.user_name,
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
    `;

    const params: Record<string, string | number> = { startDate, endDate };
    if (clientId) {
      params.clientId = Number(clientId);
    }

    if (project) {
      query += " AND (t.task_description LIKE @project OR t.task_number LIKE @project)";
      params.project = `%${project}%`;
    }

    query += " GROUP BY t.task_number, t.task_description, t.user_name HAVING total_hours > 0 ORDER BY t.task_number, t.user_name";

    const rows = db.prepare(query).all(params) as ProjectReportRow[];

    // Summary grouped by project
    let summaryQuery = `
      SELECT
        t.task_number,
        t.task_description,
        COUNT(DISTINCT t.user_name) as people_count,
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
    `;

    if (project) {
      summaryQuery += " AND (t.task_description LIKE @project OR t.task_number LIKE @project)";
    }

    summaryQuery += " GROUP BY t.task_number, t.task_description HAVING total_hours > 0 ORDER BY revenue DESC";

    const summary = db.prepare(summaryQuery).all(params);

    return NextResponse.json({ details: rows, summary });
  } catch (error) {
    console.error("Error generating project report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
