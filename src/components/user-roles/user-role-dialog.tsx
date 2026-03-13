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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RoleData {
  id: number;
  name: string;
  description: string;
  is_system: boolean;
  user_count: number;
  permissions: Record<
    string,
    { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
  >;
}

interface UserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleData | null;
  onSave: () => void;
}

const MENU_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "people", label: "People" },
  { key: "business-units", label: "Business Units" },
  { key: "clients", label: "Clients" },
  { key: "projects", label: "Projects" },
  { key: "timesheets", label: "Timesheets" },
  { key: "reports", label: "Reports" },
  { key: "gantt", label: "Gantt Chart" },
  { key: "planned-work", label: "Planned Work" },
  { key: "time-off", label: "Time Off" },
  { key: "audit-trail", label: "Audit Trail" },
  { key: "users", label: "Users" },
  { key: "user-roles", label: "User Roles" },
];

type PermAction = "can_create" | "can_read" | "can_update" | "can_delete";
const ACTIONS: { key: PermAction; label: string }[] = [
  { key: "can_create", label: "Create" },
  { key: "can_read", label: "Read" },
  { key: "can_update", label: "Update" },
  { key: "can_delete", label: "Delete" },
];

function buildEmptyPermissions(): Record<
  string,
  { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
> {
  const perms: Record<
    string,
    { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
  > = {};
  for (const item of MENU_ITEMS) {
    perms[item.key] = {
      can_create: false,
      can_read: false,
      can_update: false,
      can_delete: false,
    };
  }
  return perms;
}

export function UserRoleDialog({ open, onOpenChange, role, onSave }: UserRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState(buildEmptyPermissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!role?.id;

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      // Merge existing permissions with empty defaults so all menu items are present
      const merged = buildEmptyPermissions();
      for (const [key, perm] of Object.entries(role.permissions)) {
        if (merged[key]) {
          merged[key] = { ...perm };
        }
      }
      setPermissions(merged);
    } else {
      setName("");
      setDescription("");
      setPermissions(buildEmptyPermissions());
    }
    setError("");
  }, [role, open]);

  const togglePermission = (menuItem: string, action: PermAction) => {
    setPermissions((prev) => ({
      ...prev,
      [menuItem]: {
        ...prev[menuItem],
        [action]: !prev[menuItem][action],
      },
    }));
  };

  const toggleRowAll = (menuItem: string) => {
    setPermissions((prev) => {
      const current = prev[menuItem];
      const allChecked =
        current.can_create && current.can_read && current.can_update && current.can_delete;
      const newVal = !allChecked;
      return {
        ...prev,
        [menuItem]: {
          can_create: newVal,
          can_read: newVal,
          can_update: newVal,
          can_delete: newVal,
        },
      };
    });
  };

  const toggleColumnAll = (action: PermAction) => {
    setPermissions((prev) => {
      const allChecked = MENU_ITEMS.every((item) => prev[item.key][action]);
      const newVal = !allChecked;
      const updated = { ...prev };
      for (const item of MENU_ITEMS) {
        updated[item.key] = { ...updated[item.key], [action]: newVal };
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Role name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/user-roles/${role?.id}` : "/api/user-roles";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), permissions }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save role");
      }

      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Role" : "Add New Role"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Name *</Label>
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Role name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground font-medium">Permissions</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Menu Item</TableHead>
                      {ACTIONS.map((action) => (
                        <TableHead key={action.key} className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span>{action.label}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => toggleColumnAll(action.key)}
                            >
                              Select All
                            </Button>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center w-[80px]">
                        <span className="sr-only">Row Toggle</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MENU_ITEMS.map((item) => {
                      const perm = permissions[item.key];
                      return (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium text-sm">
                            {item.label}
                          </TableCell>
                          {ACTIONS.map((action) => (
                            <TableCell key={action.key} className="text-center">
                              <input
                                type="checkbox"
                                checked={perm[action.key]}
                                onChange={() => togglePermission(item.key, action.key)}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => toggleRowAll(item.key)}
                            >
                              All
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
