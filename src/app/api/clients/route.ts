import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

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
  const auth = await requirePermission("clients", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const clients = await query<ClientRow>(
      `SELECT c.*, STRING_AGG(bu.short_name::text, ',') as business_units
       FROM clients c
       LEFT JOIN business_unit_clients buc ON buc.client_id = c.id
       LEFT JOIN business_units bu ON bu.id = buc.business_unit_id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );

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
  const auth = await requirePermission("clients", "create");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

    const clientId = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO clients (name, short_name, contact_person, contact_email)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          name.trim(),
          short_name.trim(),
          contact_person || null,
          contact_email || null,
        ]
      );

      const newId = result.rows[0].id;

      // Insert business unit associations
      if (business_unit_ids && Array.isArray(business_unit_ids)) {
        for (const buId of business_unit_ids) {
          await client.query(
            `INSERT INTO business_unit_clients (business_unit_id, client_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [buId, newId]
          );
        }
      }

      return newId;
    });

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
    if ((error as any).code === '23505') {
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
