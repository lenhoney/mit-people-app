import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const project = searchParams.get("project");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    let query = "SELECT * FROM timesheets WHERE 1=1";
    let countQuery = "SELECT COUNT(*) as total FROM timesheets WHERE 1=1";
    const params: Record<string, string> = {};

    if (user) {
      query += " AND user_name LIKE @user";
      countQuery += " AND user_name LIKE @user";
      params.user = `%${user}%`;
    }
    if (project) {
      query += " AND (task_description LIKE @project OR task_number LIKE @project)";
      countQuery += " AND (task_description LIKE @project OR task_number LIKE @project)";
      params.project = `%${project}%`;
    }
    if (category) {
      query += " AND category = @category";
      countQuery += " AND category = @category";
      params.category = category;
    }
    if (startDate) {
      query += " AND week_starts_on >= @startDate";
      countQuery += " AND week_starts_on >= @startDate";
      params.startDate = startDate;
    }
    if (endDate) {
      query += " AND week_starts_on <= @endDate";
      countQuery += " AND week_starts_on <= @endDate";
      params.endDate = endDate;
    }

    const totalRow = db.prepare(countQuery).get(params) as { total: number };
    const total = totalRow.total;

    query += " ORDER BY week_starts_on DESC, user_name ASC";
    query += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const timesheets = db.prepare(query).all(params);

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
