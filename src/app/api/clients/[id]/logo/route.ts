import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { logAudit } from "@/lib/audit";
import fs from "fs";
import path from "path";

const LOGOS_DIR = path.join(process.cwd(), "data", "logos");

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = db
      .prepare("SELECT id, short_name FROM clients WHERE id = ?")
      .get(id) as { id: number; short_name: string } | undefined;
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No logo provided" }, { status: 400 });
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum 5MB." },
        { status: 400 }
      );
    }

    const ext =
      file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `client-${id}.${ext}`;
    const filepath = path.join(LOGOS_DIR, filename);

    // Remove any existing logo for this client
    const existingLogo = db
      .prepare("SELECT logo FROM clients WHERE id = ?")
      .get(id) as { logo: string | null } | undefined;
    if (existingLogo?.logo) {
      const oldPath = path.join(LOGOS_DIR, existingLogo.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Update database
    db.prepare(
      "UPDATE clients SET logo = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(filename, id);

    await logAudit(
      "UPDATE",
      "client_logo",
      id,
      `Uploaded logo for: ${client.short_name}`
    );
    return NextResponse.json({ message: "Logo uploaded", logo: filename });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
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
      .prepare("SELECT logo FROM clients WHERE id = ?")
      .get(id) as { logo: string | null } | undefined;
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.logo) {
      const filepath = path.join(LOGOS_DIR, client.logo);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    db.prepare(
      "UPDATE clients SET logo = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(id);

    await logAudit(
      "DELETE",
      "client_logo",
      id,
      `Removed logo for client ID: ${id}`
    );
    return NextResponse.json({ message: "Logo removed" });
  } catch (error) {
    console.error("Error removing logo:", error);
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500 }
    );
  }
}
