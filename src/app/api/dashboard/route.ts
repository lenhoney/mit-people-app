import { NextRequest, NextResponse } from "next/server";
import { cleanupPlannedWork, query, queryOne } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

interface RevenueRow {
  month: string;
  revenue: number;
  plannedRevenue: number;
}

interface MissingPerson {
  person: string;
  role: string | null;
  sow: string | null;
  photo: string | null;
}

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

interface PlannedWorkRow {
  person_id: number;
  planned_start: string;
  planned_end: string;
  allocation_pct: number;
}

interface RateRow {
  rate: number;
  fy_start: string;
  fy_end: string;
}

interface PTORow {
  person_id: number;
  start_date: string;
  end_date: string;
  type: string;
  billable_days: number | null;
  business_days: number;
}

// Day-level hours for a given month: only count hours for days whose actual date falls within that month
// Uses $monthStart and $monthEnd positional parameters (injected per-query)
const DAY_HOURS_FOR_MONTH_SQL = `(
  CASE WHEN (t.week_starts_on::date + 0) BETWEEN $1::date AND $2::date THEN t.sunday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 1) BETWEEN $1::date AND $2::date THEN t.monday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 2) BETWEEN $1::date AND $2::date THEN t.tuesday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 3) BETWEEN $1::date AND $2::date THEN t.wednesday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 4) BETWEEN $1::date AND $2::date THEN t.thursday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 5) BETWEEN $1::date AND $2::date THEN t.friday ELSE 0 END +
  CASE WHEN (t.week_starts_on::date + 6) BETWEEN $1::date AND $2::date THEN t.saturday ELSE 0 END
)`;

// Week overlaps month if the week's Saturday >= monthStart AND week_starts_on <= monthEnd
const MONTH_OVERLAP_FILTER = `(t.week_starts_on::date + 6) >= $1::date AND t.week_starts_on::date <= $2::date`;

const REVENUE_JOIN = `
  FROM timesheets t
  JOIN people p ON t.user_name = p.person
  LEFT JOIN people_rates pr ON pr.person_id = p.id
    AND t.week_starts_on >= pr.fy_start
    AND t.week_starts_on <= pr.fy_end
`;

/**
 * Calculate business days (Mon-Fri) between two dates (inclusive).
 */
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * For a given month (YYYY-MM), compute the number of billable PTO days
 * that fall within that month. Uses day-by-day counting of weekdays
 * in the overlap, capped by the total billable_days of the PTO entry.
 */
function ptoBillableDaysInMonth(
  month: string,
  ptoStart: string,
  ptoEnd: string,
  totalBillableDays: number
): number {
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // last day of month

  const pStart = new Date(ptoStart + "T00:00:00");
  const pEnd = new Date(ptoEnd + "T00:00:00");

  // Find overlap
  const overlapStart = pStart > monthStart ? pStart : monthStart;
  const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd;

  if (overlapStart > overlapEnd) return 0;

  // Count weekdays in the overlap
  const overlapWeekdays = businessDaysBetween(overlapStart, overlapEnd);

  // Count total weekdays across the entire PTO range
  const totalWeekdays = businessDaysBetween(pStart, pEnd);

  if (totalWeekdays === 0) return 0;

  // Pro-rate the billable days proportionally to weekdays in this month
  // (handles cases where holidays reduce billable days below business days)
  const ratio = overlapWeekdays / totalWeekdays;
  return Math.round(totalBillableDays * ratio * 100) / 100;
}

/**
 * For a given month (YYYY-MM), compute the overlap with [planned_start, planned_end]
 * and return the number of business days within that overlap.
 */
