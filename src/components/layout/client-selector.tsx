"use client";

import { useClient } from "./client-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientSelector() {
  const { clients, selectedClientId, setSelectedClientId, loading } =
    useClient();

  if (loading || clients.length === 0) return null;

  return (
    <Select
      value={selectedClientId ? String(selectedClientId) : undefined}
      onValueChange={(val) => setSelectedClientId(Number(val))}
    >
      <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-sidebar-foreground/70">
        <SelectValue placeholder="Select client" />
      </SelectTrigger>
      <SelectContent>
        {clients.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.short_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
