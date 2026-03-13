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
import { Pencil, Trash2, ArrowUpDown, Search, Image } from "lucide-react";
import { ClientData } from "./client-dialog";

interface ClientsTableProps {
  clients: ClientData[];
  onEdit: (client: ClientData) => void;
  onDelete: (id: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type SortField = "short_name" | "name" | "contact_person";
type SortDir = "asc" | "desc";

export function ClientsTable({
  clients,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("short_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = clients;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.short_name.toLowerCase().includes(lower) ||
          c.name.toLowerCase().includes(lower) ||
          c.contact_person.toLowerCase().includes(lower) ||
          c.contact_email.toLowerCase().includes(lower) ||
          (c.business_units &&
            c.business_units.some((bu) =>
              bu.toLowerCase().includes(lower)
            ))
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [clients, search, sortField, sortDir]);

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Logo</TableHead>
              <TableHead>
                <SortButton field="short_name">Short Name</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="name">Name</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="contact_person">Contact</SortButton>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Business Units</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {search
                    ? "No matching clients found"
                    : "No clients yet. Click 'Add Client' to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    {client.logo ? (
                      <img
                        src={`/api/client-logos/${client.logo}`}
                        alt={client.short_name}
                        className="w-8 h-8 rounded object-contain bg-white/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Badge>{client.short_name}</Badge>
                  </TableCell>
                  <TableCell>{client.name || "—"}</TableCell>
                  <TableCell>{client.contact_person || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {client.contact_email || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {client.business_units &&
                      client.business_units.length > 0 ? (
                        client.business_units.map((bu) => (
                          <Badge key={bu} variant="secondary" className="text-xs">
                            {bu}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(client)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => client.id && onDelete(client.id)}
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
        Showing {filtered.length} of {clients.length} clients
      </p>
    </div>
  );
}
