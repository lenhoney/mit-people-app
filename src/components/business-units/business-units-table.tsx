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
import { Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
import { BusinessUnitData } from "./business-unit-dialog";

interface BusinessUnitsTableProps {
  businessUnits: BusinessUnitData[];
  onEdit: (bu: BusinessUnitData) => void;
  onDelete: (id: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type SortField =
  | "short_name"
  | "registered_name"
  | "manager_1"
  | "registered_country";
type SortDir = "asc" | "desc";

export function BusinessUnitsTable({
  businessUnits,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: BusinessUnitsTableProps) {
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
    let result = businessUnits;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (bu) =>
          bu.short_name.toLowerCase().includes(lower) ||
          bu.registered_name.toLowerCase().includes(lower) ||
          bu.manager_1.toLowerCase().includes(lower) ||
          (bu.manager_2 && bu.manager_2.toLowerCase().includes(lower)) ||
          bu.registered_country.toLowerCase().includes(lower) ||
          bu.icm_signatory_name.toLowerCase().includes(lower)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [businessUnits, search, sortField, sortDir]);

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
          placeholder="Search business units..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="short_name">Short Name</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="registered_name">
                  Registered Name
                </SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="manager_1">Manager 1</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="registered_country">Country</SortButton>
              </TableHead>
              <TableHead>ICM Signatory</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(canEdit || canDelete) ? 6 : 5}
                  className="text-center py-8 text-muted-foreground"
                >
                  {search
                    ? "No matching business units found"
                    : "No business units yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((bu) => (
                <TableRow key={bu.id}>
                  <TableCell className="font-medium">
                    <Badge>{bu.short_name}</Badge>
                  </TableCell>
                  <TableCell>{bu.registered_name || "—"}</TableCell>
                  <TableCell>{bu.manager_1 || "—"}</TableCell>
                  <TableCell>{bu.registered_country || "—"}</TableCell>
                  <TableCell>{bu.icm_signatory_name || "—"}</TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(bu)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => bu.id && onDelete(bu.id)}
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
        Showing {filtered.length} of {businessUnits.length} business units
      </p>
    </div>
  );
}
