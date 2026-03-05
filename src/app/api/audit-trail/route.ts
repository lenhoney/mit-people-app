import { NextResponse } from "next/server";
import db from "@/lib/db";

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

    if (user) {
      conditions.push("(a.user_name LIKE ? OR a.user_email LIKE ?)");
      params.push(`%${user}%`, `%${user}%`);
    }
    if (action) {
      conditions.push("a.action = ?");
      params.push(action);
    }
    if (entityType) {
      conditions.push("a.entity_type = ?");
      params.push(entityType);
    }
    if (startDate) {
      conditions.push("a.created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("a.created_at <= ? || ' 23:59:59'");
      params.push(endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM audit_trail a ${where}`
    ).get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT a.id, a.user_name, a.user_email, a.action, a.entity_type, a.entity_id, a.details, a.created_at
       FROM audit_trail a
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    // Get distinct entity types for filter dropdown
    const entityTypes = (db.prepare(
      "SELECT DISTINCT entity_type FROM audit_trail ORDER BY entity_type"
    ).all() as { entity_type: string }[]).map(r => r.entity_type);

    // Get distinct users for filter dropdown
    const users = (db.prepare(
      "SELECT DISTINCT user_name FROM audit_trail ORDER BY user_name"
    ).all() as { user_name: string }[]).map(r => r.user_name);

    return NextResponse.json({
      data: rows,
      pagination: { page, pageSize, total, totalPages },
      filters: { entityTypes, users },
    });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 });
  }
}
