"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRolesTable } from "@/components/user-roles/user-roles-table";
import { UserRoleDialog, RoleData } from "@/components/user-roles/user-role-dialog";
import { usePermissions } from "@/components/layout/permissions-provider";

export default function UserRolesPage() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/user-roles");
      if (!res.ok) { setRoles([]); return; }
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load user roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleAdd = () => {
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const handleEdit = (role: RoleData) => {
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const res = await fetch(`/api/user-roles/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadRoles();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete role");
      }
    } catch (err) {
      console.error("Failed to delete role:", err);
      alert("Failed to delete role");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">User Roles</h1>
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
          <h1 className="text-3xl font-bold">User Roles</h1>
          <p className="text-muted-foreground mt-1">
            Manage roles and permissions
          </p>
        </div>
        {canCreate("user-roles") && (
          <Button onClick={handleAdd}>
            <KeyRound className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        )}
      </div>

      <UserRolesTable
        roles={roles}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canUpdate("user-roles")}
        canDelete={canDelete("user-roles")}
      />

      <UserRoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={selectedRole}
        onSave={loadRoles}
      />
    </div>
  );
}
