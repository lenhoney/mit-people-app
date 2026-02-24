import { NextRequest, NextResponse } from "next/server";
import db, { cleanupPlannedWork } from "@/lib/db";

interface TimesheetRangeRow {
  task_number: string;
  task_description: string;
  user_name: string;
  person_id: number;
  earliest_week: string;
  latest_week: string;
  total_hours: number;
}

interface PlannedWorkRow {
  id: number;
  person_id: number;
  user_name: string;
  task_number: string;
  task_description: string | null;
  planned_start: string;
  planned_end: string;
  allocation_pct: number;
}

export async function GET(request: NextRequest) {
  try {
    // Clean up past-dated planned work before returning data
    cleanupPlannedWork();

    const { searchParams } = new URL(request.url);
    const viewMode = searchParams.get("view") || "project";
    const projectFilter = searchParams.get("project");
    const personFilter = searchParams.get("person");

    // Query 1: Get actual date ranges per person per project from timesheets
    // Exclude projects with 'Completed' status
    let timesheetQuery = `
      SELECT
        t.task_number,
        t.task_description,
        t.user_name,
        p.id as person_id,
        MIN(t.week_starts_on) as earliest_week,
        MAX(t.week_starts_on) as latest_week,
        SUM(t.total) as total_hours
      FROM timesheets t
      JOIN people p ON t.user_name = p.person
      LEFT JOIN projects proj ON t.task_number = proj.task_number
      WHERE t.category = 'Project'
        AND t.task_number IS NOT NULL
        AND t.task_number != ''
        AND COALESCE(p.status, 'Active') = 'Active'
        AND COALESCE(proj.status, 'Started') = 'Started'
    `;
    const params: Record<string, string> = {};

    if (projectFilter) {
      timesheetQuery +=
        " AND (t.task_description LIKE @project OR t.task_number LIKE @project)";
      params.project = `%${projectFilter}%`;
    }
    if (personFilter) {
      timesheetQuery += " AND t.user_name LIKE @person";
      params.person = `%${personFilter}%`;
    }

    timesheetQuery +=
      " GROUP BY t.task_number, t.task_description, t.user_name, p.id";
    timesheetQuery +=
      viewMode === "people"
        ? " ORDER BY t.user_name, t.task_description"
        : " ORDER BY t.task_description, t.user_name";

    const timesheetRows = db
      .prepare(timesheetQuery)
      .all(params) as TimesheetRangeRow[];

    // Query 2: Get all planned work entries (exclude Completed projects)
    let plannedQuery = `
      SELECT pw.id, pw.person_id, p.person as user_name,
             pw.task_number, pw.task_description,
             pw.planned_start, pw.planned_end, pw.allocation_pct
      FROM planned_work pw
      JOIN people p ON pw.person_id = p.id
      LEFT JOIN projects proj ON pw.task_number = proj.task_number
      WHERE COALESCE(p.status, 'Active') = 'Active'
        AND COALESCE(proj.status, 'Started') = 'Started'
    `;
    const plannedParams: Record<string, string> = {};

    if (projectFilter) {
      plannedQuery +=
        " AND (pw.task_description LIKE @project OR pw.task_number LIKE @project)";
      plannedParams.project = `%${projectFilter}%`;
    }
    if (personFilter) {
      plannedQuery += " AND p.person LIKE @person";
      plannedParams.person = `%${personFilter}%`;
    }

    const plannedRows = db
      .prepare(plannedQuery)
      .all(plannedParams) as PlannedWorkRow[];

    // Build a lookup map for planned work
    const plannedMap = new Map<string, PlannedWorkRow>();
    for (const pw of plannedRows) {
      plannedMap.set(`${pw.person_id}:${pw.task_number}`, pw);
    }

    // Build person photo lookup
    const photoRows = db.prepare("SELECT id, photo FROM people WHERE photo IS NOT NULL").all() as { id: number; photo: string }[];
    const photoMap = new Map<number, string>();
    for (const r of photoRows) {
      photoMap.set(r.id, r.photo);
    }

    if (viewMode === "people") {
      return buildPeopleResponse(timesheetRows, plannedMap, photoMap);
    } else {
      return buildProjectResponse(timesheetRows, plannedMap, photoMap);
    }
  } catch (error) {
    console.error("Error fetching gantt data:", error);
    return NextResponse.json(
      { error: "Failed to fetch gantt data" },
      { status: 500 }
    );
  }
}

