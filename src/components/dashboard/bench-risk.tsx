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
import { UserX } from "lucide-react";

interface BenchRiskPerson {
  person: string;
  person_id: number;
  photo: string | null;
  role: string | null;
  sow: string | null;
  total_allocation: number;
  latest_planned_end: string | null;
  planned_to: string | null;
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

interface BenchRiskProps {
  data: BenchRiskPerson[];
  horizon: string;
  totalPeople: number;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AllocationBadge({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex items-center text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
        No work
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      {pct}%
    </span>
  );
}

export function BenchRisk({ data, horizon, totalPeople }: BenchRiskProps) {
  const atRiskCount = data.length;
  const noWorkCount = data.filter((p) => p.total_allocation === 0).length;
  const underAllocCount = atRiskCount - noWorkCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-red-500" />
          Bench Risk
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          People with less than 50% planned allocation beyond{" "}
          <span className="font-medium text-foreground">
            {formatDate(horizon)}
          </span>{" "}
          (2 months out)
        </p>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">
              {noWorkCount} with no planned work
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">
              {underAllocCount} under-allocated (&lt;50%)
            </span>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {atRiskCount} of {totalPeople} people at risk
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center font-medium">
            All people have sufficient planned work beyond the 2-month horizon!
          </p>
        ) : (
          <div className="rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>SOW</TableHead>
                  <TableHead className="text-center">Allocation</TableHead>
                  <TableHead>Planned To</TableHead>
                  <TableHead>Work Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((person) => (
                  <TableRow key={person.person_id}>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={person.person} photo={person.photo} />
                        {person.person}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.role || "\u2014"}
                    </TableCell>
                    <TableCell>
                      {person.sow ? (
                        <Badge variant="outline" className="text-xs">
                          {person.sow}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {"\u2014"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <AllocationBadge pct={person.total_allocation} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {person.planned_to
                        ? formatDate(person.planned_to)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {person.latest_planned_end
                        ? formatDate(person.latest_planned_end)
                        : "\u2014"}
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
