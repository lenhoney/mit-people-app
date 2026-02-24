"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Check, X, Search, UserPlus } from "lucide-react";
import { AssignPersonDialog } from "./assign-person-dialog";

interface PlannedWorkEntry {
  id: number;
  person_id: number;
  person_name: string;
  task_number: string;
  task_description: string | null;
  planned_start: string;
  planned_end: string;
  allocation_pct: number;
  created_at: string;
  updated_at: string;
}

export function PlannedWorkTable() {
  const [entries, setEntries] = useState<PlannedWorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewBy, setViewBy] = useState<"project" | "person">("project");
  const [filter, setFilter] = useState("");

  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editAllocation, setEditAllocation] = useState<number>(100);

  const loadData = useCallback(async (view: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planned-work?viewBy=${view}`);
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error("Failed to load planned work:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(viewBy);
  }, [viewBy, loadData]);

  const handleStartEdit = (entry: PlannedWorkEntry) => {
    setEditingId(entry.id);
    setEditStart(entry.planned_start);
    setEditEnd(entry.planned_end);
    setEditAllocation(entry.allocation_pct ?? 100);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    setEditAllocation(100);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editStart || !editEnd || editEnd < editStart) return;

    try {
      await fetch(`/api/planned-work/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planned_start: editStart,
          planned_end: editEnd,
          allocation_pct: editAllocation,
        }),
      });
      setEditingId(null);
      loadData(viewBy);
    } catch (err) {
      console.error("Failed to update planned work:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this planned work entry?")) return;

    try {
      await fetch(`/api/planned-work/${id}`, { method: "DELETE" });
      loadData(viewBy);
    } catch (err) {
      console.error("Failed to delete planned work:", err);
    }
  };

  // Filter entries
  const lf = filter.toLowerCase();
  const filteredEntries = lf
    ? entries.filter(
        (e) =>
          e.person_name.toLowerCase().includes(lf) ||
          e.task_number.toLowerCase().includes(lf) ||
          (e.task_description || "").toLowerCase().includes(lf)
      )
    : entries;

  // Group entries based on viewBy
  const groups = new Map<string, PlannedWorkEntry[]>();
  for (const entry of filteredEntries) {
    const key =
      viewBy === "person"
        ? entry.person_name
        : `${entry.task_number} - ${entry.task_description || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Planned Work Entries</CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {filteredEntries.length} entries
            </div>
            <Button
              size="sm"
              onClick={() => setAssignDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Assign Person
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <Tabs
            value={viewBy}
            onValueChange={(v) => setViewBy(v as "project" | "person")}
          >
            <TabsList>
              <TabsTrigger value="project">By Project</TabsTrigger>
              <TabsTrigger value="person">By Person</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 w-[200px] h-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
            <p>Loading...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No planned work entries.{" "}
            {entries.length === 0
              ? "Click \"Assign Person\" to assign someone to a project, or use the Gantt chart to drag and create planned work."
              : "Try adjusting your filter."}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Project Code</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Planned Start</TableHead>
                  <TableHead>Planned End</TableHead>
                  <TableHead className="text-center w-[80px]">Alloc %</TableHead>
                  <TableHead className="text-right w-[100px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(groups.entries()).map(([groupKey, groupEntries]) => (
                  <>
                    {/* Group header */}
                    <TableRow key={`gh-${groupKey}`} className="bg-muted/30">
                      <TableCell
                        colSpan={7}
                        className="font-medium text-sm py-2"
                      >
                        {groupKey}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({groupEntries.length})
                        </span>
                      </TableCell>
                    </TableRow>
                    {/* Group entries */}
                    {groupEntries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {entry.person_name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.task_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.task_description || "—"}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                className="w-[140px] h-8 text-xs"
                              />
                            ) : (
                              <span className="text-sm tabular-nums">
                                {entry.planned_start}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                className="w-[140px] h-8 text-xs"
                              />
                            ) : (
                              <span className="text-sm tabular-nums">
                                {entry.planned_end}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={editAllocation}
                                onChange={(e) =>
                                  setEditAllocation(
                                    Math.max(1, Math.min(100, Number(e.target.value) || 1))
                                  )
                                }
                                className="w-[60px] h-8 text-xs text-center mx-auto"
                              />
                            ) : (
                              <span className="text-sm tabular-nums">
                                {entry.allocation_pct ?? 100}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleSaveEdit(entry.id)}
                                  title="Save"
                                >
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={handleCancelEdit}
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleStartEdit(entry)}
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDelete(entry.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AssignPersonDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onSave={() => loadData(viewBy)}
      />
    </Card>
  );
}
