import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Prevent directory traversal
    const sanitized = path.basename(filename);
    const filepath = path.join(PHOTOS_DIR, sanitized);

    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const ext = path.extname(sanitized).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const buffer = fs.readFileSync(filepath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error serving photo:", error);
    return NextResponse.json({ error: "Failed to serve photo" }, { status: 500 });
  }
}
