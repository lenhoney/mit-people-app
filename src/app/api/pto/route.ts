import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personFilter = searchParams.get("person");
    const typeFilter = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let paramIdx = 1;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (personFilter) {
      conditions.push(`(pto.person_name ILIKE $${paramIdx} OR p.person ILIKE $${paramIdx} OR pto.kerb ILIKE $${paramIdx})`);
      params.push(`%${personFilter}%`);
      paramIdx++;
    }

    if (typeFilter) {
      conditions.push(`pto.type = $${paramIdx++}`);
      params.push(typeFilter);
    }

    if (startDate) {
      conditions.push(`pto.end_date >= $${paramIdx++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`pto.start_date <= $${paramIdx++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";

    const sql = `
      SELECT pto.id, pto.person_id, pto.person_name, pto.kerb,
             pto.start_date, pto.end_date, pto.type, pto.leave_status,
             pto.country, pto.message, pto.business_days, pto.billable_days,
             p.person as matched_person
      FROM personal_time_off pto
      LEFT JOIN people p ON pto.person_id = p.id
      WHERE 1=1${whereClause}
      ORDER BY pto.start_date DESC, pto.person_name ASC
    `;

    const rows = await query(sql, params);

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

    await execute("DELETE FROM personal_time_off WHERE id = $1", [id]);
    await logAudit("DELETE", "pto", id, `Deleted PTO entry ID: ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting PTO entry:", error);
    return NextResponse.json(
      { error: "Failed to delete PTO entry" },
      { status: 500 }
    );
  }
}