function plannedBusinessDaysInMonth(
  month: string,
  plannedStart: string,
  plannedEnd: string
): number {
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // last day of month

  const pStart = new Date(plannedStart + "T00:00:00");
  const pEnd = new Date(plannedEnd + "T00:00:00");

  // Find overlap
  const overlapStart = pStart > monthStart ? pStart : monthStart;
  const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd;

  if (overlapStart > overlapEnd) return 0;

  return businessDaysBetween(overlapStart, overlapEnd);
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission("dashboard", "read");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Clean up past-dated planned work before calculating
    await cleanupPlannedWork();

    const clientId = request.nextUrl.searchParams.get("clientId");
    const clientIdParam = clientId && clientId !== "null" && clientId !== "undefined" ? Number(clientId) : null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    // Current month actual revenue (day-level precision)
    const currentMonthStart = `${currentMonthStr}-01`;
    const currentMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const currentMonthEnd = `${currentMonthStr}-${String(currentMonthLastDay).padStart(2, "0")}`;

    // Current month revenue query
    // Params: $1=monthStart, $2=monthEnd, ($3=clientId if filtered)
    const clientRevenueFilter = clientId && clientId !== "null" && clientId !== "undefined"
      ? " AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = $3)"
      : "";
    const currentMonthRevenueParams: unknown[] = [currentMonthStart, currentMonthEnd];
    if (clientIdParam !== null) currentMonthRevenueParams.push(clientIdParam);

    const currentMonthRevenue = await queryOne<{ revenue: number }>(
      `SELECT COALESCE(SUM(${DAY_HOURS_FOR_MONTH_SQL} * COALESCE(pr.rate, 0)), 0) as revenue
       ${REVENUE_JOIN}
       WHERE t.category = 'Project' AND ${MONTH_OVERLAP_FILTER}${clientRevenueFilter}`,
      currentMonthRevenueParams
    );

    // ── Revenue FYTD (Financial Year To Date) ────────────────────────────
    // Epi-Use FY runs 1 March to 28/29 Feb
    // If current month >= March, FY started this year; otherwise FY started last year
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const todayDate = now.toISOString().slice(0, 10);

    // Sum actual revenue from fyStartDate to today across all months in the FY
    // We iterate month by month for day-level precision
    let revenueFYTD = 0;
    {
      const fyMonths: string[] = [];
      const d = new Date(fyStartYear, 2, 1); // March of FY start year
      while (true) {
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (mStr > currentMonthStr) break;
        fyMonths.push(mStr);
        d.setMonth(d.getMonth() + 1);
      }

      for (const month of fyMonths) {
        const [my, mm] = month.split("-").map(Number);
        const mStart = `${month}-01`;
        // For the current month, cap at today; for past months, use the last day of the month
        let mEnd: string;
        if (month === currentMonthStr) {
          mEnd = todayDate;
        } else {
          const mLastDay = new Date(my, mm, 0).getDate();
          mEnd = `${month}-${String(mLastDay).padStart(2, "0")}`;
        }
        // Params: $1=monthStart, $2=monthEnd, ($3=clientId if filtered)
        const fytdParams: unknown[] = [mStart, mEnd];
        if (clientIdParam !== null) fytdParams.push(clientIdParam);
        const row = await queryOne<{ revenue: number }>(
          `SELECT COALESCE(SUM(${DAY_HOURS_FOR_MONTH_SQL} * COALESCE(pr.rate, 0)), 0) as revenue
           ${REVENUE_JOIN}
           WHERE t.category = 'Project' AND ${MONTH_OVERLAP_FILTER}${clientRevenueFilter}`,
          fytdParams
        );
        revenueFYTD += row?.revenue ?? 0;
      }
      revenueFYTD = Math.round(revenueFYTD * 100) / 100;
    }

    // ── Determine month range ───────────────────────────────────────────────
    // Start: 12 months before current month
    // End: the later of current month OR the max planned_end from planned_work

    const months: string[] = [];

    // Historical months (12 months back including current month)
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }

    // Find the maximum planned_end date from the planned_work table
    // When clientId is provided, only consider planned work for this client's projects
    let maxPlannedEndRow: { max_end: string | null } | undefined;
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      maxPlannedEndRow = await queryOne<{ max_end: string | null }>(
        `SELECT MAX(pw.planned_end) as max_end FROM planned_work pw
         JOIN projects proj ON pw.task_number = proj.task_number
         WHERE proj.client_id = $1`,
        [clientIdParam]
      );
    } else {
      maxPlannedEndRow = await queryOne<{ max_end: string | null }>(
        "SELECT MAX(planned_end) as max_end FROM planned_work"
      );
    }

    if (maxPlannedEndRow?.max_end) {
      const maxEnd = maxPlannedEndRow.max_end;
      const [maxY, maxM] = maxEnd.split("-").map(Number);
      const maxEndMonth = `${maxY}-${String(maxM).padStart(2, "0")}`;

      // Add future months beyond current month up to max planned_end month
      const lastHistorical = months[months.length - 1];
      if (maxEndMonth > lastHistorical) {
        const [lhY, lhM] = lastHistorical.split("-").map(Number);
        let nextDate = new Date(lhY, lhM, 1); // month after last historical
        const maxDate = new Date(maxY, maxM - 1, 1); // target month

        while (nextDate <= maxDate) {
          months.push(
            `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
          );
          nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 1);
        }
      }
    }

    // Actual revenue per month (day-level precision)
    const actualByMonth = new Map<string, number>();
    for (const month of months) {
      const [my, mm] = month.split("-").map(Number);
      const mStart = `${month}-01`;
      const mLastDay = new Date(my, mm, 0).getDate();
      const mEnd = `${month}-${String(mLastDay).padStart(2, "0")}`;
      // Params: $1=monthStart, $2=monthEnd, ($3=clientId if filtered)
      const monthParams: unknown[] = [mStart, mEnd];
      if (clientIdParam !== null) monthParams.push(clientIdParam);
      const row = await queryOne<{ revenue: number }>(
        `SELECT COALESCE(SUM(${DAY_HOURS_FOR_MONTH_SQL} * COALESCE(pr.rate, 0)), 0) as revenue
         ${REVENUE_JOIN}
         WHERE t.category = 'Project' AND ${MONTH_OVERLAP_FILTER}${clientRevenueFilter}`,
        monthParams
      );
      actualByMonth.set(month, Math.round((row?.revenue ?? 0) * 100) / 100);
    }

    // ── Planned revenue per month ──────────────────────────────────────────
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const [fy, fm] = firstMonth.split("-").map(Number);
    const windowStart = `${fy}-${String(fm).padStart(2, "0")}-01`;
    const [ly, lm] = lastMonth.split("-").map(Number);
    const windowEnd = `${ly}-${String(lm).padStart(2, "0")}-31`;

    // When clientId is provided, only include planned work for this client's projects
    let plannedRows: PlannedWorkRow[];
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      plannedRows = await query<PlannedWorkRow>(
        `SELECT pw.person_id, pw.planned_start, pw.planned_end, pw.allocation_pct
         FROM planned_work pw
         JOIN projects proj ON pw.task_number = proj.task_number
         WHERE pw.planned_end >= $1 AND pw.planned_start <= $2
           AND proj.client_id = $3`,
        [windowStart, windowEnd, clientIdParam]
      );
    } else {
      plannedRows = await query<PlannedWorkRow>(
        `SELECT pw.person_id, pw.planned_start, pw.planned_end, pw.allocation_pct
         FROM planned_work pw
         WHERE pw.planned_end >= $1 AND pw.planned_start <= $2`,
        [windowStart, windowEnd]
      );
    }

    const plannedByMonth = new Map<string, number>();
    const ptoLossByMonth = new Map<string, number>();
    for (const m of months) {
      plannedByMonth.set(m, 0);
      ptoLossByMonth.set(m, 0);
    }

    for (const pw of plannedRows) {
      // Get rates for this person that overlap the window
      const rates = await query<RateRow>(
        `SELECT rate, fy_start, fy_end FROM people_rates
         WHERE person_id = $1 AND fy_end >= $2 AND fy_start <= $3
         ORDER BY fy_start DESC`,
        [pw.person_id, windowStart, windowEnd]
      );

      // Also fetch the latest rate as fallback for months beyond the FY window
      const latestRate = await queryOne<RateRow>(
        `SELECT rate, fy_start, fy_end FROM people_rates
         WHERE person_id = $1
         ORDER BY fy_end DESC
         LIMIT 1`,
        [pw.person_id]
      );

      for (const month of months) {
        const bizDays = plannedBusinessDaysInMonth(
          month,
          pw.planned_start,
          pw.planned_end
        );
        if (bizDays === 0) continue;

        // Find the applicable rate for the middle of this month
        const [my, mm] = month.split("-").map(Number);
        const midMonth = `${my}-${String(mm).padStart(2, "0")}-15`;
        let rate = 0;
        for (const r of rates) {
          if (midMonth >= r.fy_start && midMonth <= r.fy_end) {
            rate = r.rate;
            break;
          }
        }

        // If no rate found for this month, fall back to the person's latest rate
        if (rate === 0 && latestRate) {
          rate = latestRate.rate;
        }

        if (rate === 0) continue;

        const alloc = (pw.allocation_pct ?? 100) / 100;
        const plannedHours = bizDays * 8 * alloc;
        const plannedRevenue = plannedHours * rate;
        plannedByMonth.set(
          month,
          (plannedByMonth.get(month) || 0) + plannedRevenue
        );
      }
    }

    // ── Subtract PTO from planned revenue ──────────────────────────────
    // Query Personal and Sick PTO entries that overlap the chart window
    // and have a matched person_id (so we can look up their rate)
    const ptoRows = await query<PTORow>(
      `SELECT pto.person_id, pto.start_date, pto.end_date, pto.type,
              pto.billable_days, pto.business_days
       FROM personal_time_off pto
       WHERE pto.type IN ('Personal', 'Sick')
         AND pto.person_id IS NOT NULL
         AND pto.end_date >= $1 AND pto.start_date <= $2`,
      [windowStart, windowEnd]
    );

    for (const pto of ptoRows) {
      const billable = pto.billable_days ?? pto.business_days;
      if (billable <= 0) continue;

      // Get rates for this person
      const ptoRates = await query<RateRow>(
        `SELECT rate, fy_start, fy_end FROM people_rates
         WHERE person_id = $1 AND fy_end >= $2 AND fy_start <= $3
         ORDER BY fy_start DESC`,
        [pto.person_id, windowStart, windowEnd]
      );
      const ptoLatestRate = await queryOne<RateRow>(
        `SELECT rate, fy_start, fy_end FROM people_rates
         WHERE person_id = $1
         ORDER BY fy_end DESC
         LIMIT 1`,
        [pto.person_id]
      );

      for (const month of months) {
        const ptoDaysInMonth = ptoBillableDaysInMonth(
          month,
          pto.start_date,
          pto.end_date,
          billable
        );
        if (ptoDaysInMonth <= 0) continue;

        // Find the applicable rate for this person in this month
        const [my, mm] = month.split("-").map(Number);
        const midMonth = `${my}-${String(mm).padStart(2, "0")}-15`;
        let rate = 0;
        for (const r of ptoRates) {
          if (midMonth >= r.fy_start && midMonth <= r.fy_end) {
            rate = r.rate;
            break;
          }
        }
        if (rate === 0 && ptoLatestRate) {
          rate = ptoLatestRate.rate;
        }
        if (rate === 0) continue;

        const ptoRevenueLoss = ptoDaysInMonth * 8 * rate;
        // Track PTO loss for the new chart
        ptoLossByMonth.set(month, (ptoLossByMonth.get(month) || 0) + ptoRevenueLoss);
        // Deduct from planned revenue
        const current = plannedByMonth.get(month) || 0;
        plannedByMonth.set(month, Math.max(0, current - ptoRevenueLoss));
      }
    }

    // Build combined monthly data
    const monthlyRevenue: RevenueRow[] = months.map((month) => ({
      month,
      revenue: actualByMonth.get(month) || 0,
      plannedRevenue: Math.round((plannedByMonth.get(month) || 0) * 100) / 100,
    }));

    // Build PTO lost revenue per month
    const monthlyPTORevenueLoss = months.map((month) => ({
      month,
      lostRevenue: Math.round((ptoLossByMonth.get(month) || 0) * 100) / 100,
    }));

    // Current month planned revenue
    const currentPlannedRevenue = plannedByMonth.get(currentMonthStr) || 0;

    // Top 10 people who haven't booked timesheets for the current month
    // Missing timesheets: only check active people (day-level precision)
    // When clientId is provided, scope to people who have projects for this client
    //
    // Build the missing timesheets query with proper positional params.
    // Base params: $1=monthStart, $2=monthEnd
    // If clientId: $3=clientId
    const missingParams: unknown[] = [currentMonthStart, currentMonthEnd];

    let clientMissingPeopleFilter = "";
    let clientMissingTimesheetFilter = "";
    if (clientIdParam !== null) {
      missingParams.push(clientIdParam);
      const cidIdx = missingParams.length; // $3
      clientMissingPeopleFilter = `AND p.id IN (
           SELECT DISTINCT pw2.person_id FROM planned_work pw2
           JOIN projects proj2 ON pw2.task_number = proj2.task_number
           WHERE proj2.client_id = $${cidIdx}
           UNION
           SELECT DISTINCT p2.id FROM people p2
           JOIN timesheets t2 ON t2.user_name = p2.person
           JOIN projects proj2 ON t2.task_number = proj2.task_number
           WHERE proj2.client_id = $${cidIdx}
         )`;
      clientMissingTimesheetFilter = ` AND t.task_number IN (SELECT task_number FROM projects WHERE client_id = $${cidIdx})`;
    }

    const missingTimesheets = await query<MissingPerson>(
      `SELECT p.person, p.role, p.sow, p.photo
       FROM people p
       WHERE COALESCE(p.status, 'Active') = 'Active'
         ${clientMissingPeopleFilter}
         AND p.person NOT IN (
           SELECT DISTINCT t.user_name
           FROM timesheets t
           WHERE (t.week_starts_on::date + 6) >= $1::date
             AND t.week_starts_on::date <= $2::date
             AND t.category = 'Project'
             ${clientMissingTimesheetFilter}
             AND (
               CASE WHEN (t.week_starts_on::date + 0) BETWEEN $1::date AND $2::date THEN t.sunday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 1) BETWEEN $1::date AND $2::date THEN t.monday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 2) BETWEEN $1::date AND $2::date THEN t.tuesday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 3) BETWEEN $1::date AND $2::date THEN t.wednesday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 4) BETWEEN $1::date AND $2::date THEN t.thursday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 5) BETWEEN $1::date AND $2::date THEN t.friday ELSE 0 END +
               CASE WHEN (t.week_starts_on::date + 6) BETWEEN $1::date AND $2::date THEN t.saturday ELSE 0 END
             ) > 0
         )
       ORDER BY p.person ASC
       LIMIT 10`,
      missingParams
    );

    // ── Bench risk: people without sufficient planned work 2+ months out ────
    // The horizon date is 2 months from today
    const horizonDate = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
    const horizonStr = horizonDate.toISOString().slice(0, 10);

    // Get all active people (exclude Not Active from bench risk)
    // When clientId is provided, only include people who have projects for this client
    let allPeople: { person_id: number; person: string; role: string | null; sow: string | null; photo: string | null }[];
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      allPeople = await query<{ person_id: number; person: string; role: string | null; sow: string | null; photo: string | null }>(
        `SELECT p.id as person_id, p.person, p.role, p.sow, p.photo
         FROM people p
         WHERE COALESCE(p.status, 'Active') = 'Active'
         AND p.id IN (
           SELECT DISTINCT pw2.person_id FROM planned_work pw2
           JOIN projects proj2 ON pw2.task_number = proj2.task_number
           WHERE proj2.client_id = $1
           UNION
           SELECT DISTINCT p2.id FROM people p2
           JOIN timesheets t2 ON t2.user_name = p2.person
           JOIN projects proj2 ON t2.task_number = proj2.task_number
           WHERE proj2.client_id = $1
         )
         ORDER BY p.person ASC`,
        [clientIdParam]
      );
    } else {
      allPeople = await query<{ person_id: number; person: string; role: string | null; sow: string | null; photo: string | null }>(
        `SELECT p.id as person_id, p.person, p.role, p.sow, p.photo
         FROM people p
         WHERE COALESCE(p.status, 'Active') = 'Active'
         ORDER BY p.person ASC`
      );
    }

    // For each person, sum allocation_pct of planned work entries that extend beyond the horizon
    // When clientId is provided, only count planned work for this client's projects
    const benchRisk: BenchRiskPerson[] = [];
    for (const p of allPeople) {
      let allocRow: { total_alloc: number; latest_end: string | null } | undefined;
      if (clientId && clientId !== "null" && clientId !== "undefined") {
        allocRow = await queryOne<{ total_alloc: number; latest_end: string | null }>(
          `SELECT COALESCE(SUM(pw.allocation_pct), 0) as total_alloc,
                  MAX(pw.planned_end) as latest_end
           FROM planned_work pw
           WHERE pw.person_id = $1 AND pw.planned_end > $2
             AND pw.task_number IN (SELECT task_number FROM projects WHERE client_id = $3)`,
          [p.person_id, horizonStr, clientIdParam]
        );
      } else {
        allocRow = await queryOne<{ total_alloc: number; latest_end: string | null }>(
          `SELECT COALESCE(SUM(pw.allocation_pct), 0) as total_alloc,
                  MAX(pw.planned_end) as latest_end
           FROM planned_work pw
           WHERE pw.person_id = $1 AND pw.planned_end > $2`,
          [p.person_id, horizonStr]
        );
      }

      const totalAlloc = allocRow?.total_alloc ?? 0;
      if (totalAlloc < 50) {
        // Also get the absolute latest planned_end for each person (regardless of horizon)
        let plannedToRow: { planned_to: string | null } | undefined;
        if (clientId && clientId !== "null" && clientId !== "undefined") {
          plannedToRow = await queryOne<{ planned_to: string | null }>(
            `SELECT MAX(pw.planned_end) as planned_to
             FROM planned_work pw
             JOIN projects proj ON pw.task_number = proj.task_number
             WHERE pw.person_id = $1 AND proj.client_id = $2`,
            [p.person_id, clientIdParam]
          );
        } else {
          plannedToRow = await queryOne<{ planned_to: string | null }>(
            `SELECT MAX(pw.planned_end) as planned_to
             FROM planned_work pw
             WHERE pw.person_id = $1`,
            [p.person_id]
          );
        }
        benchRisk.push({
          person: p.person,
          person_id: p.person_id,
          photo: p.photo,
          role: p.role,
          sow: p.sow,
          total_allocation: totalAlloc,
          latest_planned_end: allocRow?.latest_end ?? null,
          planned_to: plannedToRow?.planned_to ?? null,
        });
      }
    }

    const totalPeopleRow = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM people"
    );
    const totalPeople = totalPeopleRow?.count ?? 0;

    const totalTimesheetsRow = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM timesheets"
    );
    const totalTimesheets = totalTimesheetsRow?.count ?? 0;

    // ── Project Budget Health ──────────────────────────────────────────────
    // For all projects with budget > 0, compute how much has been billed
    // (timesheet hours x person rate) and compare against budget.
    let budgetHealthRows: {
      id: number;
      task_number: string;
      task_description: string | null;
      budget: number;
      billed: number;
    }[];
    if (clientId && clientId !== "null" && clientId !== "undefined") {
      budgetHealthRows = await query<{
        id: number;
        task_number: string;
        task_description: string | null;
        budget: number;
        billed: number;
      }>(
        `SELECT
           proj.id,
           proj.task_number,
           proj.task_description,
           proj.budget,
           COALESCE(SUM(t.total * COALESCE(pr.rate, 0)), 0) as billed
         FROM projects proj
         LEFT JOIN timesheets t ON t.task_number = proj.task_number
         LEFT JOIN people p ON t.user_name = p.person
         LEFT JOIN people_rates pr ON pr.person_id = p.id
           AND t.week_starts_on >= pr.fy_start
           AND t.week_starts_on <= pr.fy_end
         WHERE proj.budget IS NOT NULL AND proj.budget > 0
           AND COALESCE(proj.status, 'Started') = 'Started'
           AND proj.client_id = $1
         GROUP BY proj.id, proj.task_number, proj.task_description, proj.budget
         ORDER BY proj.task_description ASC`,
        [clientIdParam]
      );
    } else {
      budgetHealthRows = await query<{
        id: number;
        task_number: string;
        task_description: string | null;
        budget: number;
        billed: number;
      }>(
        `SELECT
           proj.id,
           proj.task_number,
           proj.task_description,
           proj.budget,
           COALESCE(SUM(t.total * COALESCE(pr.rate, 0)), 0) as billed
         FROM projects proj
         LEFT JOIN timesheets t ON t.task_number = proj.task_number
         LEFT JOIN people p ON t.user_name = p.person
         LEFT JOIN people_rates pr ON pr.person_id = p.id
           AND t.week_starts_on >= pr.fy_start
           AND t.week_starts_on <= pr.fy_end
         WHERE proj.budget IS NOT NULL AND proj.budget > 0
           AND COALESCE(proj.status, 'Started') = 'Started'
         GROUP BY proj.id, proj.task_number, proj.task_description, proj.budget
         ORDER BY proj.task_description ASC`
      );
    }

    const projectBudgetHealth = budgetHealthRows.map((row) => {
      const remaining = row.budget - row.billed;
      const usedPct = row.budget > 0 ? Math.round((row.billed / row.budget) * 1000) / 10 : 0;
      let status: "healthy" | "warning" | "critical" | "over";
      if (usedPct > 100) status = "over";
      else if (usedPct >= 90) status = "critical";
      else if (usedPct >= 75) status = "warning";
      else status = "healthy";
      return {
        id: row.id,
        taskNumber: row.task_number,
        projectName: row.task_description || row.task_number,
        budget: Math.round(row.budget * 100) / 100,
        billed: Math.round(row.billed * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        usedPct,
        status,
      };
    });

    // ── Upcoming PTO: next 2 weeks from today (UNFILTERED - people-based) ──
    const todayStr = now.toISOString().slice(0, 10);
    const twoWeeksOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const twoWeeksStr = twoWeeksOut.toISOString().slice(0, 10);

    const upcomingPTO = await query<{
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
    }>(
      `SELECT pto.id, pto.person_name, pto.kerb, pto.start_date, pto.end_date,
              pto.type, pto.business_days, pto.billable_days, p.person as matched_person, p.photo
       FROM personal_time_off pto
       LEFT JOIN people p ON pto.person_id = p.id
       WHERE pto.end_date >= $1 AND pto.start_date <= $2
       ORDER BY pto.start_date ASC, pto.person_name ASC`,
      [todayStr, twoWeeksStr]
    );

    // ── Birthday Reminders: all birthdays this month (UNFILTERED) ─────────
    const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowMMDD = `${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
    const birthdayMonthPrefix = `${String(now.getMonth() + 1).padStart(2, "0")}-%`;

    const birthdayRows = await query<{
      id: number;
      person: string;
      photo: string | null;
      birthday: string;
    }>(
      `SELECT p.id, p.person, p.photo, p.birthday
       FROM people p
       WHERE COALESCE(p.status, 'Active') = 'Active'
         AND p.birthday LIKE $1
       ORDER BY p.birthday ASC, p.person ASC`,
      [birthdayMonthPrefix]
    );

    const birthdays = birthdayRows.map((row) => ({
      ...row,
      when: row.birthday === todayMMDD
        ? "today" as const
        : row.birthday === tomorrowMMDD
          ? "tomorrow" as const
          : "this_month" as const,
    }));

    // ── Work Anniversaries: people whose anniversary month is this month (UNFILTERED) ──
    const currentMonthPadded = String(now.getMonth() + 1).padStart(2, "0");
    const anniversaryRows = await query<{
      id: number;
      person: string;
      photo: string | null;
      work_anniversary: string;
    }>(
      `SELECT p.id, p.person, p.photo, p.work_anniversary
       FROM people p
       WHERE COALESCE(p.status, 'Active') = 'Active'
         AND p.work_anniversary IS NOT NULL
         AND p.work_anniversary != ''
         AND substr(p.work_anniversary, 6, 2) = $1
       ORDER BY substr(p.work_anniversary, 9, 2) ASC, p.person ASC`,
      [currentMonthPadded]
    );

    const workAnniversaries = anniversaryRows
      .map((row) => {
        const startYear = parseInt(row.work_anniversary.slice(0, 4));
        const years = currentYear - startYear;
        return { id: row.id, person: row.person, photo: row.photo, years };
      })
      .filter((row) => row.years > 0);

    // ── Timesheet Health: avg completion % for active people this month ──
    // Count weekdays (Mon-Fri) from month start up to today
    let totalWeekdays = 0;
    {
      const d = new Date(currentYear, currentMonth - 1, 1);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (d <= todayEnd) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) totalWeekdays++;
        d.setDate(d.getDate() + 1);
      }
    }

    let timesheetHealthPct = 0;
    if (totalWeekdays > 0) {
      // For each active person, count distinct weekdays with >0 hours
      // A weekday is "covered" if ANY timesheet row has >0 hours on that day
      // We use the day-level date calculation: week_starts_on::date + N
      // Sunday=+0, Monday=+1, ..., Friday=+5
      // Params: $1=currentMonthStart, $2=todayStr (used 5 times each in the UNIONs)
      const perPersonDays = await query<{ person: string; days_submitted: number }>(
        `SELECT p.person,
          COUNT(DISTINCT submitted_date) as days_submitted
         FROM people p
         LEFT JOIN (
           SELECT t.user_name, (t.week_starts_on::date + 1)::text as submitted_date
             FROM timesheets t
             WHERE (t.week_starts_on::date + 1) BETWEEN $1::date AND $2::date
               AND t.monday > 0
           UNION
           SELECT t.user_name, (t.week_starts_on::date + 2)::text
             FROM timesheets t
             WHERE (t.week_starts_on::date + 2) BETWEEN $1::date AND $2::date
               AND t.tuesday > 0
           UNION
           SELECT t.user_name, (t.week_starts_on::date + 3)::text
             FROM timesheets t
             WHERE (t.week_starts_on::date + 3) BETWEEN $1::date AND $2::date
               AND t.wednesday > 0
           UNION
           SELECT t.user_name, (t.week_starts_on::date + 4)::text
             FROM timesheets t
             WHERE (t.week_starts_on::date + 4) BETWEEN $1::date AND $2::date
               AND t.thursday > 0
           UNION
           SELECT t.user_name, (t.week_starts_on::date + 5)::text
             FROM timesheets t
             WHERE (t.week_starts_on::date + 5) BETWEEN $1::date AND $2::date
               AND t.friday > 0
         ) sub ON sub.user_name = p.person
         WHERE COALESCE(p.status, 'Active') = 'Active'
         GROUP BY p.person`,
        [currentMonthStart, todayStr]
      );

      if (perPersonDays.length > 0) {
        const totalPct = perPersonDays.reduce((sum, row) => {
          return sum + (row.days_submitted / totalWeekdays) * 100;
        }, 0);
        timesheetHealthPct = Math.round((totalPct / perPersonDays.length) * 10) / 10;
      }
    }

    return NextResponse.json({
      currentMonthRevenue:
        Math.round((currentMonthRevenue?.revenue ?? 0) * 100) / 100,
      currentPlannedRevenue:
        Math.round(currentPlannedRevenue * 100) / 100,
      currentMonth: currentMonthStr,
      revenueFYTD,
      fyLabel: `FY${fyStartYear}/${String(fyStartYear + 1).slice(-2)}`,
      monthlyRevenue,
      monthlyPTORevenueLoss,
      missingTimesheets,
      benchRisk,
      benchRiskHorizon: horizonStr,
      totalPeople,
      totalTimesheets,
      upcomingPTO,
      projectBudgetHealth,
      birthdays,
      workAnniversaries,
      timesheetHealthPct,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
