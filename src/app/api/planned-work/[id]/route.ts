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
    const { planned_start, planned_end, task_description, allocation_pct } = body;

    if (planned_start && planned_end && planned_end < planned_start) {
      return NextResponse.json(
        { error: "planned_end must be on or after planned_start" },
        { status: 400 }
      );
    }

    const pct = allocation_pct != null
      ? Math.max(1, Math.min(100, Math.round(allocation_pct)))
      : null;

    const stmt = db.prepare(`
      UPDATE planned_work SET
        planned_start = COALESCE(?, planned_start),
        planned_end = COALESCE(?, planned_end),
        task_description = COALESCE(?, task_description),
        allocation_pct = COALESCE(?, allocation_pct),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      planned_start || null,
      planned_end || null,
      task_description || null,
      pct,
      id
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Planned work not found" },
        { status: 404 }
      );
    }

    await logAudit("UPDATE", "planned_work", id, `Updated planned work ID: ${id}`);
    return NextResponse.json({ message: "Planned work updated" });
  } catch (error) {
    console.error("Error updating planned work:", error);
    return NextResponse.json(
      { error: "Failed to update planned work" },
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
    const result = db.prepare("DELETE FROM planned_work WHERE id = ?").run(id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Planned work not found" },
        { status: 404 }
      );
    }

    await logAudit("DELETE", "planned_work", id, `Deleted planned work ID: ${id}`);
    return NextResponse.json({ message: "Planned work deleted" });
  } catch (error) {
    console.error("Error deleting planned work:", error);
    return NextResponse.json(
      { error: "Failed to delete planned work" },
      { status: 500 }
    );
  }
}
