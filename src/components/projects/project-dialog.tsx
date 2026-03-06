"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClient } from "@/components/layout/client-provider";

export interface ProjectData {
  id?: number;
  task_number: string;
  task_description: string;
  group_label: string | null;
  budget: number | null;
  status?: string;
  project_lead: string | null;
  client_id: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectData | null;
  existingGroups: string[];
  peopleNames: string[];
  onSave: () => void;
}

const emptyProject: ProjectData = {
  task_number: "",
  task_description: "",
  group_label: null,
  budget: null,
  project_lead: null,
  client_id: null,
};

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  existingGroups,
  peopleNames,
  onSave,
}: ProjectDialogProps) {
  const [formData, setFormData] = useState<ProjectData>(emptyProject);
  const [budgetStr, setBudgetStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [showLeadSuggestions, setShowLeadSuggestions] = useState(false);
  const [clients, setClients] = useState<{id: number; short_name: string; name: string}[]>([]);

  const { selectedClientId } = useClient();

  const isEditing = !!project?.id;

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch((err) => console.error("Failed to load clients:", err));
  }, []);

  useEffect(() => {
    if (open) {
      if (project) {
        setFormData(project);
        setBudgetStr(project.budget != null ? String(project.budget) : "");
      } else {
        setFormData({ ...emptyProject, client_id: selectedClientId });
        setBudgetStr("");
      }
      setError("");
    }
  }, [open, project, selectedClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.task_number.trim()) {
      setError("Project code is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        task_number: formData.task_number.trim(),
        task_description: formData.task_description?.trim() || null,
        group_label: formData.group_label?.trim() || null,
        budget: budgetStr ? Number(budgetStr) : null,
        status: formData.status || "Started",
        project_lead: formData.project_lead?.trim() || null,
        client_id: formData.client_id,
      };

      const url = isEditing
        ? `/api/projects/${project!.id}`
        : "/api/projects";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save project");
      }

      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  // Filter group suggestions based on current input
  const groupInput = formData.group_label || "";
  const filteredGroups = existingGroups.filter(
    (g) =>
      g.toLowerCase().includes(groupInput.toLowerCase()) &&
      g !== groupInput
  );

  // Filter person suggestions for Project Lead based on current input
  const leadInput = formData.project_lead || "";
  const filteredLeads = leadInput
    ? peopleNames.filter(
        (name) =>
          name.toLowerCase().includes(leadInput.toLowerCase()) &&
          name !== leadInput
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Project" : "Add Project"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="client_id">Client</Label>
              <Select
                value={formData.client_id != null ? String(formData.client_id) : ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, client_id: value ? Number(value) : null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.short_name} - {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_number">Project Code *</Label>
              <Input
                id="task_number"
                placeholder="e.g. PRJ0038561"
                value={formData.task_number}
                onChange={(e) =>
                  setFormData({ ...formData, task_number: e.target.value })
                }
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_description">Project Name</Label>
              <Input
                id="task_description"
                placeholder="e.g. MIT Operations"
                value={formData.task_description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    task_description: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="project_lead">Project Lead</Label>
              <Input
                id="project_lead"
                placeholder="Search for a person..."
                value={formData.project_lead || ""}
                onChange={(e) => {
                  setFormData({ ...formData, project_lead: e.target.value });
                  setShowLeadSuggestions(true);
                }}
                onFocus={() => setShowLeadSuggestions(true)}
                onBlur={() =>
                  setTimeout(() => setShowLeadSuggestions(false), 200)
                }
              />
              {showLeadSuggestions && filteredLeads.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 border rounded-md bg-popover shadow-md max-h-[160px] overflow-y-auto">
                  {filteredLeads.slice(0, 10).map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, project_lead: name });
                        setShowLeadSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The Project Manager responsible for this project.
              </p>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="group_label">Group Label</Label>
              <Input
                id="group_label"
                placeholder="e.g. Operations, Integrations"
                value={formData.group_label || ""}
                onChange={(e) => {
                  setFormData({ ...formData, group_label: e.target.value });
                  setShowGroupSuggestions(true);
                }}
                onFocus={() => setShowGroupSuggestions(true)}
                onBlur={() =>
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowGroupSuggestions(false), 200)
                }
              />
              {showGroupSuggestions && filteredGroups.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 border rounded-md bg-popover shadow-md max-h-[120px] overflow-y-auto">
                  {filteredGroups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, group_label: g });
                        setShowGroupSuggestions(false);
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Projects with the same group label are grouped on the Gantt
                chart. Leave blank for standalone projects.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 150000"
                  value={budgetStr}
                  onChange={(e) => setBudgetStr(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Optional. Used for tracking purposes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
