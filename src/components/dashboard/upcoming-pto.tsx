"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Palmtree } from "lucide-react";

interface PTOEntry {
  id: number;
  person_name: string;
  kerb: string | null;
  start_date: string;
  end_date: string;
  type: string;
  business_days: number;
  billable_days: number | null;
  matched_person: string | null;
  photo: string | null;
}

function PersonAvatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <img
        src={`/api/photos/${photo}`}
        alt=""
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] font-semibold text-muted-foreground">
        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
      </span>
    </div>
  );
}

interface UpcomingPTOProps {
  data: PTOEntry[];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "Sick":
      return "destructive";
    case "National Holiday":
      return "secondary";
    default:
      return "default";
  }
}

export function UpcomingPTO({ data }: UpcomingPTOProps) {
  const personalCount = data.filter((e) => e.type === "Personal" || e.type === "Sick").length;
  const holidayCount = data.filter((e) => e.type === "National Holiday").length;
  const totalDays = data.reduce((sum, e) => sum + e.business_days, 0);
  const totalBillableDays = data
    .filter((e) => e.type !== "National Holiday")
    .reduce((sum, e) => sum + (e.billable_days ?? e.business_days), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palmtree className="h-5 w-5 text-green-500" />
          Upcoming Time Off
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personal time off in the next 2 weeks
        </p>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">
              {personalCount} personal/sick
            </span>
          </div>
          {holidayCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">
                {holidayCount} holidays
              </span>
            </div>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {totalDays} business days | {totalBillableDays} billable
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center font-medium">
            No upcoming time off in the next 2 weeks!
          </p>
        ) : (
          <div className="rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Billable</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        {(entry.matched_person || entry.person_name) && (
                          <PersonAvatar
                            name={entry.matched_person || entry.person_name}
                            photo={entry.photo}
                          />
                        )}
                        {entry.matched_person || entry.person_name || (
                          <span className="text-muted-foreground italic">
                            {entry.kerb || "Everyone"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatDate(entry.start_date)}
                      {entry.start_date !== entry.end_date && (
                        <> — {formatDate(entry.end_date)}</>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-center">
                      {entry.business_days}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-center">
                      {entry.type === "National Holiday"
                        ? "—"
                        : (entry.billable_days ?? entry.business_days)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getTypeBadgeVariant(entry.type)}
                        className="text-xs"
                      >
                        {entry.type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
