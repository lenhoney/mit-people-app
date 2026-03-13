"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { RoleData } from "./user-role-dialog";

interface UserRolesTableProps {
  roles: RoleData[];
  onEdit: (role: RoleData) => void;
  onDelete: (id: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const TOTAL_MENU_ITEMS = 13;

function getReadablePermissionsCount(
  permissions: Record<
    string,
    { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
  >
): number {
  let count = 0;
  for (const perm of Object.values(permissions)) {
    if (perm.can_read) count++;
  }
  return count;
}

export function UserRolesTable({ roles, onEdit, onDelete, canEdit = true, canDelete = true }: UserRolesTableProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Users Assigned</TableHead>
              <TableHead>Permissions Summary</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(canEdit || canDelete) ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  No roles defined yet.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const readCount = getReadablePermissionsCount(role.permissions);
                return (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {role.name}
                        {role.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.user_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {readCount}/{TOTAL_MENU_ITEMS} menu items
                      </span>
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(role)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => onDelete(role.id)}
                              disabled={role.is_system}
                              title={role.is_system ? "Cannot delete system role" : "Delete role"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {roles.length} {roles.length === 1 ? "role" : "roles"}
      </p>
    </div>
  );
}
