import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface PTOPersonSummary {
  person_name: string;
  matched_person: string | null;
  person_id: number | null;
  total_entries: number;
  total_business_days: number;
  personal_days: number;
  sick_days: number;
  holiday_days: number;
}

interface PTODetail {
  id: number;
  person_name: string;
  matched_person: string | null;
  kerb: string | null;
  start_date: string;
  end_date: string;
  type: string;
  leave_status: string | null;
  country: string | null;
  message: string | null;
  business_days: number;
  billable_days: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const person = searchParams.get("person");
    const type = searchParams.get("type");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Build WHERE clause with positional params
    let paramIdx = 0;
    const params: (string | number)[] = [];

    let whereClause = `WHERE pto.end_date >= $${++paramIdx} AND pto.start_date <= $${++paramIdx}`;
    params.push(startDate, endDate);

    if (person) {
      const personParam = `$${++paramIdx}`;
      whereClause +=
        ` AND (pto.person_name ILIKE ${personParam} OR p.person ILIKE ${personParam} OR pto.kerb ILIKE ${personParam})`;
      params.push(`%${person}%`);
    }

    if (type && type !== "all") {
      whereClause += ` AND pto.type = $${++paramIdx}`;
      params.push(type);
    }

    // Detail query
    const detailQuery = `
      SELECT pto.id, pto.person_name, p.person as matched_person,
             pto.kerb, pto.start_date, pto.end_date, pto.type,
             pto.leave_status, pto.country, pto.message, pto.business_days,
             pto.billable_days
      FROM personal_time_off pto
      LEFT JOIN people p ON pto.person_id = p.id
      ${whereClause}
      ORDER BY pto.start_date ASC, pto.person_name ASC
    `;

    const details = await query<PTODetail>(detailQuery, params);

    // Summary query: aggregate per person
    const summaryQuery = `
      SELECT
        COALESCE(p.person, pto.person_name) as display_name,
        pto.person_id,
        COUNT(*) as total_entries,
        SUM(pto.business_days) as total_business_days,
        SUM(CASE WHEN pto.type = 'Personal' THEN pto.business_days ELSE 0 END) as personal_days,
        SUM(CASE WHEN pto.type = 'Sick' THEN pto.business_days ELSE 0 END) as sick_days,
        SUM(CASE WHEN pto.type = 'National Holiday' THEN pto.business_days ELSE 0 END) as holiday_days,
        SUM(CASE WHEN pto.type IN ('Personal', 'Sick') THEN COALESCE(pto.billable_days, pto.business_days) ELSE 0 END) as total_billable_days
      FROM personal_time_off pto
      LEFT JOIN people p ON pto.person_id = p.id
      ${whereClause}
      GROUP BY COALESCE(p.person, pto.person_name), pto.person_id
      ORDER BY total_business_days DESC
    `;

    const summary = await query<{
      display_name: string;
      person_id: number | null;
      total_entries: number;
      total_business_days: number;
      personal_days: number;
      sick_days: number;
      holiday_days: number;
      total_billable_days: number;
    }>(summaryQuery, params);

    // Totals
    const totalDays = details.reduce((sum, d) => sum + d.business_days, 0);
    const totalBillableDays = details
      .filter((d) => d.type !== "National Holiday")
      .reduce((sum, d) => sum + (d.billable_days ?? d.business_days), 0);
    const totalEntries = details.length;
    const uniquePeople = new Set(
      details
        .filter((d) => d.matched_person || d.person_name)
        .map((d) => d.matched_person || d.person_name)
    ).size;

    return NextResponse.json({
      details,
      summary,
      totals: {
        totalDays,
        totalBillableDays,
        totalEntries,
        uniquePeople,
      },
    });
  } catch (error) {
    console.error("Error generating PTO report:", error);
    return NextResponse.json(
      { error: "Failed to generate PTO report" },
      { status: 500 }
    );
  }
}
