"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimesheetsTable } from "@/components/timesheets/timesheets-table";
import { TimesheetsUploadDialog } from "@/components/timesheets/upload-dialog";
import { Upload, Search, X } from "lucide-react";
import { useClient } from "@/components/layout/client-provider";
import { usePermissions } from "@/components/layout/permissions-provider";

interface Timesheet {
  id: number;
  week_starts_on: string;
  category: string;
  user_name: string;
  task_description: string | null;
  task_number: string | null;
  state: string | null;
  sunday: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  total: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, pageSize: 50, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { selectedClientId } = useClient();
  const { canCreate } = usePermissions();

  const loadTimesheets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (userFilter) params.set("user", userFilter);
      if (projectFilter) params.set("project", projectFilter);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedClientId) params.set("clientId", String(selectedClientId));

      const res = await fetch(`/api/timesheets?${params}`);
      if (!res.ok) { setTimesheets([]); return; }
      const data = await res.json();
      setTimesheets(data.data || []);
      setPagination(data.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to load timesheets:", err);
    } finally {
      setLoading(false);
    }
  }, [userFilter, projectFilter, categoryFilter, startDate, endDate, selectedClientId]);

  useEffect(() => {
    loadTimesheets(1);
  }, [loadTimesheets]);

  const clearFilters = () => {
    setUserFilter("");
    setProjectFilter("");
    setCategoryFilter("");
    setStartDate("");
    setEndDate("");
  };

  const hasFilters = userFilter || projectFilter || categoryFilter || startDate || endDate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground mt-1">
            View and manage consultant timesheets
          </p>
        </div>
        {canCreate("timesheets") && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Timesheets
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Person</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by person..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="pl-8 w-[180px] h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Project</label>
          <Input
            placeholder="Filter by project..."
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-[180px] h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Project">Project</SelectItem>
              <SelectItem value="Personal Time Off">Personal Time Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px] h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px] h-9"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <TimesheetsTable
          timesheets={timesheets}
          pagination={pagination}
          onPageChange={loadTimesheets}
        />
      )}

      <TimesheetsUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={() => loadTimesheets(1)}
      />
    </div>
  );
}
