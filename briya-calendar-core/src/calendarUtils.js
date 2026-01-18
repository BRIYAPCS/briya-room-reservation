// calendarUtils.js
// ------------------------------------------------------------
// PURE DATE HELPERS
// ------------------------------------------------------------

export function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function rangeTouchesWeekend(start, end) {
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cur <= last) {
    if (isWeekend(cur)) return true;
    cur.setDate(cur.getDate() + 1);
  }

  return false;
}
