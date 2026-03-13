import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import fs from "fs";
import path from "path";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check person exists
    const person = await queryOne<{ id: number; person: string }>(
      "SELECT id, person FROM people WHERE id = $1", [id]
    );
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum 5MB." },
        { status: 400 }
      );
    }

    // Generate filename: person_id + extension
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `${id}.${ext}`;
    const filepath = path.join(PHOTOS_DIR, filename);

    // Remove any existing photo for this person
    const existingPhoto = await queryOne<{ photo: string | null }>(
      "SELECT photo FROM people WHERE id = $1", [id]
    );
    if (existingPhoto?.photo) {
      const oldPath = path.join(PHOTOS_DIR, existingPhoto.photo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Update database with filename
    await execute(
      "UPDATE people SET photo = $1, updated_at = NOW() WHERE id = $2",
      [filename, id]
    );

    await logAudit("UPDATE", "person_photo", id, `Uploaded photo for: ${person.person}`);
    return NextResponse.json({
      message: "Photo uploaded",
      photo: filename,
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const person = await queryOne<{ photo: string | null }>(
      "SELECT photo FROM people WHERE id = $1", [id]
    );
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    if (person.photo) {
      const filepath = path.join(PHOTOS_DIR, person.photo);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    await execute(
      "UPDATE people SET photo = NULL, updated_at = NOW() WHERE id = $1",
      [id]
    );

    await logAudit("DELETE", "person_photo", id, `Removed photo for person ID: ${id}`);
    return NextResponse.json({ message: "Photo removed" });
  } catch (error) {
    console.error("Error removing photo:", error);
    return NextResponse.json({ error: "Failed to remove photo" }, { status: 500 });
  }
}
