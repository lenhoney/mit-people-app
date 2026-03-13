import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name query parameter is required" }, { status: 400 });
    }

    const person = await queryOne(`
      SELECT p.*,
        (SELECT pr.rate FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as rate,
        (SELECT pr.fy_label FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as fy_label
      FROM people p
      WHERE p.person = $1
    `, [name]);

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    await logAudit("READ", "person", (person as { id: number }).id, `Read person via external API: ${name}`);
    return NextResponse.json(person);
  } catch (error) {
    console.error("Error fetching person by name:", error);
    return NextResponse.json({ error: "Failed to fetch person" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name query parameter is required" }, { status: 400 });
    }

    const existing = await queryOne<{ id: number }>("SELECT id FROM people WHERE person = $1", [name]);
    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      person, sow, role, kerb,
      managed_services, architecture, app_support, computing,
      phone, work_anniversary, birthday, manager_name, business_unit,
      status, country,
    } = body;

    await execute(
      `UPDATE people SET
        person = $1, sow = $2, role = $3, kerb = $4,
        managed_services = $5, architecture = $6, app_support = $7, computing = $8,
        phone = $9, work_anniversary = $10, birthday = $11, manager_name = $12, business_unit = $13,
        status = $14, country = $15,
        updated_at = NOW()
      WHERE id = $16`,
      [
        person ?? name, sow ?? null, role ?? null,
        kerb ?? null, managed_services ? 1 : 0, architecture ? 1 : 0,
        app_support ? 1 : 0, computing ? 1 : 0, phone ?? null,
        work_anniversary ?? null, birthday ?? null, manager_name ?? null,
        business_unit ?? null, status ?? "Active", country ?? "South Africa",
        existing.id
      ]
    );

    await logAudit("UPDATE", "person", existing.id, `Updated person via external API: ${name}`);
    return NextResponse.json({ message: "Person updated" });
  } catch (error) {
    console.error("Error updating person by name:", error);
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
  }
}
