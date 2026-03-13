import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    const result = await execute(
      `UPDATE people SET
        person = $1, sow = $2, role = $3, kerb = $4,
        managed_services = $5, architecture = $6, app_support = $7, computing = $8,
        phone = $9, work_anniversary = $10, birthday = $11, manager_name = $12, business_unit = $13,
        status = $14, country = $15,
        updated_at = NOW()
      WHERE id = $16`,
      [
        person, sow || null, role || null,
        kerb || null, managed_services ? 1 : 0, architecture ? 1 : 0,
        app_support ? 1 : 0, computing ? 1 : 0, phone || null,
        work_anniversary || null, birthday || null, manager_name || null,
        business_unit || null, status || "Active", country || "South Africa", id
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    await logAudit("UPDATE", "person", id, `Updated person: ${person}`);
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
    const result = await execute("DELETE FROM people WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    await logAudit("DELETE", "person", id, `Deleted person ID: ${id}`);
    return NextResponse.json({ message: "Person deleted" });
  } catch (error) {
    console.error("Error deleting person:", error);
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  }
}
