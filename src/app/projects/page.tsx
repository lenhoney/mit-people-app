"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ProjectsTable } from "@/components/projects/projects-table";
import {
  ProjectDialog,
  ProjectData,
} from "@/components/projects/project-dialog";
import { FolderPlus } from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [peopleNames, setPeopleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(
    null
  );

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeopleNames = useCallback(async () => {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      const names = data
        .filter((p: { status?: string }) => (p.status || "Active") === "Active")
        .map((p: { person: string }) => p.person)
        .sort();
      setPeopleNames(names);
    } catch (err) {
      console.error("Failed to load people names:", err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadPeopleNames();
  }, [loadProjects, loadPeopleNames]);

  const handleEdit = (project: ProjectData) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProject(null);
    setDialogOpen(true);
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const project = projects.find((p) => p.id === id);
      if (!project) return;

      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_number: project.task_number,
          task_description: project.task_description,
          group_label: project.group_label,
          budget: project.budget,
          status: newStatus,
          project_lead: project.project_lead,
        }),
      });
      if (res.ok) {
        loadProjects();
      }
    } catch (err) {
      console.error("Failed to update project status:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this project? This will also delete all timesheets and planned work entries for this project."
      )
    )
      return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadProjects();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  // Derive existing group labels for the dialog typeahead
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const p of projects) {
      if (p.group_label) groups.add(p.group_label);
    }
    return Array.from(groups).sort();
  }, [projects]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage project codes, names, budgets, and grouping labels
          </p>
        </div>
        <Button onClick={handleAdd}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      <ProjectsTable
        projects={projects}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
        existingGroups={existingGroups}
        peopleNames={peopleNames}
        onSave={loadProjects}
      />
    </div>
  );
}
