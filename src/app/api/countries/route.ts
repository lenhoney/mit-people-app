import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

export async function GET() {
  try {
    const countries = await query("SELECT * FROM countries ORDER BY name ASC");
    return NextResponse.json(countries);
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json({ error: "Failed to fetch countries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Country name and code are required" }, { status: 400 });
    }

    const result = await execute(
      "INSERT INTO countries (name, code) VALUES ($1, $2) RETURNING id",
      [name, code.toUpperCase()]
    );

    return NextResponse.json({ id: result.rows[0].id, message: "Country added" }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error adding country:", error);
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: "Country already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add country" }, { status: 500 });
  }
}
