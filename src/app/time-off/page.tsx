"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PTOTable, PTOEntry } from "@/components/pto/pto-table";
import { PTOUploadDialog } from "@/components/pto/pto-upload-dialog";
import { Upload } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-provider";

export default function TimeOffPage() {
  const [entries, setEntries] = useState<PTOEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { canCreate, canDelete } = usePermissions();

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/pto");
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error("Failed to load PTO data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this time off entry?"))
      return;

    try {
      const res = await fetch("/api/pto", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        loadEntries();
      }
    } catch (err) {
      console.error("Failed to delete PTO entry:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Personal Time Off</h1>
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
          <h1 className="text-3xl font-bold">Personal Time Off</h1>
          <p className="text-muted-foreground mt-1">
            Manage planned personal time off, sick leave, and holidays
          </p>
        </div>
        {canCreate("time-off") && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload PTO
          </Button>
        )}
      </div>

      <PTOTable entries={entries} onDelete={handleDelete} canDelete={canDelete("time-off")} />

      <PTOUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={loadEntries}
      />
    </div>
  );
}
