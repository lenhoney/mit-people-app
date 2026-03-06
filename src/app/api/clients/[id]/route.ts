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
    const { name, short_name, contact_person, contact_email, business_unit_ids } = body;

    const existing = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(id) as { id: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const updateTransaction = db.transaction(() => {
      db.prepare(
        `UPDATE clients SET
          name = ?,
          short_name = ?,
          contact_person = ?,
          contact_email = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      ).run(
        name || null,
        short_name?.trim() || null,
        contact_person || null,
        contact_email || null,
        id
      );

      // Replace business unit associations
      if (business_unit_ids && Array.isArray(business_unit_ids)) {
        db.prepare("DELETE FROM business_unit_clients WHERE client_id = ?").run(id);
        const insertBuc = db.prepare(
          `INSERT OR IGNORE INTO business_unit_clients (business_unit_id, client_id) VALUES (?, ?)`
        );
        for (const buId of business_unit_ids) {
          insertBuc.run(buId, id);
        }
      }
    });

    updateTransaction();

    await logAudit(
      "UPDATE",
      "client",
      id,
      `Updated client: ${short_name}`
    );
    return NextResponse.json({ message: "Client updated" });
  } catch (error: unknown) {
    console.error("Error updating client:", error);
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return NextResponse.json(
        { error: "A client with that short name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update client" },
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

    const client = db
      .prepare("SELECT short_name FROM clients WHERE id = ?")
      .get(id) as { short_name: string } | undefined;

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const deleteTransaction = db.transaction(() => {
      // Clear client_id from associated projects
      db.prepare(
        "UPDATE projects SET client_id = NULL, updated_at = datetime('now') WHERE client_id = ?"
      ).run(id);
      // Remove business unit associations
      db.prepare("DELETE FROM business_unit_clients WHERE client_id = ?").run(id);
      // Delete the client
      db.prepare("DELETE FROM clients WHERE id = ?").run(id);
    });

    deleteTransaction();

    await logAudit(
      "DELETE",
      "client",
      id,
      `Deleted client: ${client.short_name}`
    );
    return NextResponse.json({ message: "Client deleted" });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
