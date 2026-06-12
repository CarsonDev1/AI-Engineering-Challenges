// Counts forward `days` business days from dateISO (YYYY-MM-DD), skipping Sat/Sun.
// If dateISO itself is a weekend, counting begins on the following Monday.
// All math in UTC to avoid timezone drift.
export function addBusinessDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}
