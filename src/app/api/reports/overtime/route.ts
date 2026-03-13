import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const person = searchParams.get("person");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Build params array: $1 = startDate, $2 = endDate, then dynamic params
    let paramIdx = 2;
    const params: (string | number)[] = [startDate, endDate];

    let personFilter = "";
    if (person) {
      personFilter = ` AND t.user_name ILIKE $${++paramIdx}`;
      params.push(`%${person}%`);
    }

    // Find all people who booked > 40 hours in any single week within the date range.
    // We sum per-person per-week, then filter for totals > 40.
    // Also collect the project task descriptions they worked on that week.
    const queryText = `
      SELECT
        t.user_name,
        p.photo,
        t.week_starts_on,
        SUM(t.total) as week_total,
        STRING_AGG(
          CASE WHEN t.category = 'Project' AND t.task_description IS NOT NULL
            THEN t.task_description
            ELSE NULL
          END, '||'
        ) as projects
      FROM timesheets t
      JOIN people p ON p.person = t.user_name
      WHERE (t.week_starts_on::date + 6) >= $1::date
        AND t.week_starts_on <= $2::date
        AND COALESCE(p.status, 'Active') = 'Active'
        ${personFilter}
      GROUP BY t.user_name, p.photo, t.week_starts_on
      HAVING SUM(t.total) > 40
      ORDER BY t.week_starts_on DESC, SUM(t.total) DESC
    `;

    const rows = await query<{
      user_name: string;
      photo: string | null;
      week_starts_on: string;
      week_total: number;
      projects: string | null;
    }>(queryText, params);

    // Deduplicate project names per row
    const cleaned = rows.map((r) => {
      const projectList = r.projects
        ? [...new Set(r.projects.split("||").filter(Boolean))]
        : [];
      return {
        person: r.user_name,
        photo: r.photo,
        week_starts_on: r.week_starts_on,
        week_total: r.week_total,
        projects: projectList,
      };
    });

    return NextResponse.json({ rows: cleaned });
  } catch (error) {
    console.error("Error generating overtime report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
