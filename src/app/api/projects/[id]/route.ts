import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { task_number, task_description, group_label, budget, status, project_lead } = body;

    // Look up existing project
    const existing = db
      .prepare("SELECT task_number FROM projects WHERE id = ?")
      .get(id) as { task_number: string } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const oldTaskNumber = existing.task_number;
    const newTaskNumber = task_number || oldTaskNumber;

    // Use a transaction for cascade updates
    const updateTransaction = db.transaction(() => {
      // If task_number changed, cascade to timesheets and planned_work
      if (newTaskNumber !== oldTaskNumber) {
        db.prepare(
          "UPDATE timesheets SET task_number = ?, updated_at = datetime('now') WHERE task_number = ?"
        ).run(newTaskNumber, oldTaskNumber);
        db.prepare(
          "UPDATE planned_work SET task_number = ?, updated_at = datetime('now') WHERE task_number = ?"
        ).run(newTaskNumber, oldTaskNumber);
      }

      // Update the project record
      db.prepare(
        `UPDATE projects SET
          task_number = ?,
          task_description = ?,
          group_label = ?,
          budget = ?,
          status = ?,
          project_lead = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      ).run(
        newTaskNumber,
        task_description ?? null,
        group_label || null,
        budget != null && budget !== "" ? Number(budget) : null,
        status || "Started",
        project_lead || null,
        id
      );
    });

    updateTransaction();

    return NextResponse.json({ message: "Project updated" });
  } catch (error: unknown) {
    console.error("Error updating project:", error);
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return NextResponse.json(
        { error: "A project with that code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update project" },
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

    const project = db
      .prepare("SELECT task_number FROM projects WHERE id = ?")
      .get(id) as { task_number: string } | undefined;

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const deleteTransaction = db.transaction(() => {
      // Delete associated timesheets
      db.prepare("DELETE FROM timesheets WHERE task_number = ?").run(
        project.task_number
      );
      // Delete associated planned work
      db.prepare("DELETE FROM planned_work WHERE task_number = ?").run(
        project.task_number
      );
      // Delete the project
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    });

    deleteTransaction();

    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
