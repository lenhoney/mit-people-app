"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

interface AnniversaryPerson {
  id: number;
  person: string;
  photo: string | null;
  years: number;
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

interface WorkAnniversaryProps {
  data: AnniversaryPerson[];
}

export function WorkAnniversary({ data }: WorkAnniversaryProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          Work Anniversaries
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Work milestones this month
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((person) => (
            <div key={person.id} className="flex items-center gap-3 py-1">
              <PersonAvatar name={person.person} photo={person.photo} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{person.person}</p>
              </div>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                {person.years} {person.years === 1 ? "year" : "years"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
