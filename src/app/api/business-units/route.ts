import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const units = db
      .prepare(`SELECT * FROM business_units ORDER BY short_name ASC`)
      .all();

    return NextResponse.json(units);
  } catch (error) {
    console.error("Error fetching business units:", error);
    return NextResponse.json(
      { error: "Failed to fetch business units" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      short_name,
      registered_name,
      signatory_for_icm,
      manager_1,
      manager_2,
      registered_street_address,
      registered_city,
      registered_zipcode,
      registered_country,
      icm_signatory_name,
      icm_signatory_title,
      icm_contractual_address,
      icm_signatory_phone,
      icm_signatory_email,
      icm_billing_name,
      icm_billing_title,
      icm_billing_address,
      icm_billing_phone,
      icm_billing_email,
    } = body;

    if (!short_name?.trim()) {
      return NextResponse.json(
        { error: "Short name is required" },
        { status: 400 }
      );
    }

    const stmt = db.prepare(`
      INSERT INTO business_units (
        short_name, registered_name, signatory_for_icm, manager_1, manager_2,
        registered_street_address, registered_city, registered_zipcode, registered_country,
        icm_signatory_name, icm_signatory_title, icm_contractual_address,
        icm_signatory_phone, icm_signatory_email,
        icm_billing_name, icm_billing_title, icm_billing_address,
        icm_billing_phone, icm_billing_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      short_name.trim(),
      registered_name || null,
      signatory_for_icm || null,
      manager_1 || null,
      manager_2 || null,
      registered_street_address || null,
      registered_city || null,
      registered_zipcode || null,
      registered_country || null,
      icm_signatory_name || null,
      icm_signatory_title || null,
      icm_contractual_address || null,
      icm_signatory_phone || null,
      icm_signatory_email || null,
      icm_billing_name || null,
      icm_billing_title || null,
      icm_billing_address || null,
      icm_billing_phone || null,
      icm_billing_email || null
    );

    await logAudit(
      "CREATE",
      "business_unit",
      result.lastInsertRowid,
      `Created business unit: ${short_name}`
    );
    return NextResponse.json(
      { id: result.lastInsertRowid, message: "Business unit created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating business unit:", error);
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return NextResponse.json(
        { error: "A business unit with that short name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create business unit" },
      { status: 500 }
    );
  }
}
