"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, RefreshCw, Search, Eye, EyeOff, ShieldOff } from "lucide-react";

export interface UserData {
  id: number;
  username: string;
  email: string;
  name: string;
  password_plain: string | null;
  is_protected: boolean;
  is_quarantined: boolean;
  failed_login_attempts: number;
  quarantined_at: string | null;
  roles: { id: number; name: string }[];
  created_at: string;
}

interface UsersTableProps {
  users: UserData[];
  onEdit: (user: UserData) => void;
  onDelete: (id: number) => void;
  onResetPassword: (id: number) => void;
  onUnquarantine: (id: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function UsersTable({ users, onEdit, onDelete, onResetPassword, onUnquarantine, canEdit = true, canDelete = true }: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search) return users;

    const lower = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(lower) ||
        u.username.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower)
    );
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Password</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-[180px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(canEdit || canDelete) ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  {search ? "No matching users found" : "No users yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.is_quarantined ? "bg-red-950/20" : ""}
                >
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="font-mono text-sm">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="text-xs">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.is_quarantined ? (
                      <Badge className="bg-red-900 text-red-300 text-xs">
                        Quarantined
                      </Badge>
                    ) : (
                      <Badge className="bg-green-900 text-green-300 text-xs">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.password_plain ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm">
                          {visiblePasswords.has(user.id)
                            ? user.password_plain
                            : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => togglePasswordVisibility(user.id)}
                        >
                          {visiblePasswords.has(user.id) ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && user.is_quarantined && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-400"
                            onClick={() => onUnquarantine(user.id)}
                            title="Un-quarantine user"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(user)}
                            title="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onResetPassword(user.id)}
                            title="Reset password"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(user.id)}
                            disabled={user.is_protected}
                            title={user.is_protected ? "Protected user cannot be deleted" : "Delete user"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {users.length} users
      </p>
    </div>
  );
}
