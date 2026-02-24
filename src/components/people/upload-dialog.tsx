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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

interface UploadResult {
  message: string;
  total: number;
  insertedPeople: number;
  updatedPeople: number;
  ratesSet: number;
  financialYear: string;
  fyPeriod: string;
}

// Determine current FY end year: if month >= March, FY ends next year
function getCurrentFYEndYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 3 ? year + 1 : year;
}

// Generate FY options (current ± 2 years)
function getFYOptions(): { value: string; label: string }[] {
  const current = getCurrentFYEndYear();
  const options = [];
  for (let y = current - 2; y <= current + 2; y++) {
    options.push({
      value: String(y),
      label: `FY${y} (1 Mar ${y - 1} – 28 Feb ${y})`,
    });
  }
  return options;
}

export function PeopleUploadDialog({ open, onOpenChange, onUploadComplete }: UploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [fyEndYear, setFyEndYear] = useState(String(getCurrentFYEndYear()));
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
      formData.append("fyEndYear", fyEndYear);

      const res = await fetch("/api/people/upload", {
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

  const fyOptions = getFYOptions();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload People Rates</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Upload the MIT People Rates spreadsheet (.xlsx). Existing people will be
            updated and new people will be added using the person name as key. The rate
            column will be assigned to the selected financial year.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Financial Year for Rates</label>
            <Select value={fyEndYear} onValueChange={setFyEndYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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
            <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 text-sm p-4 rounded-md space-y-1">
              <p className="font-medium">Upload Complete!</p>
              <p>Financial Year: {result.financialYear} ({result.fyPeriod})</p>
              <p>Total records processed: {result.total}</p>
              <p>New people inserted: {result.insertedPeople}</p>
              <p>Existing people updated: {result.updatedPeople}</p>
              <p>Rates set: {result.ratesSet}</p>
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
