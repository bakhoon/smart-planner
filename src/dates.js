// Small date helpers. Dates are stored as 'YYYY-MM-DD' strings, times as 'HH:MM'.
// Display text follows the chosen language (see i18n.js).
import { getLang } from './i18n.js';

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(i) {
  return getLang() === 'en' ? EN_DAYS[i] : KO_DAYS[i];
}

export function weekdayLong(i) {
  return getLang() === 'en' ? EN_DAYS_LONG[i] : KO_DAYS[i] + '요일';
}

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

// 11/6 (금)  ·  Fri 11/6
export function fmtDay(s) {
  if (!s) return '';
  const d = parseDate(s);
  if (getLang() === 'en') return `${EN_DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()} (${KO_DAYS[d.getDay()]})`;
}

// 11월 6일 (금)  ·  Friday, Nov 6
export function fmtLong(s) {
  const d = parseDate(s);
  if (getLang() === 'en') return `${EN_DAYS_LONG[d.getDay()]}, ${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${KO_DAYS[d.getDay()]})`;
}

// 오후 2:00  ·  2:00 PM
export function fmtTime(s) {
  if (!s) return '';
  const [h, m] = s.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m < 10 ? '0' + m : m;
  if (getLang() === 'en') return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  return `${h < 12 ? '오전' : '오후'} ${h12}:${mm}`;
}

// 10월 5주차  ·  Oct, week 5
export function weekTitle(monday) {
  const first = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const n = Math.ceil((monday.getDate() + ((first.getDay() + 6) % 7)) / 7);
  if (getLang() === 'en') return `${EN_MONTHS[monday.getMonth()]}, week ${n}`;
  return `${monday.getMonth() + 1}월 ${n}주차`;
}
