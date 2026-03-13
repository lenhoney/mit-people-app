import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  const auth = await requirePermission("business-units", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await query(
      `SELECT * FROM business_units ORDER BY short_name ASC`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching business units:", error);
    return NextResponse.json(
      { error: "Failed to fetch business units" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("business-units", "create");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

    const result = await execute(
      `INSERT INTO business_units (
        short_name, registered_name, signatory_for_icm, manager_1, manager_2,
        registered_street_address, registered_city, registered_zipcode, registered_country,
        icm_signatory_name, icm_signatory_title, icm_contractual_address,
        icm_signatory_phone, icm_signatory_email,
        icm_billing_name, icm_billing_title, icm_billing_address,
        icm_billing_phone, icm_billing_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
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
        icm_billing_email || null,
      ]
    );

    const newId = result.rows[0].id as number;
    await logAudit(
      "CREATE",
      "business_unit",
      newId,
      `Created business unit: ${short_name}`
    );
    return NextResponse.json(
      { id: newId, message: "Business unit created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating business unit:", error);
    if ((error as any).code === '23505') {
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
