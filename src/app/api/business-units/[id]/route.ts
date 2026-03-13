import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("business-units", "update");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
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

    // Look up existing business unit
    const existing = await queryOne<{ short_name: string }>(
      "SELECT short_name FROM business_units WHERE id = $1",
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Business unit not found" },
        { status: 404 }
      );
    }

    const oldShortName = existing.short_name;
    const newShortName = short_name?.trim() || oldShortName;

    // Use a transaction for cascade updates
    await withTransaction(async (client) => {
      // If short_name changed, cascade to people
      if (newShortName !== oldShortName) {
        await client.query(
          "UPDATE people SET business_unit = $1, updated_at = NOW() WHERE business_unit = $2",
          [newShortName, oldShortName]
        );
      }

      // Update the business unit record
      await client.query(
        `UPDATE business_units SET
          short_name = $1,
          registered_name = $2,
          signatory_for_icm = $3,
          manager_1 = $4,
          manager_2 = $5,
          registered_street_address = $6,
          registered_city = $7,
          registered_zipcode = $8,
          registered_country = $9,
          icm_signatory_name = $10,
          icm_signatory_title = $11,
          icm_contractual_address = $12,
          icm_signatory_phone = $13,
          icm_signatory_email = $14,
          icm_billing_name = $15,
          icm_billing_title = $16,
          icm_billing_address = $17,
          icm_billing_phone = $18,
          icm_billing_email = $19,
          updated_at = NOW()
        WHERE id = $20`,
        [
          newShortName,
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
          id,
        ]
      );
    });

    await logAudit(
      "UPDATE",
      "business_unit",
      id,
      `Updated business unit: ${newShortName}`
    );
    return NextResponse.json({ message: "Business unit updated" });
  } catch (error: unknown) {
    console.error("Error updating business unit:", error);
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: "A business unit with that short name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update business unit" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("business-units", "delete");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;

    const unit = await queryOne<{ short_name: string }>(
      "SELECT short_name FROM business_units WHERE id = $1",
      [id]
    );

    if (!unit) {
      return NextResponse.json(
        { error: "Business unit not found" },
        { status: 404 }
      );
    }

    await withTransaction(async (client) => {
      // Clear business_unit for associated people
      await client.query(
        "UPDATE people SET business_unit = NULL, updated_at = NOW() WHERE business_unit = $1",
        [unit.short_name]
      );
      // Delete the business unit
      await client.query(
        "DELETE FROM business_units WHERE id = $1",
        [id]
      );
    });

    await logAudit(
      "DELETE",
      "business_unit",
      id,
      `Deleted business unit: ${unit.short_name}`
    );
    return NextResponse.json({ message: "Business unit deleted" });
  } catch (error) {
    console.error("Error deleting business unit:", error);
    return NextResponse.json(
      { error: "Failed to delete business unit" },
      { status: 500 }
    );
  }
}
