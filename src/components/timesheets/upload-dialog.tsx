"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useClient } from "@/components/layout/client-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

interface UploadResult {
  message: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  skippedUsers: string[];
}

export function TimesheetsUploadDialog({ open, onOpenChange, onUploadComplete }: UploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { clients, selectedClientId } = useClient();
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    if (selectedClientId) {
      setClientId(String(selectedClientId));
    }
  }, [selectedClientId]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (clientId) {
        formData.append("clientId", clientId);
      }

      const res = await fetch("/api/timesheets/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setResult(data);
      onUploadComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    if (selectedClientId) setClientId(String(selectedClientId));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Timesheets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Upload the Timesheets spreadsheet (.xlsx). Only timesheets for people
            already in the People table will be imported. Existing entries will be updated
            using week start date + user + task number as key.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select client for new projects" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.short_name} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 text-sm p-4 rounded-md space-y-1">
                <p className="font-medium">Upload Complete!</p>
                <p>Total records in file: {result.total}</p>
                <p>New timesheets inserted: {result.inserted}</p>
                <p>Existing timesheets updated: {result.updated}</p>
                <p>Skipped (user not in People): {result.skipped}</p>
              </div>
              {result.skippedUsers.length > 0 && (
                <div className="bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 text-sm p-4 rounded-md">
                  <p className="font-medium mb-1">Skipped Users ({result.skippedUsers.length}):</p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="list-disc list-inside space-y-0.5">
                      {result.skippedUsers.map((user) => (
                        <li key={user}>{user}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-2 text-xs">
                    These users need to be added to the People table first.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