function buildProjectResponse(
  timesheetRows: TimesheetRangeRow[],
  plannedMap: Map<string, PlannedWorkRow>,
  photoMap: Map<number, string>
) {
  const projectMap = new Map<
    string,
    {
      task_number: string;
      task_description: string;
      earliest_week: string;
      latest_week: string;
      people: Array<{
        user_name: string;
        person_id: number;
        photo: string | null;
        actual_start: string;
        actual_end: string;
        total_hours: number;
        planned_work: {
          id: number;
          planned_start: string;
          planned_end: string;
          allocation_pct: number;
        } | null;
      }>;
    }
  >();

  const consumedKeys = new Set<string>();

  for (const row of timesheetRows) {
    const key = row.task_number;
    if (!projectMap.has(key)) {
      projectMap.set(key, {
        task_number: row.task_number,
        task_description: row.task_description,
        earliest_week: row.earliest_week,
        latest_week: row.latest_week,
        people: [],
      });
    }
    const project = projectMap.get(key)!;

    if (row.earliest_week < project.earliest_week)
      project.earliest_week = row.earliest_week;
    if (row.latest_week > project.latest_week)
      project.latest_week = row.latest_week;

    const plannedKey = `${row.person_id}:${row.task_number}`;
    consumedKeys.add(plannedKey);
    const planned = plannedMap.get(plannedKey);

    project.people.push({
      user_name: row.user_name,
      person_id: row.person_id,
      photo: photoMap.get(row.person_id) || null,
      actual_start: row.earliest_week,
      actual_end: row.latest_week,
      total_hours: row.total_hours,
      planned_work: planned
        ? {
            id: planned.id,
            planned_start: planned.planned_start,
            planned_end: planned.planned_end,
            allocation_pct: planned.allocation_pct ?? 100,
          }
        : null,
    });

    if (planned && planned.planned_end > project.latest_week) {
      project.latest_week = planned.planned_end;
    }
  }

  // Add planned-work-only people (no timesheets for their project)
  for (const [key, pw] of plannedMap) {
    if (consumedKeys.has(key)) continue;

    if (!projectMap.has(pw.task_number)) {
      projectMap.set(pw.task_number, {
        task_number: pw.task_number,
        task_description: pw.task_description || pw.task_number,
        earliest_week: pw.planned_start,
        latest_week: pw.planned_end,
        people: [],
      });
    }
    const project = projectMap.get(pw.task_number)!;

    if (pw.planned_start < project.earliest_week)
      project.earliest_week = pw.planned_start;
    if (pw.planned_end > project.latest_week)
      project.latest_week = pw.planned_end;

    project.people.push({
      user_name: pw.user_name,
      person_id: pw.person_id,
      photo: photoMap.get(pw.person_id) || null,
      actual_start: "",
      actual_end: "",
      total_hours: 0,
      planned_work: {
        id: pw.id,
        planned_start: pw.planned_start,
        planned_end: pw.planned_end,
        allocation_pct: pw.allocation_pct ?? 100,
      },
    });
  }

  // Enrich projects with metadata from the projects table
  const projectMetadata = db
    .prepare("SELECT task_number, group_label, budget FROM projects")
    .all() as { task_number: string; group_label: string | null; budget: number | null }[];
  const metaMap = new Map(projectMetadata.map((p) => [p.task_number, p]));

  const projects = Array.from(projectMap.values()).map((p) => ({
    ...p,
    group_label: metaMap.get(p.task_number)?.group_label || null,
    budget: metaMap.get(p.task_number)?.budget || null,
  }));

  // Sort: grouped first (by group_label alpha), ungrouped last, then by description
  projects.sort((a, b) => {
    const aGroup = a.group_label || "\uffff";
    const bGroup = b.group_label || "\uffff";
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    return (a.task_description || "").localeCompare(b.task_description || "");
  });

  let globalStart = "";
  let globalEnd = "";
  for (const p of projects) {
    if (!globalStart || p.earliest_week < globalStart)
      globalStart = p.earliest_week;
    if (!globalEnd || p.latest_week > globalEnd) globalEnd = p.latest_week;
  }

  return NextResponse.json({
    projects,
    dateRange: { start: globalStart, end: globalEnd },
  });
}

