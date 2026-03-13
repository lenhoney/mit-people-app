/**
 * Shared SQL fragments for PostgreSQL date arithmetic.
 * Used by dashboard and report routes.
 */

/**
 * Day-level hours for a date range: counts hours for each day of the week
 * whose actual date falls within the range.
 * PostgreSQL: week_starts_on::date + N gives the Nth day of the week.
 */
export function dayHoursForRange(startParam: string, endParam: string): string {
  return `(
    CASE WHEN (t.week_starts_on::date + 0) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.sunday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 1) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.monday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 2) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.tuesday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 3) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.wednesday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 4) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.thursday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 5) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.friday ELSE 0 END +
    CASE WHEN (t.week_starts_on::date + 6) BETWEEN ${startParam}::date AND ${endParam}::date THEN t.saturday ELSE 0 END
  )`;
}

/**
 * Week overlap filter: returns true if any day of the timesheet week
 * falls within the given date range.
 */
export function weekOverlapFilter(startParam: string, endParam: string): string {
  return `(t.week_starts_on::date + 6) >= ${startParam}::date AND t.week_starts_on::date <= ${endParam}::date`;
}

/**
 * Convert named parameter SQL (@param) to PostgreSQL positional params ($N).
 * Returns the converted SQL text and the ordered values array.
 */
export function namedToPositional(
  sql: string,
  params: Record<string, unknown>
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const paramMap = new Map<string, number>();

  const text = sql.replace(/@(\w+)/g, (_, name) => {
    if (!paramMap.has(name)) {
      values.push(params[name]);
      paramMap.set(name, values.length);
    }
    return `$${paramMap.get(name)}`;
  });

  return { text, values };
}
