import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, short_name, contact_person, contact_email, business_unit_ids } = body;

    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM clients WHERE id = $1",
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE clients SET
          name = $1,
          short_name = $2,
          contact_person = $3,
          contact_email = $4,
          updated_at = NOW()
        WHERE id = $5`,
        [
          name || null,
          short_name?.trim() || null,
          contact_person || null,
          contact_email || null,
          id,
        ]
      );

      // Replace business unit associations
      if (business_unit_ids && Array.isArray(business_unit_ids)) {
        await client.query(
          "DELETE FROM business_unit_clients WHERE client_id = $1",
          [id]
        );
        for (const buId of business_unit_ids) {
          await client.query(
            `INSERT INTO business_unit_clients (business_unit_id, client_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [buId, id]
          );
        }
      }
    });

    await logAudit(
      "UPDATE",
      "client",
      id,
      `Updated client: ${short_name}`
    );
    return NextResponse.json({ message: "Client updated" });
  } catch (error: unknown) {
    console.error("Error updating client:", error);
    if ((error as any).code === '23505') {
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

    const client = await queryOne<{ short_name: string }>(
      "SELECT short_name FROM clients WHERE id = $1",
      [id]
    );

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    await withTransaction(async (txClient) => {
      // Clear client_id from associated projects
      await txClient.query(
        "UPDATE projects SET client_id = NULL, updated_at = NOW() WHERE client_id = $1",
        [id]
      );
      // Remove business unit associations
      await txClient.query(
        "DELETE FROM business_unit_clients WHERE client_id = $1",
        [id]
      );
      // Delete the client
      await txClient.query(
        "DELETE FROM clients WHERE id = $1",
        [id]
      );
    });

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
