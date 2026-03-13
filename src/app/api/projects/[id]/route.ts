import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { task_number, task_description, group_label, budget, status, project_lead, client_id } = body;

    // Look up existing project
    const existing = await queryOne<{ task_number: string }>(
      "SELECT task_number FROM projects WHERE id = $1",
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const oldTaskNumber = existing.task_number;
    const newTaskNumber = task_number || oldTaskNumber;

    // Use a transaction for cascade updates
    await withTransaction(async (client) => {
      // If task_number changed, cascade to timesheets and planned_work
      if (newTaskNumber !== oldTaskNumber) {
        await client.query(
          "UPDATE timesheets SET task_number = $1, updated_at = NOW() WHERE task_number = $2",
          [newTaskNumber, oldTaskNumber]
        );
        await client.query(
          "UPDATE planned_work SET task_number = $1, updated_at = NOW() WHERE task_number = $2",
          [newTaskNumber, oldTaskNumber]
        );
      }

      // Update the project record
      await client.query(
        `UPDATE projects SET
          task_number = $1,
          task_description = $2,
          group_label = $3,
          budget = $4,
          status = $5,
          project_lead = $6,
          client_id = $7,
          updated_at = NOW()
        WHERE id = $8`,
        [
          newTaskNumber,
          task_description ?? null,
          group_label || null,
          budget != null && budget !== "" ? Number(budget) : null,
          status || "Started",
          project_lead || null,
          client_id ?? null,
          id,
        ]
      );
    });

    await logAudit("UPDATE", "project", id, `Updated project: ${newTaskNumber}`);
    return NextResponse.json({ message: "Project updated" });
  } catch (error: unknown) {
    console.error("Error updating project:", error);
    if ((error as any).code === '23505') {
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

    const project = await queryOne<{ task_number: string }>(
      "SELECT task_number FROM projects WHERE id = $1",
      [id]
    );

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    await withTransaction(async (client) => {
      // Delete associated timesheets
      await client.query(
        "DELETE FROM timesheets WHERE task_number = $1",
        [project.task_number]
      );
      // Delete associated planned work
      await client.query(
        "DELETE FROM planned_work WHERE task_number = $1",
        [project.task_number]
      );
      // Delete the project
      await client.query(
        "DELETE FROM projects WHERE id = $1",
        [id]
      );
    });

    await logAudit("DELETE", "project", id, `Deleted project: ${project.task_number}`);
    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
