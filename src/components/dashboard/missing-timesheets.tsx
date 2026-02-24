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
import { AlertTriangle } from "lucide-react";

interface MissingTimesheetsProps {
  data: { person: string; role: string | null; sow: string | null; photo: string | null }[];
  currentMonth: string;
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

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MissingTimesheets({ data, currentMonth }: MissingTimesheetsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Missing Timesheets - {formatMonth(currentMonth)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Top 10 people who haven&apos;t booked project timesheets this month
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All people have booked timesheets this month!
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>SOW</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((person) => (
                <TableRow key={person.person}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={person.person} photo={person.photo} />
                      {person.person}
                    </div>
                  </TableCell>
                  <TableCell>{person.role || "—"}</TableCell>
                  <TableCell>
                    {person.sow ? (
                      <Badge variant="outline">{person.sow}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
