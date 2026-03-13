import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  const auth = await requirePermission("people", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Join with people_rates to get current rate (latest FY)
    const people = await query(`
      SELECT p.*,
        (SELECT pr.rate FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as rate,
        (SELECT pr.fy_label FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as fy_label
      FROM people p
      ORDER BY p.person ASC
    `);
    return NextResponse.json(people);
  } catch (error) {
    console.error("Error fetching people:", error);
    return NextResponse.json({ error: "Failed to fetch people" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("people", "create");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      person, sow, role, kerb,
      managed_services, architecture, app_support, computing,
      phone, work_anniversary, birthday, manager_name, business_unit,
      country,
    } = body;

    if (!person) {
      return NextResponse.json({ error: "Person name is required" }, { status: 400 });
    }

    const result = await execute(
      `INSERT INTO people (person, sow, role, kerb, managed_services, architecture, app_support, computing, phone, work_anniversary, birthday, manager_name, business_unit, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        person, sow || null, role || null,
        kerb || null, managed_services ? 1 : 0, architecture ? 1 : 0,
        app_support ? 1 : 0, computing ? 1 : 0, phone || null,
        work_anniversary || null, birthday || null, manager_name || null,
        business_unit || null, country || "South Africa"
      ]
    );

    await logAudit("CREATE", "person", Number(result.rows[0].id), `Created person: ${person}`);
    return NextResponse.json({ id: result.rows[0].id, message: "Person created" }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating person:", error);
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: "A person with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
  }
}
