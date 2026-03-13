import { NextResponse } from "next/server";
import { getSession, getUserPermissions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const permissions = await getUserPermissions(session.id);
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Permissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