function buildPeopleResponse(
  timesheetRows: TimesheetRangeRow[],
  plannedMap: Map<string, PlannedWorkRow>,
  photoMap: Map<number, string>
) {
  const personMap = new Map<
    number,
    {
      person_id: number;
      user_name: string;
      photo: string | null;
      earliest_week: string;
      latest_week: string;
      projects: Array<{
        task_number: string;
        task_description: string;
        actual_start: string;
        actual_end: string;
        total_hours: number;
        planned_work: {
          id: number;
          planned_start: string;
          planned_end: string;
          allocation_pct: number;
        } | null;
      }>;
    }
  >();

  const consumedKeys = new Set<string>();

  for (const row of timesheetRows) {
    const key = row.person_id;
    if (!personMap.has(key)) {
      personMap.set(key, {
        person_id: row.person_id,
        user_name: row.user_name,
        photo: photoMap.get(row.person_id) || null,
        earliest_week: row.earliest_week,
        latest_week: row.latest_week,
        projects: [],
      });
    }
    const person = personMap.get(key)!;

    if (row.earliest_week < person.earliest_week)
      person.earliest_week = row.earliest_week;
    if (row.latest_week > person.latest_week)
      person.latest_week = row.latest_week;

    const plannedKey = `${row.person_id}:${row.task_number}`;
    consumedKeys.add(plannedKey);
    const planned = plannedMap.get(plannedKey);

    person.projects.push({
      task_number: row.task_number,
      task_description: row.task_description,
      actual_start: row.earliest_week,
      actual_end: row.latest_week,
      total_hours: row.total_hours,
      planned_work: planned
        ? {
            id: planned.id,
            planned_start: planned.planned_start,
            planned_end: planned.planned_end,
            allocation_pct: planned.allocation_pct ?? 100,
          }
        : null,
    });

    if (planned && planned.planned_end > person.latest_week) {
      person.latest_week = planned.planned_end;
    }
  }

  // Add planned-work-only entries (no timesheets for that person-project combo)
  for (const [key, pw] of plannedMap) {
    if (consumedKeys.has(key)) continue;

    if (!personMap.has(pw.person_id)) {
      personMap.set(pw.person_id, {
        person_id: pw.person_id,
        user_name: pw.user_name,
        photo: photoMap.get(pw.person_id) || null,
        earliest_week: pw.planned_start,
        latest_week: pw.planned_end,
        projects: [],
      });
    }
    const person = personMap.get(pw.person_id)!;

    if (pw.planned_start < person.earliest_week)
      person.earliest_week = pw.planned_start;
    if (pw.planned_end > person.latest_week)
      person.latest_week = pw.planned_end;

    person.projects.push({
      task_number: pw.task_number,
      task_description: pw.task_description || pw.task_number,
      actual_start: "",
      actual_end: "",
      total_hours: 0,
      planned_work: {
        id: pw.id,
        planned_start: pw.planned_start,
        planned_end: pw.planned_end,
        allocation_pct: pw.allocation_pct ?? 100,
      },
    });
  }

  const people = Array.from(personMap.values());

  let globalStart = "";
  let globalEnd = "";
  for (const p of people) {
    if (!globalStart || p.earliest_week < globalStart)
      globalStart = p.earliest_week;
    if (!globalEnd || p.latest_week > globalEnd) globalEnd = p.latest_week;
  }

  return NextResponse.json({
    people,
    dateRange: { start: globalStart, end: globalEnd },
  });
}
