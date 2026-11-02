// Local database (IndexedDB through Dexie). Works offline; nothing leaves this computer.
import Dexie from 'dexie';
import { tr } from './i18n.js';
import { parseDate, addDays, ymd, mondayOf } from './dates.js';

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
// v3: weekly sprints (sprint-2026-10-26). Existing tickets are moved into the sprint of their date,
// planned on their own weekday, and old repeat series become chains so they can still be deleted together.
db.version(3)
  .stores({
    categories: '++id, &key, name',
    tickets: '++id, categoryId, date, status, kind, seriesId, sprint, chainId',
    plans: '++id, date',
  })
  .upgrade((tx) => tx.table('tickets').toCollection().modify((t) => {
    const d = parseDate(t.date);
    const i = (d.getDay() + 6) % 7;
    t.sprint = `sprint-${ymd(addDays(d, -i))}`;
    t.days = [false, false, false, false, false, false, false];
    t.days[i] = true;
    t.daysDone = [false, false, false, false, false, false, false];
    if (t.kind !== 'meeting' && t.status === 'done') t.daysDone[i] = true;
    t.carry = false;
    t.carriedTo = null;
    t.chainId = t.seriesId || `c${t.id}`;
  }));

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

/* ---------- sprints ---------- */

// A sprint is one week, Monday to Sunday, named after its Monday: sprint-2026-10-26.
// days / daysDone are 7 booleans in Monday-first order (index 0 = Monday ... 6 = Sunday).
export const sprintKey = (monday) => `sprint-${ymd(monday)}`;
export const sprintMonday = (key) => parseDate(key.slice(7));
export const sprintOf = (dateStr) => sprintKey(mondayOf(parseDate(dateStr)));
export const dayIndexOf = (dateStr) => (parseDate(dateStr).getDay() + 6) % 7;
export const sprintEnd = (key) => ymd(addDays(sprintMonday(key), 6));
const noDays = () => [false, false, false, false, false, false, false];

/* ---------- tickets ---------- */

export function validateTicket(form) {
  if (!form.title.trim()) return tr('제목을 입력해 주세요.');
  if (!form.categoryId) return tr('카테고리를 골라 주세요. 없으면 카테고리를 먼저 만들어 주세요.');
  if (form.kind === 'meeting') {
    if (!form.date) return tr('미팅 날짜를 골라 주세요.');
    if (!form.allDay && (!form.start || !form.end || form.end <= form.start)) return tr('끝나는 시간이 시작 시간보다 늦어야 해요.');
  } else if (form.hasDeadline && !form.deadline) {
    return tr('데드라인 날짜를 골라 주세요.');
  }
  return '';
}

// One ticket in one sprint. Numbers per category keep counting up (MAP-00001, MAP-00002 ...).
export async function createTicket(form) {
  const meeting = form.kind === 'meeting';
  return db.transaction('rw', db.categories, db.tickets, async () => {
    const cat = await db.categories.get(form.categoryId);
    const n = (cat.lastNumber || 0) + 1;
    let sprint;
    let days;
    let date;
    if (meeting) {
      date = form.date;
      sprint = sprintOf(date);
      days = noDays();
      days[dayIndexOf(date)] = true;
    } else {
      sprint = form.sprint;
      days = form.days.slice();
      const first = days.findIndex(Boolean);
      date = ymd(addDays(sprintMonday(sprint), first === -1 ? 0 : first));
    }
    await db.tickets.add({
      kind: form.kind,
      categoryId: form.categoryId,
      number: n,
      title: form.title.trim(),
      desc: form.desc.trim(),
      checklist: (form.checklist || []).map((x) => x.trim()).filter(Boolean).map((text) => ({ text, done: false })),
      sprint,
      date,
      days,
      daysDone: noDays(),
      start: meeting && !form.allDay ? form.start : '',
      end: meeting && !form.allDay ? form.end : '',
      allDay: meeting && form.allDay,
      // empty deadline = end of the sprint (Sunday)
      deadline: !meeting && form.hasDeadline ? form.deadline : '',
      deadlineTime: !meeting && form.hasDeadline ? form.deadlineTime : '',
      priority: form.priority,
      status: 'todo',
      carry: !!form.carry,
      carriedTo: null,
      chainId: `c${Date.now()}`,
      createdAt: Date.now(),
    });
    await db.categories.update(cat.id, { lastNumber: n });
  });
}

