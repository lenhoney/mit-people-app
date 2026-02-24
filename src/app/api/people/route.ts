import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    // Join with people_rates to get current rate (latest FY)
    const people = db.prepare(`
      SELECT p.*,
        (SELECT pr.rate FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as rate,
        (SELECT pr.fy_label FROM people_rates pr WHERE pr.person_id = p.id ORDER BY pr.fy_end DESC LIMIT 1) as fy_label
      FROM people p
      ORDER BY p.person ASC
    `).all();
    return NextResponse.json(people);
  } catch (error) {
    console.error("Error fetching people:", error);
    return NextResponse.json({ error: "Failed to fetch people" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const stmt = db.prepare(`
      INSERT INTO people (person, sow, role, kerb, managed_services, architecture, app_support, computing, phone, work_anniversary, birthday, manager_name, business_unit, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      person, sow || null, role || null,
      kerb || null, managed_services ? 1 : 0, architecture ? 1 : 0,
      app_support ? 1 : 0, computing ? 1 : 0, phone || null,
      work_anniversary || null, birthday || null, manager_name || null,
      business_unit || null, country || "South Africa"
    );

    return NextResponse.json({ id: result.lastInsertRowid, message: "Person created" }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating person:", error);
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "A person with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
  }
}
