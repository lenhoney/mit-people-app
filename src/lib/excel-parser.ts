import * as XLSX from "xlsx";

export interface PeopleRateRow {
  person: string;
  sow: string | null;
  role: string | null;
  rate: number | null;
  kerb: string | null;
  managed_services: number;
  architecture: number;
  app_support: number;
  computing: number;
}

export interface TimesheetRow {
  week_starts_on: string;
  category: string;
  user_name: string;
  task_description: string | null;
  task_number: string | null;
  state: string | null;
  sunday: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  total: number;
}

function normalizeCategory(category: string | null | undefined): string {
  if (!category) return "Project";
  const lower = category.toLowerCase().trim();
  const ptoCategories = ["admin", "holiday", "sick", "training", "vacation"];
  if (ptoCategories.some((c) => lower.includes(c))) {
    return "Personal Time Off";
  }
  return "Project";
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function toString(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

function excelDateToISO(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }

  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  return null;
}

// Trim all keys in a row object to handle Excel columns with leading/trailing spaces
function trimKeys(row: Record<string, unknown>): Record<string, unknown> {
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    trimmed[key.trim()] = value;
  }
  return trimmed;
}

// Financial year runs 1 March to 28 Feb
// Given a FY end year (e.g. 2026), returns { fy_label: "FY2026", fy_start: "2025-03-01", fy_end: "2026-02-28" }
export function makeFY(endYear: number): { fy_label: string; fy_start: string; fy_end: string } {
  return {
    fy_label: `FY${endYear}`,
    fy_start: `${endYear - 1}-03-01`,
    fy_end: `${endYear}-02-28`,
  };
}

// Determine which FY a date falls in (FY runs 1 March to 28 Feb)
export function dateToFYEndYear(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1; // 1-based
  const year = d.getFullYear();
  // March onwards = FY ending next year. Jan-Feb = FY ending this year.
  return month >= 3 ? year + 1 : year;
}

export function parsePeopleRates(buffer: ArrayBuffer): PeopleRateRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: PeopleRateRow[] = [];

  for (const rawRow of rawRows) {
    const row = trimKeys(rawRow);

    const person = toString(row["Person"]);
    if (!person) continue;

    const rate = toNumber(row["rate"]);

    // Support both "Role" (new sheet) and "2026 Role" / "2025 Role" (old sheet)
    const role = toString(row["Role"]) || toString(row["2026 Role"]) || toString(row["2025 Role"]);

    results.push({
      person,
      sow: toString(row["SOW"]),
      role,
      rate: rate > 0 ? rate : null,
      kerb: toString(row["Kerb"]),
      managed_services: toNumber(row["Managed Services"]) ? 1 : 0,
      architecture: toNumber(row["Architecture"]) ? 1 : 0,
      app_support: toNumber(row["App Support"]) ? 1 : 0,
      computing: toNumber(row["Computing"]) ? 1 : 0,
    });
  }

  return results;
}

export function parseTimesheets(buffer: ArrayBuffer): TimesheetRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: TimesheetRow[] = [];

  for (const rawRow of rawRows) {
    const row = trimKeys(rawRow);

    const userName = toString(row["user"]);
    if (!userName) continue;

    const weekStartsOn = excelDateToISO(row["week_starts_on"]);
    if (!weekStartsOn) continue;

    results.push({
      week_starts_on: weekStartsOn,
      category: normalizeCategory(toString(row["category"])),
      user_name: userName,
      task_description: toString(row["task.short_description"]),
      task_number: toString(row["task.number"]),
      state: toString(row["state"]),
      sunday: toNumber(row["sunday"]),
      monday: toNumber(row["monday"]),
      tuesday: toNumber(row["tuesday"]),
      wednesday: toNumber(row["wednesday"]),
      thursday: toNumber(row["thursday"] || row["Thursday"]),
      friday: toNumber(row["friday"] || row["Friday"]),
      saturday: toNumber(row["saturday"] || row["Saturday"]),
      total: toNumber(row["total"]),
    });
  }

  return results;
}
