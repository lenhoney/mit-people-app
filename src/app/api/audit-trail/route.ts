import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") || "";
    const action = searchParams.get("action") || "";
    const entityType = searchParams.get("entityType") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "50")));

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (user) {
      conditions.push(`(a.user_name LIKE $${paramIndex} OR a.user_email LIKE $${paramIndex + 1})`);
      params.push(`%${user}%`, `%${user}%`);
      paramIndex += 2;
    }
    if (action) {
      conditions.push(`a.action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }
    if (entityType) {
      conditions.push(`a.entity_type = $${paramIndex}`);
      params.push(entityType);
      paramIndex++;
    }
    if (startDate) {
      conditions.push(`a.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`a.created_at <= $${paramIndex} || ' 23:59:59'`);
      params.push(endDate);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM audit_trail a ${where}`,
      params
    );

    const total = countRow?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const rowsResult = await query(
      `SELECT a.id, a.user_name, a.user_email, a.action, a.entity_type, a.entity_id, a.details, a.created_at
       FROM audit_trail a
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    // Get distinct entity types for filter dropdown
    const entityTypesResult = await query<{ entity_type: string }>(
      "SELECT DISTINCT entity_type FROM audit_trail ORDER BY entity_type"
    );
    const entityTypes = entityTypesResult.map((r: { entity_type: string }) => r.entity_type);

    // Get distinct users for filter dropdown
    const usersResult = await query<{ user_name: string }>(
      "SELECT DISTINCT user_name FROM audit_trail ORDER BY user_name"
    );
    const users = usersResult.map((r: { user_name: string }) => r.user_name);

    return NextResponse.json({
      data: rowsResult,
      pagination: { page, pageSize, total, totalPages },
      filters: { entityTypes, users },
    });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 });
  }
}
