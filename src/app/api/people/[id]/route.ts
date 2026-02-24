import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      person, sow, role, kerb,
      managed_services, architecture, app_support, computing,
      phone, work_anniversary, birthday, manager_name, business_unit,
      status, country,
    } = body;

    const stmt = db.prepare(`
      UPDATE people SET
        person = ?, sow = ?, role = ?, kerb = ?,
        managed_services = ?, architecture = ?, app_support = ?, computing = ?,
        phone = ?, work_anniversary = ?, birthday = ?, manager_name = ?, business_unit = ?,
        status = ?, country = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      person, sow || null, role || null,
      kerb || null, managed_services ? 1 : 0, architecture ? 1 : 0,
      app_support ? 1 : 0, computing ? 1 : 0, phone || null,
      work_anniversary || null, birthday || null, manager_name || null,
      business_unit || null, status || "Active", country || "South Africa", id
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Person updated" });
  } catch (error) {
    console.error("Error updating person:", error);
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stmt = db.prepare("DELETE FROM people WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Person deleted" });
  } catch (error) {
    console.error("Error deleting person:", error);
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  }
}
