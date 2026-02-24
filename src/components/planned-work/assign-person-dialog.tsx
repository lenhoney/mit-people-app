"use client";

import { useState, useEffect, useMemo } from "react";
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

interface PersonOption {
  id: number;
  person: string;
  status: string;
}

interface ProjectOption {
  task_number: string;
  task_description: string;
}

interface AssignPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function AssignPersonDialog({
  open,
  onOpenChange,
  onSave,
}: AssignPersonDialogProps) {
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Form fields
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedTaskNumber, setSelectedTaskNumber] = useState("");
  const [manualProject, setManualProject] = useState(false);
  const [manualTaskNumber, setManualTaskNumber] = useState("");
  const [manualTaskDescription, setManualTaskDescription] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [allocationPct, setAllocationPct] = useState(100);

  // Search filters for dropdowns
  const [personSearch, setPersonSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch people and projects when dialog opens
  useEffect(() => {
    if (!open) return;

    // Reset form
    setSelectedPersonId(null);
    setSelectedTaskNumber("");
    setManualProject(false);
    setManualTaskNumber("");
    setManualTaskDescription("");
    setPlannedStart("");
    setPlannedEnd("");
    setAllocationPct(100);
    setPersonSearch("");
    setProjectSearch("");
    setError("");

    // Default planned_start to today
    const today = new Date().toISOString().split("T")[0];
    setPlannedStart(today);

    setLoadingPeople(true);
    setLoadingProjects(true);

    fetch("/api/people")
      .then((res) => res.json())
      .then((data) => {
        // Only show active people
        setPeople(
          (data as PersonOption[]).filter(
            (p) => (p.status || "Active") === "Active"
          )
        );
      })
      .catch(console.error)
      .finally(() => setLoadingPeople(false));

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data as ProjectOption[]))
      .catch(console.error)
      .finally(() => setLoadingProjects(false));
  }, [open]);

  // Filtered lists
  const filteredPeople = useMemo(() => {
    if (!personSearch) return people;
    const lower = personSearch.toLowerCase();
    return people.filter((p) => p.person.toLowerCase().includes(lower));
  }, [people, personSearch]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    const lower = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.task_number.toLowerCase().includes(lower) ||
        (p.task_description || "").toLowerCase().includes(lower)
    );
  }, [projects, projectSearch]);

  // Selected person/project display names
  const selectedPersonName = people.find(
    (p) => p.id === selectedPersonId
  )?.person;
  const selectedProject = projects.find(
    (p) => p.task_number === selectedTaskNumber
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedPersonId) {
      setError("Please select a person");
      return;
    }

    const taskNumber = manualProject ? manualTaskNumber : selectedTaskNumber;
    const taskDescription = manualProject
      ? manualTaskDescription
      : selectedProject?.task_description || "";

    if (!taskNumber) {
      setError("Please select or enter a project");
      return;
    }
    if (!plannedStart || !plannedEnd) {
      setError("Please set both start and end dates");
      return;
    }
    if (plannedEnd < plannedStart) {
      setError("End date must be on or after start date");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/planned-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: selectedPersonId,
          task_number: taskNumber,
          task_description: taskDescription,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          allocation_pct: allocationPct,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign");
      }

      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign person");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Person to Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Person selector */}
            <div className="space-y-2">
              <Label>Person *</Label>
              {selectedPersonId ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 px-3 rounded-md border bg-muted/50 text-sm flex items-center">
                    {selectedPersonName}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPersonId(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder={
                      loadingPeople
                        ? "Loading people..."
                        : "Search for a person..."
                    }
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                  {personSearch && (
                    <div className="border rounded-md max-h-[160px] overflow-y-auto">
                      {filteredPeople.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matching people
                        </div>
                      ) : (
                        filteredPeople.slice(0, 20).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => {
                              setSelectedPersonId(p.id);
                              setPersonSearch("");
                            }}
                          >
                            {p.person}
                          </button>
                        ))
                      )}
                      {filteredPeople.length > 20 && (
                        <div className="px-3 py-1 text-xs text-muted-foreground border-t">
                          Showing 20 of {filteredPeople.length} — type more to
                          narrow
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Project selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Project *</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setManualProject(!manualProject);
                    setSelectedTaskNumber("");
                    setManualTaskNumber("");
                    setManualTaskDescription("");
                    setProjectSearch("");
                  }}
                >
                  {manualProject
                    ? "Select existing project"
                    : "Enter manually"}
                </button>
              </div>

              {manualProject ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Input
                      placeholder="Project code (e.g. PRJ-001)"
                      value={manualTaskNumber}
                      onChange={(e) => setManualTaskNumber(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Project name"
                      value={manualTaskDescription}
                      onChange={(e) =>
                        setManualTaskDescription(e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              ) : selectedTaskNumber ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 px-3 rounded-md border bg-muted/50 text-sm flex items-center min-w-0">
                    <span className="font-mono text-xs mr-2 flex-shrink-0">
                      {selectedTaskNumber}
                    </span>
                    <span className="truncate">
                      {selectedProject?.task_description || ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTaskNumber("")}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder={
                      loadingProjects
                        ? "Loading projects..."
                        : "Search for a project..."
                    }
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-9"
                  />
                  {projectSearch && (
                    <div className="border rounded-md max-h-[160px] overflow-y-auto">
                      {filteredProjects.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matching projects
                        </div>
                      ) : (
                        filteredProjects.slice(0, 20).map((p) => (
                          <button
                            key={p.task_number}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => {
                              setSelectedTaskNumber(p.task_number);
                              setProjectSearch("");
                            }}
                          >
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {p.task_number}
                            </span>
                            {p.task_description}
                          </button>
                        ))
                      )}
                      {filteredProjects.length > 20 && (
                        <div className="px-3 py-1 text-xs text-muted-foreground border-t">
                          Showing 20 of {filteredProjects.length} — type more to
                          narrow
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planned_start">Planned Start *</Label>
                <Input
                  id="planned_start"
                  type="date"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_end">Planned End *</Label>
                <Input
                  id="planned_end"
                  type="date"
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Allocation */}
            <div className="space-y-2">
              <Label htmlFor="allocation_pct">Allocation %</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="allocation_pct"
                  type="number"
                  min={1}
                  max={100}
                  value={allocationPct}
                  onChange={(e) =>
                    setAllocationPct(
                      Math.max(1, Math.min(100, Number(e.target.value) || 1))
                    )
                  }
                  className="w-[100px]"
                />
                <span className="text-sm text-muted-foreground">
                  of full-time capacity
                </span>
              </div>
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
              {saving ? "Assigning..." : "Assign to Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
