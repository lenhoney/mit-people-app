"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectReport } from "@/components/reports/project-report";
import { PeopleReport } from "@/components/reports/people-report";
import { PTOReport } from "@/components/reports/pto-report";
import { MissingTimesheetsReport } from "@/components/reports/missing-timesheets-report";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate revenue, utilization, and time off reports
        </p>
      </div>

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Project Revenue</TabsTrigger>
          <TabsTrigger value="people">People Hours</TabsTrigger>
          <TabsTrigger value="pto">Time Off</TabsTrigger>
          <TabsTrigger value="missing-timesheets">Missing Timesheets</TabsTrigger>
        </TabsList>
        <TabsContent value="projects">
          <ProjectReport />
        </TabsContent>
        <TabsContent value="people">
          <PeopleReport />
        </TabsContent>
        <TabsContent value="pto">
          <PTOReport />
        </TabsContent>
        <TabsContent value="missing-timesheets">
          <MissingTimesheetsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
