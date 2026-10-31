// Local database (IndexedDB through Dexie). Works offline; nothing leaves this computer.
import Dexie from 'dexie';
import { tr } from './i18n.js';
import { parseDate, addDays, ymd } from './dates.js';

export const db = new Dexie('planner');

// Bump the version number and add a new .stores() block if the shape ever changes.
db.version(1).stores({
  // key is unique, e.g. MAP, WRK
  categories: '++id, &key, name',
  // date = the day the ticket sits on the board
  tickets: '++id, categoryId, date, status, kind, seriesId',
});
// v2 adds 오늘의 플랜 (simple daily checklist). Existing categories and tickets are kept as they are.
db.version(2).stores({
  categories: '++id, &key, name',
  tickets: '++id, categoryId, date, status, kind, seriesId',
  plans: '++id, date',
});

export const PALETTE = [
  { name: '파랑', color: '#7DB2FF', soft: '#1E3358' },
  { name: '보라', color: '#B9A6FF', soft: '#2F2650' },
  { name: '초록', color: '#62D49C', soft: '#163628' },
  { name: '주황', color: '#F5AE5E', soft: '#3B2913' },
  { name: '분홍', color: '#F48FC0', soft: '#3D1F31' },
  { name: '청록', color: '#5FD3D0', soft: '#14373A' },
];

export const code = (key, n) => `${key}-${String(n).padStart(5, '0')}`;

/* ---------- categories ---------- */

export function cleanKey(raw) {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export async function saveCategory({ id, name, key, colorIndex }) {
  name = (name || '').trim();
  key = cleanKey(key);
  if (!name) throw new Error(tr('이름을 입력해 주세요.'));
  if (!/^[A-Z0-9]{2,6}$/.test(key)) throw new Error(tr('키는 영문이나 숫자 2~6자로 넣어 주세요.'));
  const same = await db.categories.where('key').equals(key).first();
  if (same && same.id !== id) throw new Error(tr('이미 다른 카테고리가 쓰고 있는 키예요.'));
  const data = { name, key, colorIndex: colorIndex ?? 0 };
  if (id) await db.categories.update(id, data);
  else await db.categories.add({ ...data, lastNumber: 0 });
}

export async function deleteCategory(id) {
  await db.transaction('rw', db.categories, db.tickets, async () => {
    await db.tickets.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
}

/* ---------- tickets ---------- */

// Every date a form would create a ticket on
export function datesFor(form) {
  if (form.repeat === 'once') return form.date ? [form.date] : [];
  if (!form.from || !form.to || form.to < form.from) return [];
  const out = [];
  let d = parseDate(form.from);
  const end = parseDate(form.to);
  while (d <= end && out.length < 1000) {
    if (form.repeat === 'daily' || (form.repeat === 'weekly' && form.days[d.getDay()])) out.push(ymd(d));
    d = addDays(d, 1);
  }
  return out;
}

export function validateTicket(form) {
  if (!form.title.trim()) return tr('제목을 입력해 주세요.');
  if (!form.categoryId) return tr('카테고리를 골라 주세요. 없으면 카테고리를 먼저 만들어 주세요.');
  if (form.repeat !== 'once') {
    if (!form.from || !form.to) return tr('기간의 시작 날짜와 끝 날짜를 넣어 주세요.');
    if (form.to < form.from) return tr('기간의 끝 날짜가 시작 날짜보다 빨라요.');
    if (form.repeat === 'weekly' && !form.days.some(Boolean)) return tr('반복할 요일을 하나 이상 골라 주세요.');
  }
  if (form.kind === 'meeting' && !form.allDay && (!form.start || !form.end || form.end <= form.start)) {
    return tr('끝나는 시간이 시작 시간보다 늦어야 해요.');
  }
  if (form.kind === 'task' && form.hasDeadline && !form.deadline) return tr('데드라인 날짜를 골라 주세요.');
  if (!datesFor(form).length) return tr('만들어질 날짜가 없어요. 기간이나 요일을 확인해 주세요.');
  return '';
}

// Creates one ticket per date. Numbers per category keep counting up (MAP-00001, MAP-00002 ...).
export async function createTickets(form) {
  const dates = datesFor(form);
  const meeting = form.kind === 'meeting';
  return db.transaction('rw', db.categories, db.tickets, async () => {
    const cat = await db.categories.get(form.categoryId);
    let n = cat.lastNumber || 0;
    const seriesId = dates.length > 1 ? `s${Date.now()}` : null;
    const rows = dates.map((date, i) => ({
      kind: form.kind,
      categoryId: form.categoryId,
      number: ++n,
      title: form.title.trim(),
      desc: form.desc.trim(),
      // each repeated ticket gets its own copy, so checking one day doesn't check the others
      checklist: (form.checklist || [])
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text, done: false })),
      date,
      start: meeting && !form.allDay ? form.start : '',
      end: meeting && !form.allDay ? form.end : '',
      allDay: meeting && form.allDay,
      deadline: !meeting && form.hasDeadline ? form.deadline : '',
      deadlineTime: !meeting && form.hasDeadline ? form.deadlineTime : '',
      priority: form.priority,
      status: 'todo',
      seriesId,
      seriesIndex: i + 1,
      seriesTotal: dates.length,
      createdAt: Date.now(),
    }));
    await db.tickets.bulkAdd(rows);
    await db.categories.update(cat.id, { lastNumber: n });
    return rows.length;
  });
}

const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };

export async function cycleStatus(ticket) {
  await db.tickets.update(ticket.id, { status: NEXT[ticket.status] });
}

export async function setStatus(id, status) {
  await db.tickets.update(id, { status });
}

export async function updateTicket(id, changes) {
  await db.tickets.update(id, changes);
}

export async function toggleCheck(ticket, index) {
  const checklist = (ticket.checklist || []).map((item, i) => (i === index ? { ...item, done: !item.done } : item));
  await db.tickets.update(ticket.id, { checklist });
}

export async function deleteTicket(id) {
  await db.tickets.delete(id);
}

export async function deleteSeries(seriesId) {
  await db.tickets.where('seriesId').equals(seriesId).delete();
}

/* ---------- 오늘의 플랜 ---------- */

export async function addPlan(date, text, time) {
  text = (text || '').trim();
  if (!text) return;
  await db.plans.add({ date, text, time: time || '', done: false, createdAt: Date.now() });
}

export async function updatePlan(id, changes) {
  await db.plans.update(id, changes);
}

export async function deletePlan(id) {
  await db.plans.delete(id);
}

/* ---------- backup ---------- */

export async function exportAll() {
  const data = {
    app: 'planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    tickets: await db.tickets.toArray(),
    plans: await db.plans.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `planner-backup-${ymd(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Replaces everything with the backup file's contents.
export async function importAll(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'planner' || !Array.isArray(data.categories) || !Array.isArray(data.tickets)) {
    throw new Error(tr('플래너 백업 파일이 아니에요.'));
  }
  const plans = Array.isArray(data.plans) ? data.plans : [];
  await db.transaction('rw', db.categories, db.tickets, db.plans, async () => {
    await db.tickets.clear();
    await db.categories.clear();
    await db.plans.clear();
    await db.categories.bulkAdd(data.categories);
    await db.tickets.bulkAdd(data.tickets);
    await db.plans.bulkAdd(plans);
  });
  return { categories: data.categories.length, tickets: data.tickets.length, plans: plans.length };
}