// Copies tickets marked "continue into the next sprint" forward, sprint by sprint, up to targetKey.
export async function rollForward(targetKey) {
  await db.transaction('rw', db.categories, db.tickets, async () => {
    for (let guard = 0; guard < 120; guard++) {
      const open = await db.tickets.filter((t) => t.carry && !t.carriedTo && t.sprint < targetKey).toArray();
      if (!open.length) return;
      for (const t of open) {
        const cat = await db.categories.get(t.categoryId);
        if (!cat) { await db.tickets.update(t.id, { carry: false }); continue; }
        const n = (cat.lastNumber || 0) + 1;
        await db.categories.update(cat.id, { lastNumber: n });
        const nextKey = sprintKey(addDays(sprintMonday(t.sprint), 7));
        const copy = {
          ...t,
          number: n,
          sprint: nextKey,
          date: ymd(addDays(parseDate(t.date), 7)),
          deadline: t.deadline ? ymd(addDays(parseDate(t.deadline), 7)) : '',
          status: 'todo',
          daysDone: noDays(),
          checklist: (t.checklist || []).map((c) => ({ ...c, done: false })),
          carriedTo: null,
          createdAt: Date.now(),
        };
        delete copy.id;
        await db.tickets.add(copy);
        await db.tickets.update(t.id, { carriedTo: nextKey });
      }
    }
  });
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

// Tick a weekday as done (only for days the ticket is planned on)
export async function toggleDayDone(ticket, i) {
  const daysDone = (ticket.daysDone || noDays()).slice();
  daysDone[i] = !daysDone[i];
  await db.tickets.update(ticket.id, { daysDone });
}

// Plan or unplan a weekday
export async function toggleDay(ticket, i) {
  const days = (ticket.days || noDays()).slice();
  const daysDone = (ticket.daysDone || noDays()).slice();
  days[i] = !days[i];
  if (!days[i]) daysDone[i] = false;
  await db.tickets.update(ticket.id, { days, daysDone });
}

// Drop on a weekday column: a meeting moves there; a task gets that day added (or moved, if it had one day or none)
export async function moveToDay(ticket, i) {
  const date = ymd(addDays(sprintMonday(ticket.sprint), i));
  if (ticket.kind === 'meeting') {
    const days = noDays();
    days[i] = true;
    await db.tickets.update(ticket.id, { date, days, daysDone: noDays() });
    return;
  }
  const planned = (ticket.days || noDays()).filter(Boolean).length;
  const days = planned <= 1 ? noDays() : ticket.days.slice();
  days[i] = true;
  const daysDone = planned <= 1 ? noDays() : (ticket.daysDone || noDays()).slice();
  await db.tickets.update(ticket.id, { days, daysDone, date: ymd(addDays(sprintMonday(ticket.sprint), days.findIndex(Boolean))) });
}

export async function deleteTicket(id) {
  await db.tickets.delete(id);
}

// Every ticket from the same chain (carried copies, or an old repeat series)
export async function deleteSeries(chainId) {
  await db.tickets.where('chainId').equals(chainId).delete();
}

/* ---------- 오늘의 플랜 ---------- */

export async function addPlan(date, text, time) {
  text = (text || '').trim();
  if (!text) return;
  const now = Date.now();
  await db.plans.add({ date, text, time: time || '', done: false, createdAt: now, order: now });
}

export async function updatePlan(id, changes) {
  await db.plans.update(id, changes);
}

export async function deletePlan(id) {
  await db.plans.delete(id);
}

// Save a new order after dragging: ids in the order they should appear
export async function reorderPlans(ids) {
  await db.transaction('rw', db.plans, async () => {
    for (let i = 0; i < ids.length; i++) await db.plans.update(ids[i], { order: i });
  });
}

export async function clearPlans(date) {
  await db.plans.where('date').equals(date).delete();
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
