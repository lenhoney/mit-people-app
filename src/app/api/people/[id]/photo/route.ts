import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
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
    const person = db.prepare("SELECT id, person FROM people WHERE id = ?").get(id) as { id: number; person: string } | undefined;
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
    const existingPhoto = db.prepare("SELECT photo FROM people WHERE id = ?").get(id) as { photo: string | null } | undefined;
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
    db.prepare("UPDATE people SET photo = ?, updated_at = datetime('now') WHERE id = ?").run(filename, id);

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

    const person = db.prepare("SELECT photo FROM people WHERE id = ?").get(id) as { photo: string | null } | undefined;
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    if (person.photo) {
      const filepath = path.join(PHOTOS_DIR, person.photo);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    db.prepare("UPDATE people SET photo = NULL, updated_at = datetime('now') WHERE id = ?").run(id);

    return NextResponse.json({ message: "Photo removed" });
  } catch (error) {
    console.error("Error removing photo:", error);
    return NextResponse.json({ error: "Failed to remove photo" }, { status: 500 });
  }
}
