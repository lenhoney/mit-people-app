import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

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

    // Find all people who booked > 40 hours in any single week within the date range.
    // We sum per-person per-week, then filter for totals > 40.
    // Also collect the project task descriptions they worked on that week.
    let query = `
      SELECT
        t.user_name,
        p.photo,
        t.week_starts_on,
        SUM(t.total) as week_total,
        GROUP_CONCAT(
          CASE WHEN t.category = 'Project' AND t.task_description IS NOT NULL
            THEN t.task_description
            ELSE NULL
          END, '||'
        ) as projects
      FROM timesheets t
      JOIN people p ON p.person = t.user_name
      WHERE date(t.week_starts_on, '+6 days') >= @startDate
        AND t.week_starts_on <= @endDate
        AND COALESCE(p.status, 'Active') = 'Active'
    `;

    const params: Record<string, string> = { startDate, endDate };

    if (person) {
      query += " AND t.user_name LIKE @person";
      params.person = `%${person}%`;
    }

    query += `
      GROUP BY t.user_name, t.week_starts_on
      HAVING week_total > 40
      ORDER BY t.week_starts_on DESC, week_total DESC
    `;

    const rows = db.prepare(query).all(params) as {
      user_name: string;
      photo: string | null;
      week_starts_on: string;
      week_total: number;
      projects: string | null;
    }[];

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
