import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PALETTE, code, toggleCheck, setStatus, updateTicket, exportAll, importAll } from './db.js';
import { addDays, fmtDay, fmtLong, fmtTime, mondayOf, today, weekTitle, weekdayLong, weekdayName, ymd } from './dates.js';
import { tr, getLang, setLang } from './i18n.js';
import TicketModal from './TicketModal.jsx';
import CategoryModal from './CategoryModal.jsx';
import MeetingCalendar from './MeetingCalendar.jsx';
import TicketDetail, { STATUS } from './TicketDetail.jsx';
import TodayPlan from './TodayPlan.jsx';
import * as I from './icons.jsx';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function App() {
  const [monday, setMonday] = useState(() => mondayOf(today()));
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('date');
  const [ticketModal, setTicketModal] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const switchLang = (l) => { setLang(l); setLangState(l); };
  const [dropKey, setDropKey] = useState(null);

  // drag & drop: a card carries its ticket id; a day column changes the date, a status column changes the status
  const dropProps = (key, apply) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropKey !== key) setDropKey(key); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null); },
    onDrop: (e) => {
      e.preventDefault();
      setDropKey(null);
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (id) apply(id);
    },
  });
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  const from = ymd(monday);
  const to = ymd(addDays(monday, 6));
  const todayKey = ymd(today());

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const weekTickets = useLiveQuery(
    () => db.tickets.where('date').between(from, to, true, true).toArray(),
    [from, to],
    []
  );
  const allCount = useLiveQuery(() => db.tickets.count(), [], 0);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const visible = weekTickets
    .filter((t) => filter === 'all' || t.categoryId === filter)
    .filter((t) => catById[t.categoryId])
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));

  const done = weekTickets.filter((t) => t.status === 'done').length;
  const pct = weekTickets.length ? Math.round((done / weekTickets.length) * 100) : 0;

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  async function onImport(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm(tr('백업 파일로 지금 데이터를 전부 바꿀까요? 지금 있는 데이터는 사라져요.'))) return;
    try {
      const r = await importAll(file);
      setToast(tr('가져왔어요: 카테고리 {c}개, 티켓 {n}개', { c: r.categories, n: r.tickets }));
    } catch (err) {
      setToast(err.message || tr('가져오기에 실패했어요.'));
    }
  }

  const openCreate = (date) => {
    const t = today();
    const inWeek = todayKey >= from && todayKey <= to;
    setTicketModal({ date: date || (inWeek ? ymd(t) : from) });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><I.Board /></span>
          <span>{tr('플래너')}</span>
        </div>
        <button className="btn primary" onClick={() => openCreate()}>
          <I.Plus /> {tr('만들기')}
        </button>
        <div className="segmented lang" role="group" aria-label="Language / 언어">
          <button aria-pressed={lang === 'ko'} onClick={() => switchLang('ko')}>한국어</button>
          <button aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>English</button>
        </div>
        <span className="topbar-note">{tr('이 컴퓨터에만 저장돼요 · 인터넷 없이 동작해요')}</span>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="weeknav">
            <button className="icon-btn" aria-label={tr('이전 주')} onClick={() => setMonday(addDays(monday, -7))}><I.ChevronLeft /></button>
            <span className="weeknav-label">
              <strong>{weekTitle(monday)}</strong>
              <small>{monday.getMonth() + 1}.{monday.getDate()} ~ {addDays(monday, 6).getMonth() + 1}.{addDays(monday, 6).getDate()}</small>
            </span>
            <button className="icon-btn" aria-label={tr('다음 주')} onClick={() => setMonday(addDays(monday, 7))}><I.ChevronRight /></button>
          </div>
          <button className="btn ghost small" onClick={() => setMonday(mondayOf(today()))}>{tr('이번 주로')}</button>

          <nav className="side-section" aria-label={tr('보기')}>
            <div className="side-head"><span>{tr('보기')}</span></div>
            <NavRow icon={<I.Board />} label={tr('보드')} active={view === 'date' || view === 'status'} onClick={() => setView(view === 'status' ? 'status' : 'date')} />
            <NavRow icon={<I.Calendar />} label={tr('캘린더')} active={view === 'meeting'} onClick={() => setView('meeting')} />
            <NavRow icon={<I.Check />} label={tr('오늘의 플랜')} active={view === 'today'} onClick={() => setView('today')} />
          </nav>

          <section className="side-section">
            <div className="side-head">
              <span>{tr('카테고리')}</span>
              <button className="icon-btn small" aria-label={tr('카테고리 설정')} onClick={() => setCatOpen(true)}><I.Sliders /></button>
            </div>
            <CatRow active={filter === 'all'} label={tr('전체')} short={tr('전')} color="#E6E8EB" soft="#353A43"
              count={weekTickets.length} onClick={() => setFilter('all')} />
            {categories.map((c) => {
              const p = PALETTE[c.colorIndex] || PALETTE[0];
              return (
                <CatRow key={c.id} active={filter === c.id} label={c.name} short={c.key.slice(0, 2)}
                  color={p.color} soft={p.soft}
                  count={weekTickets.filter((t) => t.categoryId === c.id).length}
                  onClick={() => setFilter(c.id)} />
              );
            })}
            {categories.length === 0 && (
              <div className="empty-box">
                <p>{tr('아직 카테고리가 없어요. 일, 교회, 집처럼 나눌 카테고리를 만들어 보세요.')}</p>
                <button className="btn outline small" onClick={() => setCatOpen(true)}>{tr('카테고리 만들기')}</button>
              </div>
            )}
          </section>

          <section className="progress">
            <div className="row-between"><strong>{tr('이번 주 진행률')}</strong><span>{pct}%</span></div>
            <div className="bar"><div style={{ width: pct + '%' }} /></div>
            <small>{weekTickets.length ? tr('{n}개 중 {d}개 완료', { n: weekTickets.length, d: done }) : tr('티켓을 추가하면 진행률이 보여요')}</small>
          </section>

          <section className="side-section">
            <div className="side-head"><span>{tr('백업')}</span></div>
            <button className="btn outline small" onClick={() => exportAll().then(() => setToast(tr('백업 파일을 저장했어요')))}><I.Download /> {tr('내보내기')}</button>
            <button className="btn outline small" onClick={() => fileRef.current && fileRef.current.click()}><I.Upload /> {tr('가져오기')}</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
            <small className="muted">{tr('전체 티켓 {n}개', { n: allCount })}</small>
          </section>
        </aside>

        <main className="main">
          {view === 'today' && <TodayPlan />}
          {view !== 'today' && <div className="main-head">
            <div>
              <small className="muted">{tr('카테고리')} / {filter === 'all' ? tr('전체') : (catById[filter] || {}).name}</small>
              <h1>{tr(view === 'meeting' ? '{w} 미팅' : '{w} 보드', { w: weekTitle(monday) })} <span className="muted h1-sub">{fmtDay(from)} ~ {fmtDay(to)}</span></h1>
            </div>
            {view !== 'meeting' && (
              <div className="segmented" role="group" aria-label={tr('보드 보기 방식')}>
                <button aria-pressed={view === 'date'} onClick={() => setView('date')}>{tr('날짜별')}</button>
                <button aria-pressed={view === 'status'} onClick={() => setView('status')}>{tr('상태별')}</button>
              </div>
            )}
          </div>}

          {view === 'meeting' && (
            <MeetingCalendar monday={monday} todayKey={todayKey} catById={catById}
              meetings={visible.filter((t) => t.kind === 'meeting')}
              onCreate={(date, start, end) => setTicketModal({ date, kind: 'meeting', start, end })}
              onOpen={setDetailId} />
          )}
          {view === 'meeting' || view === 'today' ? null : view === 'date' ? (
            <div className="scroll-x">
              <div className="days">
                {MON_FIRST.map((wd, i) => {
                  const dt = addDays(monday, i);
                  const key = ymd(dt);
                  const list = visible.filter((t) => t.date === key);
                  const isToday = key === todayKey;
                  return (
                    <section key={key} className={'day' + (isToday ? ' today' : '') + (dropKey === key ? ' drop' : '')}
                      {...dropProps(key, (id) => updateTicket(id, { date: key }))} aria-label={fmtDay(key)}>
                      <div className="day-head">
                        <span className={'wd' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '')}>{weekdayName(wd)}</span>
                        <span className="day-num">{dt.getDate()}</span>
                        {isToday && <span className="today-pill">{tr('오늘')}</span>}
                        <span className="day-count">{list.length ? list.length + tr('개') : ''}</span>
                      </div>
                      {list.length === 0 && <span className="day-empty">{tr('비어 있어요')}</span>}
                      {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} compact onOpen={setDetailId} />)}
                      <button className="add-day" onClick={() => openCreate(key)} aria-label={tr('{d}에 추가', { d: fmtDay(key) })}><I.Plus size={12} /> {tr('추가')}</button>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="scroll-x">
              <div className="status-cols">
                {Object.entries(STATUS).map(([id, s]) => {
                  const list = visible.filter((t) => t.status === id);
                  return (
                    <section key={id} className={'status-col' + (dropKey === id ? ' drop' : '')}
                      {...dropProps(id, (tid) => setStatus(tid, id))}>
                      <div className="day-head">
                        <span className="dot" style={{ background: s.color }} />
                        <span className="col-title">{tr(s.label)}</span>
                        <span className="count-pill">{list.length}</span>
                      </div>
                      {list.length === 0 && <span className="day-empty">{tr('비어 있어요')}</span>}
                      {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} onOpen={setDetailId} />)}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {ticketModal && (
        <TicketModal
          categories={categories}
          defaultDate={ticketModal.date}
          defaultKind={ticketModal.kind || (view === 'meeting' ? 'meeting' : 'task')}
          defaultStart={ticketModal.start}
          defaultEnd={ticketModal.end}
          defaultCategoryId={filter === 'all' ? (categories[0] && categories[0].id) : filter}
          onClose={() => setTicketModal(null)}
          onCreated={(n) => { setTicketModal(null); setToast(n > 1 ? tr('티켓 {n}개를 만들었어요', { n }) : tr('만들었어요')); }}
          onOpenCategories={() => setCatOpen(true)}
        />
      )}
      {detailId && <TicketDetail id={detailId} catById={catById} onClose={() => setDetailId(null)} />}
      {catOpen && <CategoryModal categories={categories} onClose={() => setCatOpen(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function NavRow({ icon, label, active, onClick }) {
  return (
    <button className={'cat-row' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="grow">{label}</span>
    </button>
  );
}

function CatRow({ active, label, short, color, soft, count, onClick }) {
  return (
    <button className={'cat-row' + (active ? ' active' : '')} aria-pressed={active} onClick={onClick}>
      <span className="cat-badge" style={{ background: soft, color }}>{short}</span>
      <span className="grow">{label}</span>
      <span className="muted">{count}</span>
    </button>
  );
}

function Card({ t, cat, compact, onOpen }) {
  const [dragging, setDragging] = useState(false);
  if (!cat) return null;
  const p = PALETTE[cat.colorIndex] || PALETTE[0];
  const s = STATUS[t.status];
  const isMeeting = t.kind === 'meeting';
  const time = isMeeting ? (t.allDay ? tr('하루 종일') : `${fmtTime(t.start)} ~ ${fmtTime(t.end)}`) : '';
  const deadline = t.deadline ? `${fmtDay(t.deadline)}${t.deadlineTime ? ' ' + fmtTime(t.deadlineTime) : ''}` : '';
  const done = t.status === 'done';

  return (
    <div className={'card' + (compact ? ' compact' : '') + (t.status === 'hard' ? ' hard' : '') + (dragging ? ' dragging' : '')}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; setDragging(true); }}
      onDragEnd={() => setDragging(false)}>
      <button className="card-main" onClick={() => onOpen(t.id)}
        aria-label={tr('{title}, {status}, 눌러서 자세히 보기', { title: t.title, status: tr(s.label) })}>
        <span className="card-top">
          <span className="dot" style={{ background: s.color }} />
          <span className="card-key">{code(cat.key, t.number)}</span>
          {isMeeting && <span className="meeting-tag">{tr('미팅')}</span>}
        </span>
        <span className={'card-title' + (done ? ' done' : '')}>{t.title}</span>
        {t.desc && !compact && <span className="card-desc">{t.desc}</span>}
        {!compact && <span className="card-meta"><I.Clock /> {fmtDay(t.date)}{time ? ' · ' + time : ''}</span>}
        {compact && time && <span className="card-meta"><I.Clock /> {time}</span>}
        {deadline && <span className={'card-meta' + (t.priority === 'high' && !done ? ' urgent' : '')}><I.Flag /> {tr('마감 {d}까지', { d: deadline })}</span>}
        <span className="card-tags">
          <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
          <span className="status-pill" style={{ background: s.soft, color: s.color }}>{tr(s.label)}</span>
          {t.seriesTotal > 1 && <span className="muted tiny"><I.Repeat /> {tr('반복')}</span>}
          {t.priority === 'high' && <span className="urgent" role="img" aria-label={tr('높은 우선순위')}><I.ArrowUp /></span>}
        </span>
      </button>
      {t.checklist && t.checklist.length > 0 && (
        <ul className="checklist" aria-label={tr('{title} 체크리스트', { title: t.title })}>
          {t.checklist.map((item, i) => (
            <li key={i}>
              <label className={'check' + (item.done ? ' done' : '')}>
                <input type="checkbox" checked={item.done} onChange={() => toggleCheck(t, i)} />
                <span>{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
