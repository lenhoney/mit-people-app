import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personFilter = searchParams.get("person");
    const typeFilter = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = `
      SELECT pto.id, pto.person_id, pto.person_name, pto.kerb,
             pto.start_date, pto.end_date, pto.type, pto.leave_status,
             pto.country, pto.message, pto.business_days, pto.billable_days,
             p.person as matched_person
      FROM personal_time_off pto
      LEFT JOIN people p ON pto.person_id = p.id
      WHERE 1=1
    `;
    const params: Record<string, string> = {};

    if (personFilter) {
      query += " AND (pto.person_name LIKE @person OR p.person LIKE @person OR pto.kerb LIKE @person)";
      params.person = `%${personFilter}%`;
    }

    if (typeFilter) {
      query += " AND pto.type = @type";
      params.type = typeFilter;
    }

    if (startDate) {
      query += " AND pto.end_date >= @startDate";
      params.startDate = startDate;
    }

    if (endDate) {
      query += " AND pto.start_date <= @endDate";
      params.endDate = endDate;
    }

    query += " ORDER BY pto.start_date DESC, pto.person_name ASC";

    const rows = db.prepare(query).all(params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching PTO data:", error);
    return NextResponse.json(
      { error: "Failed to fetch PTO data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    db.prepare("DELETE FROM personal_time_off WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting PTO entry:", error);
    return NextResponse.json(
      { error: "Failed to delete PTO entry" },
      { status: 500 }
    );
  }
}
