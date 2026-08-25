function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS_SUN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_LABELS_MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getMonthDays(year, month, startMonday) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const offset = startMonday ? (startDow === 0 ? 6 : startDow - 1) : startDow;
  const cells = [];
  for (let i = 0; i < offset; i++) {
    const d = new Date(year, month, 1 - (offset - i));
    cells.push({ date: d, thisMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push({ date: new Date(year, month, d), thisMonth: true });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length-1].date;
    const next = new Date(last); next.setDate(last.getDate()+1);
    cells.push({ date: next, thisMonth: false });
  }
  return cells;
}


export { dateKey, MONTH_NAMES, DAY_LABELS_SUN, DAY_LABELS_MON, getMonthDays };
