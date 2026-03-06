import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const existing = db
      .prepare("SELECT short_name FROM business_units WHERE id = ?")
      .get(id) as { short_name: string } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Business unit not found" },
        { status: 404 }
      );
    }

    const oldShortName = existing.short_name;
    const newShortName = short_name?.trim() || oldShortName;

    // Use a transaction for cascade updates
    const updateTransaction = db.transaction(() => {
      // If short_name changed, cascade to people
      if (newShortName !== oldShortName) {
        db.prepare(
          "UPDATE people SET business_unit = ?, updated_at = datetime('now') WHERE business_unit = ?"
        ).run(newShortName, oldShortName);
      }

      // Update the business unit record
      db.prepare(
        `UPDATE business_units SET
          short_name = ?,
          registered_name = ?,
          signatory_for_icm = ?,
          manager_1 = ?,
          manager_2 = ?,
          registered_street_address = ?,
          registered_city = ?,
          registered_zipcode = ?,
          registered_country = ?,
          icm_signatory_name = ?,
          icm_signatory_title = ?,
          icm_contractual_address = ?,
          icm_signatory_phone = ?,
          icm_signatory_email = ?,
          icm_billing_name = ?,
          icm_billing_title = ?,
          icm_billing_address = ?,
          icm_billing_phone = ?,
          icm_billing_email = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      ).run(
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
        id
      );
    });

    updateTransaction();

    await logAudit(
      "UPDATE",
      "business_unit",
      id,
      `Updated business unit: ${newShortName}`
    );
    return NextResponse.json({ message: "Business unit updated" });
  } catch (error: unknown) {
    console.error("Error updating business unit:", error);
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
      { error: "Failed to update business unit" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const unit = db
      .prepare("SELECT short_name FROM business_units WHERE id = ?")
      .get(id) as { short_name: string } | undefined;

    if (!unit) {
      return NextResponse.json(
        { error: "Business unit not found" },
        { status: 404 }
      );
    }

    const deleteTransaction = db.transaction(() => {
      // Clear business_unit for associated people
      db.prepare(
        "UPDATE people SET business_unit = NULL, updated_at = datetime('now') WHERE business_unit = ?"
      ).run(unit.short_name);
      // Delete the business unit
      db.prepare("DELETE FROM business_units WHERE id = ?").run(id);
    });

    deleteTransaction();

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
