"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsersTable, UserData } from "@/components/users/users-table";
import { UserDialog } from "@/components/users/user-dialog";
import { usePermissions } from "@/components/layout/permissions-provider";

interface RoleOption {
  id: number;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const loadData = useCallback(async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/user-roles"),
      ]);
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const rolesData = rolesRes.ok ? await rolesRes.json() : [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      setRoles(Array.isArray(rolesData) ? rolesData.map((r: RoleOption) => ({ id: r.id, name: r.name })) : []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: UserData) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm("Are you sure you want to reset this user's password?")) return;

    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Password has been reset.\n\nNew password: ${data.password}`);
        loadData();
      } else {
        alert(data.error || "Failed to reset password");
      }
    } catch (err) {
      console.error("Failed to reset password:", err);
    }
  };

  const handleUnquarantine = async (id: number) => {
    if (!confirm("Are you sure you want to un-quarantine this user? They will be able to log in again.")) return;

    try {
      const res = await fetch(`/api/users/${id}/unquarantine`, {
        method: "POST",
      });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to un-quarantine user");
      }
    } catch (err) {
      console.error("Failed to un-quarantine user:", err);
    }
  };

  const handleSave = (result?: { password?: string }) => {
    if (result?.password) {
      alert(
        `User created successfully.\n\nGenerated password: ${result.password}\n\nPlease save this password - it will also be visible in the users table.`
      );
    }
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Users</h1>
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
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts and role assignments
          </p>
        </div>
        {canCreate("users") && (
          <Button onClick={handleAdd}>
            <Shield className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <UsersTable
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
        onUnquarantine={handleUnquarantine}
        canEdit={canUpdate("users")}
        canDelete={canDelete("users")}
      />

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        roles={roles}
        onSave={handleSave}
      />
    </div>
  );
}
