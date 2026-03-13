"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText, ChevronLeft, ChevronRight, Search } from "lucide-react";

interface AuditEntry {
  id: number;
  user_name: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ACTION_BADGE_STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  LOGIN_SUCCESS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  LOGIN_FAILED: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ACCOUNT_QUARANTINED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  ACCOUNT_UNQUARANTINED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEntityType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Available filter options (populated from API)
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userFilter) params.set("user", userFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", page.toString());
      params.set("pageSize", "50");

      const res = await fetch(`/api/audit-trail?${params}`);
      if (!res.ok) { setEntries([]); return; }
      const data = await res.json();

      setEntries(data.data || []);
      setPagination(data.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 });
      if (data.filters) {
        setEntityTypes(data.filters.entityTypes || []);
        setUsers(data.filters.users || []);
      }
    } catch (err) {
      console.error("Failed to load audit trail:", err);
    } finally {
      setLoading(false);
    }
  }, [userFilter, actionFilter, entityTypeFilter, startDate, endDate, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleClearFilters = () => {
    setUserFilter("");
    setActionFilter("");
    setEntityTypeFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ScrollText className="h-7 w-7" />
          Audit Trail
        </h1>
        <p className="text-muted-foreground mt-1">
          View all changes made to the database
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">User</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by user..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-9 pl-8 w-[180px]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Action</label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
              <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
              <SelectItem value="ACCOUNT_QUARANTINED">Account Quarantined</SelectItem>
              <SelectItem value="ACCOUNT_UNQUARANTINED">Account Unquarantined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
          <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEntityType(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="h-9 w-[150px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="h-9 w-[150px]"
          />
        </div>

        <Button variant="outline" size="sm" className="h-9" onClick={handleClearFilters}>
          Clear
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {pagination.total} {pagination.total === 1 ? "entry" : "entries"} found
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No audit trail entries found.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Date & Time</TableHead>
                <TableHead className="w-[160px]">User</TableHead>
                <TableHead className="w-[90px]">Action</TableHead>
                <TableHead className="w-[140px]">Entity Type</TableHead>
                <TableHead className="w-[80px]">Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entry.user_name}</p>
                      {entry.user_email && (
                        <p className="text-xs text-muted-foreground truncate">{entry.user_email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${ACTION_BADGE_STYLES[entry.action] || "bg-gray-100 text-gray-700"} text-[11px] px-2 py-0.5`}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatEntityType(entry.entity_type)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {entry.entity_id || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[400px] truncate">
                    {entry.details || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
