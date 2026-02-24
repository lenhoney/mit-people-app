"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

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
  matched: number;
  unmatched: number;
  skippedNoPerson: number;
}

export function PTOUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: UploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

      const res = await fetch("/api/pto/upload", {
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Personal Time Off</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with personal time off data. Expected columns:
            Name, People (kerb@mit.edu), Start Date, End Date, Type, Leave
            Status, Country, Message. The People column will be matched to the
            kerb field in the People table.
          </p>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 text-sm p-4 rounded-md space-y-1">
              <p className="font-medium">Upload Complete!</p>
              <p>Total records processed: {result.total}</p>
              <p>New entries inserted: {result.inserted}</p>
              <p>Existing entries updated: {result.updated}</p>
              <p>
                People matched: {result.matched} | Unmatched:{" "}
                {result.unmatched}
              </p>
              {result.skippedNoPerson > 0 && (
                <p className="text-muted-foreground">
                  {result.skippedNoPerson} entries without a person (e.g.
                  national holidays)
                </p>
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
