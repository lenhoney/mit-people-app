import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { logAudit } from "@/lib/audit";

interface ClientRow {
  id: number;
  name: string;
  short_name: string;
  contact_person: string;
  contact_email: string;
  logo: string | null;
  business_units: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const clients = db
      .prepare(
        `SELECT c.*, GROUP_CONCAT(bu.short_name) as business_units
         FROM clients c
         LEFT JOIN business_unit_clients buc ON buc.client_id = c.id
         LEFT JOIN business_units bu ON bu.id = buc.business_unit_id
         GROUP BY c.id
         ORDER BY c.name ASC`
      )
      .all() as ClientRow[];

    const result = clients.map((c) => ({
      ...c,
      business_units: c.business_units ? c.business_units.split(",") : [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, short_name, contact_person, contact_email, business_unit_ids } = body;

    if (!short_name?.trim()) {
      return NextResponse.json(
        { error: "Short name is required" },
        { status: 400 }
      );
    }
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const createTransaction = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO clients (name, short_name, contact_person, contact_email)
           VALUES (?, ?, ?, ?)`
        )
        .run(
          name.trim(),
          short_name.trim(),
          contact_person || null,
          contact_email || null
        );

      const clientId = result.lastInsertRowid;

      // Insert business unit associations
      if (business_unit_ids && Array.isArray(business_unit_ids)) {
        const insertBuc = db.prepare(
          `INSERT OR IGNORE INTO business_unit_clients (business_unit_id, client_id) VALUES (?, ?)`
        );
        for (const buId of business_unit_ids) {
          insertBuc.run(buId, clientId);
        }
      }

      return clientId;
    });

    const clientId = createTransaction();

    await logAudit(
      "CREATE",
      "client",
      clientId,
      `Created client: ${short_name}`
    );
    return NextResponse.json(
      { id: clientId, message: "Client created" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating client:", error);
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
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
