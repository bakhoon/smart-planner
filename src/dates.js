// Small date helpers. Dates are stored as 'YYYY-MM-DD' strings, times as 'HH:MM'.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// Monday of the week that contains d
export function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function fmtDay(s) {
  if (!s) return '';
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

export function fmtTime(s) {
  if (!s) return '';
  const [h, m] = s.split(':').map(Number);
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${m < 10 ? '0' + m : m}`;
}

export function weekTitle(monday) {
  const first = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const n = Math.ceil((monday.getDate() + ((first.getDay() + 6) % 7)) / 7);
  return `${monday.getMonth() + 1}월 ${n}주차`;
}
