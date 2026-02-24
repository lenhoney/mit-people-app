"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake } from "lucide-react";

interface BirthdayPerson {
  id: number;
  person: string;
  photo: string | null;
  birthday: string;
  when: "today" | "tomorrow" | "this_month";
}

function PersonAvatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <img
        src={`/api/photos/${photo}`}
        alt=""
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-semibold text-muted-foreground">
        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
      </span>
    </div>
  );
}

function formatDayOnly(mmdd: string): string {
  const [mm, dd] = mmdd.split("-");
  const date = new Date(2000, parseInt(mm) - 1, parseInt(dd));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface BirthdayReminderProps {
  data: BirthdayPerson[];
}

export function BirthdayReminder({ data }: BirthdayReminderProps) {
  if (data.length === 0) return null;

  const monthName = new Date(2000, parseInt(data[0].birthday.split("-")[0]) - 1, 1)
    .toLocaleDateString("en-US", { month: "long" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="h-5 w-5 text-pink-500" />
          Birthday Reminders
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.length} birthday{data.length !== 1 ? "s" : ""} in {monthName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {data.map((person) => (
            <div
              key={person.id}
              className={`flex items-center gap-3 py-1.5 px-2 rounded-md ${
                person.when === "today"
                  ? "bg-pink-50 dark:bg-pink-950/30"
                  : person.when === "tomorrow"
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : ""
              }`}
            >
              <PersonAvatar name={person.person} photo={person.photo} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{person.person}</p>
              </div>
              {person.when === "today" ? (
                <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 hover:bg-pink-100 text-xs">
                  Today
                </Badge>
              ) : person.when === "tomorrow" ? (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100 text-xs">
                  Tomorrow
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDayOnly(person.birthday)}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
