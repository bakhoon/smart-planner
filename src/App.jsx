import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, PALETTE, code, toggleCheck, setStatus, moveToDay, rollForward,
  sprintKey, undoCreate, exportAll, importAll,
} from './db.js';
import { addDays, fmtDay, fmtTime, mondayOf, today, weekdayName, ymd } from './dates.js';
import { tr, getLang, setLang } from './i18n.js';
import TicketModal from './TicketModal.jsx';
import CategoryModal from './CategoryModal.jsx';
import MeetingCalendar from './MeetingCalendar.jsx';
import TicketDetail, { STATUS } from './TicketDetail.jsx';
import TodayPlan from './TodayPlan.jsx';
import DayChecks from './DayChecks.jsx';
import * as I from './icons.jsx';

// Monday-first weekday numbers for weekdayName (0 = Sunday in JS dates)
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const NO_DAYS = [false, false, false, false, false, false, false];

export default function App() {
  const [monday, setMonday] = useState(() => mondayOf(today()));
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('status');
  const [ticketModal, setTicketModal] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const switchLang = (l) => { setLang(l); setLangState(l); };
  const [dropKey, setDropKey] = useState(null);
  const [toast, setToast] = useState('');
  const [undo, setUndo] = useState(null); // { info, until }
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef(null);

  const sprint = sprintKey(monday);
  const currentSprint = sprintKey(mondayOf(today()));
  const from = ymd(monday);
  const to = ymd(addDays(monday, 6));
  const todayKey = ymd(today());

  // Tickets marked "continue into the next sprint" are copied forward up to the sprint being looked at
  useEffect(() => {
    rollForward(sprint > currentSprint ? sprint : currentSprint);
  }, [sprint, currentSprint]);

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const sprintTickets = useLiveQuery(() => db.tickets.where('sprint').equals(sprint).toArray(), [sprint], []);
  const allCount = useLiveQuery(() => db.tickets.count(), [], 0);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const visible = sprintTickets
    .filter((t) => filter === 'all' || t.categoryId === filter)
    .filter((t) => catById[t.categoryId])
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')) || a.number - b.number);

  const done = sprintTickets.filter((t) => t.status === 'done').length;
  const pct = sprintTickets.length ? Math.round((done / sprintTickets.length) * 100) : 0;

  // drag & drop: a card carries its ticket id; a weekday column plans it on that day, a status column changes the status
  const byId = useMemo(() => Object.fromEntries(sprintTickets.map((t) => [t.id, t])), [sprintTickets]);
  const dropProps = (key, apply) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropKey !== key) setDropKey(key); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null); },
    onDrop: (e) => {
      e.preventDefault();
      setDropKey(null);
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (id && byId[id]) apply(byId[id]);
    },
  });

  // the undo bar stays for one minute after a ticket is made, then goes away
  useEffect(() => {
    if (!undo) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= undo.until) setUndo(null);
    }, 1000);
    return () => clearInterval(id);
  }, [undo]);

  const doUndo = async () => {
    if (!undo) return;
    const info = undo.info;
    setUndo(null);
    await undoCreate(info);
    setToast(tr('{c} 만들기를 되돌렸어요', { c: code(info.key, info.number) }));
  };

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

  const openCreate = (date, extra) => {
    const inSprint = todayKey >= from && todayKey <= to;
    setTicketModal({ date: date || (inSprint ? todayKey : from), ...extra });
  };

  const isBoard = view === 'status' || view === 'days';

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
            <button className="icon-btn" aria-label={tr('이전 스프린트')} onClick={() => setMonday(addDays(monday, -7))}><I.ChevronLeft /></button>
            <span className="weeknav-label">
              <strong>{sprint}</strong>
              <small>{fmtDay(from)} ~ {fmtDay(to)}</small>
            </span>
            <button className="icon-btn" aria-label={tr('다음 스프린트')} onClick={() => setMonday(addDays(monday, 7))}><I.ChevronRight /></button>
          </div>
          {sprint !== currentSprint && (
            <button className="btn ghost small" onClick={() => setMonday(mondayOf(today()))}>{tr('이번 스프린트로')}</button>
          )}

          <nav className="side-section" aria-label={tr('보기')}>
            <div className="side-head"><span>{tr('보기')}</span></div>
            <NavRow icon={<I.Board />} label={tr('스프린트 보드')} active={isBoard} onClick={() => setView(isBoard ? view : 'status')} />
            <NavRow icon={<I.Calendar />} label={tr('캘린더')} active={view === 'meeting'} onClick={() => setView('meeting')} />
            <NavRow icon={<I.Check />} label={tr('오늘의 플랜')} active={view === 'today'} onClick={() => setView('today')} />
          </nav>

          <section className="side-section">
            <div className="side-head">
              <span>{tr('카테고리')}</span>
              <button className="icon-btn small" aria-label={tr('카테고리 설정')} onClick={() => setCatOpen(true)}><I.Sliders /></button>
            </div>
            <CatRow active={filter === 'all'} label={tr('전체')} short={tr('전')} color="#E6E8EB" soft="#353A43"
              count={sprintTickets.length} onClick={() => setFilter('all')} />
            {categories.map((c) => {
              const p = PALETTE[c.colorIndex] || PALETTE[0];
              return (
                <CatRow key={c.id} active={filter === c.id} label={c.name} short={c.key.slice(0, 2)}
                  color={p.color} soft={p.soft}
                  count={sprintTickets.filter((t) => t.categoryId === c.id).length}
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
            <div className="row-between"><strong>{tr('스프린트 진행률')}</strong><span>{pct}%</span></div>
            <div className="bar"><div style={{ width: pct + '%' }} /></div>
            <small>{sprintTickets.length ? tr('{n}개 중 {d}개 완료', { n: sprintTickets.length, d: done }) : tr('티켓을 추가하면 진행률이 보여요')}</small>
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

          {view !== 'today' && (
            <div className="main-head">
              <div>
                <small className="muted">{tr('카테고리')} / {filter === 'all' ? tr('전체') : (catById[filter] || {}).name}</small>
                <h1>{view === 'meeting' ? tr('{w} 미팅', { w: sprint }) : sprint}
                  <span className="muted h1-sub">{fmtDay(from)} ~ {fmtDay(to)} · {tr('일요일 마감')}</span>
                </h1>
              </div>
              {isBoard && (
                <div className="segmented" role="group" aria-label={tr('보드 보기 방식')}>
                  <button aria-pressed={view === 'status'} onClick={() => setView('status')}>{tr('상태별')}</button>
                  <button aria-pressed={view === 'days'} onClick={() => setView('days')}>{tr('요일별')}</button>
                </div>
              )}
            </div>
          )}

          {view === 'meeting' && (
            <MeetingCalendar monday={monday} todayKey={todayKey} catById={catById}
              meetings={visible.filter((t) => t.kind === 'meeting')}
              onCreate={(date, start, end) => openCreate(date, { kind: 'meeting', start, end })}
              onOpen={setDetailId} />
          )}

          {view === 'status' && (
            <div className="scroll-x">
              <div className="status-cols">
                {Object.entries(STATUS).map(([id, s]) => {
                  const list = visible.filter((t) => t.status === id);
                  return (
                    <section key={id} className={'status-col' + (dropKey === id ? ' drop' : '')}
                      {...dropProps(id, (t) => setStatus(t.id, id))}>
                      <div className="day-head">
                        <span className="dot" style={{ background: s.color }} />
                        <span className="col-title">{tr(s.label)}</span>
                        <span className="count-pill">{list.length}</span>
                      </div>
                      {list.length === 0 && <span className="day-empty">{tr('비어 있어요')}</span>}
                      {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} onOpen={setDetailId} />)}
                      {id === 'todo' && (
                        <button className="add-day" onClick={() => openCreate()}><I.Plus size={12} /> {tr('추가')}</button>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'days' && (
            <>
              {visible.some((t) => t.kind !== 'meeting' && !(t.days || NO_DAYS).some(Boolean)) && (
                <section className="unplanned">
                  <span className="label">{tr('요일 안 정한 티켓')} <small className="muted">{tr('요일 칸으로 끌어다 놓으면 그 요일에 들어가요')}</small></span>
                  <div className="unplanned-list">
                    {visible.filter((t) => t.kind !== 'meeting' && !(t.days || NO_DAYS).some(Boolean)).map((t) => (
                      <Card key={t.id} t={t} cat={catById[t.categoryId]} compact onOpen={setDetailId} />
                    ))}
                  </div>
                </section>
              )}
              <div className="scroll-x">
                <div className="days">
                  {MON_FIRST.map((wd, i) => {
                    const dt = addDays(monday, i);
                    const key = ymd(dt);
                    const list = visible.filter((t) => (t.kind === 'meeting' ? t.date === key : (t.days || NO_DAYS)[i]));
                    const isToday = key === todayKey;
                    return (
                      <section key={key} className={'day' + (isToday ? ' today' : '') + (dropKey === key ? ' drop' : '')}
                        {...dropProps(key, (t) => moveToDay(t, i))} aria-label={fmtDay(key)}>
                        <div className="day-head">
                          <span className={'wd' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '')}>{weekdayName(wd)}</span>
                          <span className="day-num">{dt.getDate()}</span>
                          {isToday && <span className="today-pill">{tr('오늘')}</span>}
                          <span className="day-count">{list.length ? list.length + tr('개') : ''}</span>
                        </div>
                        {list.length === 0 && <span className="day-empty">{tr('비어 있어요')}</span>}
                        {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} compact dayIndex={i} onOpen={setDetailId} />)}
                        <button className="add-day" onClick={() => openCreate(key, { pickDay: true })} aria-label={tr('{d}에 추가', { d: fmtDay(key) })}><I.Plus size={12} /> {tr('추가')}</button>
                      </section>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {ticketModal && (
        <TicketModal
          categories={categories}
          sprint={sprint}
          pickDay={!!ticketModal.pickDay}
          defaultDate={ticketModal.date}
          defaultKind={ticketModal.kind || (view === 'meeting' ? 'meeting' : 'task')}
          defaultStart={ticketModal.start}
          defaultEnd={ticketModal.end}
          defaultCategoryId={filter === 'all' ? (categories[0] && categories[0].id) : filter}
          onClose={() => setTicketModal(null)}
          onCreated={(info, keepOpen) => {
            if (!keepOpen) setTicketModal(null);
            setNow(Date.now());
            setUndo({ info, until: Date.now() + 60000 });
          }}
          onOpenCategories={() => setCatOpen(true)}
        />
      )}
      {detailId && <TicketDetail id={detailId} catById={catById} onClose={() => setDetailId(null)} />}
      {catOpen && <CategoryModal categories={categories} onClose={() => setCatOpen(false)} />}
      {undo && (
        <div className="undo-bar" role="status">
          <I.CheckMark size={14} />
          <span className="grow">{tr('{c} 만들었어요', { c: code(undo.info.key, undo.info.number) })} <span className="muted">· {undo.info.title}</span></span>
          <button className="btn outline small" onClick={doUndo}>{tr('되돌리기')}</button>
          <span className="undo-time">{tr('{s}초', { s: Math.max(0, Math.ceil((undo.until - now) / 1000)) })}</span>
          <button className="icon-btn small" aria-label={tr('닫기')} onClick={() => setUndo(null)}><I.Close size={14} /></button>
        </div>
      )}
      {toast && <div className={'toast' + (undo ? ' raised' : '')} role="status">{toast}</div>}
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

function Card({ t, cat, compact, dayIndex, onOpen }) {
  const [dragging, setDragging] = useState(false);
  if (!cat) return null;
  const p = PALETTE[cat.colorIndex] || PALETTE[0];
  const s = STATUS[t.status] || STATUS.todo;
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
        {isMeeting && <span className="card-meta"><I.Clock /> {compact ? time : `${fmtDay(t.date)} · ${time}`}</span>}
        {deadline && <span className={'card-meta' + (t.priority === 'high' && !done ? ' urgent' : '')}><I.Flag /> {tr('마감 {d}까지', { d: deadline })}</span>}
        <span className="card-tags">
          <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
          <span className="status-pill" style={{ background: s.soft, color: s.color }}>{tr(s.label)}</span>
          {t.carry && <span className="muted tiny" title={tr('다음 스프린트에도 이어서')}><I.Repeat /> {tr('매주')}</span>}
          {t.priority === 'high' && <span className="urgent" role="img" aria-label={tr('높은 우선순위')}><I.ArrowUp /></span>}
        </span>
      </button>
      {!isMeeting && <DayChecks t={t} highlight={dayIndex} />}
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

