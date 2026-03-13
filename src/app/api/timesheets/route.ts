import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("timesheets", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const project = searchParams.get("project");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    let paramIdx = 1;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (user) {
      conditions.push(`user_name ILIKE $${paramIdx++}`);
      params.push(`%${user}%`);
    }
    if (project) {
      conditions.push(`(task_description ILIKE $${paramIdx} OR task_number ILIKE $${paramIdx})`);
      params.push(`%${project}%`);
      paramIdx++;
    }
    if (category) {
      conditions.push(`category = $${paramIdx++}`);
      params.push(category);
    }
    if (startDate) {
      conditions.push(`week_starts_on >= $${paramIdx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`week_starts_on <= $${paramIdx++}`);
      params.push(endDate);
    }
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      conditions.push(`task_number IN (SELECT task_number FROM projects WHERE client_id = $${paramIdx++})`);
      params.push(Number(clientId));
    }

    const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

    const countQuery = `SELECT COUNT(*) as total FROM timesheets${whereClause}`;
    const totalRow = await queryOne<{ total: string }>(countQuery, params);
    const total = Number(totalRow?.total ?? 0);

    const dataQuery = `SELECT * FROM timesheets${whereClause} ORDER BY week_starts_on DESC, user_name ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const timesheets = await query(dataQuery, dataParams);

    return NextResponse.json({
      data: timesheets,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    return NextResponse.json({ error: "Failed to fetch timesheets" }, { status: 500 });
  }
}
