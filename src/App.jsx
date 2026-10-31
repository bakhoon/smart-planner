import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PALETTE, code, cycleStatus, toggleCheck, deleteTicket, deleteSeries, exportAll, importAll } from './db.js';
import { WEEKDAYS, ymd, addDays, today, mondayOf, fmtDay, fmtTime, weekTitle } from './dates.js';
import TicketModal from './TicketModal.jsx';
import CategoryModal from './CategoryModal.jsx';
import * as I from './icons.jsx';

const STATUS = {
  todo: { label: '할 일', color: '#8B929D' },
  doing: { label: '진행 중', color: '#579DFF' },
  done: { label: '완료', color: '#4CC38A' },
};
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function App() {
  const [monday, setMonday] = useState(() => mondayOf(today()));
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('date');
  const [ticketModal, setTicketModal] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
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
    if (!window.confirm('백업 파일로 지금 데이터를 전부 바꿀까요? 지금 있는 데이터는 사라져요.')) return;
    try {
      const r = await importAll(file);
      setToast(`가져왔어요: 카테고리 ${r.categories}개, 티켓 ${r.tickets}개`);
    } catch (err) {
      setToast(err.message || '가져오기에 실패했어요.');
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
          <span>플래너</span>
        </div>
        <button className="btn primary" onClick={() => openCreate()}>
          <I.Plus /> 만들기
        </button>
        <span className="topbar-note">이 컴퓨터에만 저장돼요 · 인터넷 없이 동작해요</span>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="weeknav">
            <button className="icon-btn" aria-label="이전 주" onClick={() => setMonday(addDays(monday, -7))}><I.ChevronLeft /></button>
            <span className="weeknav-label">
              <strong>{weekTitle(monday)}</strong>
              <small>{monday.getMonth() + 1}.{monday.getDate()} ~ {addDays(monday, 6).getMonth() + 1}.{addDays(monday, 6).getDate()}</small>
            </span>
            <button className="icon-btn" aria-label="다음 주" onClick={() => setMonday(addDays(monday, 7))}><I.ChevronRight /></button>
          </div>
          <button className="btn ghost small" onClick={() => setMonday(mondayOf(today()))}>이번 주로</button>

          <section className="side-section">
            <div className="side-head">
              <span>카테고리</span>
              <button className="icon-btn small" aria-label="카테고리 설정" onClick={() => setCatOpen(true)}><I.Sliders /></button>
            </div>
            <CatRow active={filter === 'all'} label="전체" short="전" color="#E6E8EB" soft="#353A43"
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
                <p>아직 카테고리가 없어요. 일, 교회, 집처럼 나눌 카테고리를 만들어 보세요.</p>
                <button className="btn outline small" onClick={() => setCatOpen(true)}>카테고리 만들기</button>
              </div>
            )}
          </section>

          <section className="progress">
            <div className="row-between"><strong>이번 주 진행률</strong><span>{pct}%</span></div>
            <div className="bar"><div style={{ width: pct + '%' }} /></div>
            <small>{weekTickets.length ? `${weekTickets.length}개 중 ${done}개 완료` : '티켓을 추가하면 진행률이 보여요'}</small>
          </section>

          <section className="side-section">
            <div className="side-head"><span>백업</span></div>
            <button className="btn outline small" onClick={() => exportAll().then(() => setToast('백업 파일을 저장했어요'))}><I.Download /> 내보내기</button>
            <button className="btn outline small" onClick={() => fileRef.current && fileRef.current.click()}><I.Upload /> 가져오기</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
            <small className="muted">전체 티켓 {allCount}개</small>
          </section>
        </aside>

        <main className="main">
          <div className="main-head">
            <div>
              <small className="muted">카테고리 / {filter === 'all' ? '전체' : (catById[filter] || {}).name}</small>
              <h1>{weekTitle(monday)} 보드 <span className="muted h1-sub">{fmtDay(from)} ~ {fmtDay(to)}</span></h1>
            </div>
            <div className="segmented" role="group" aria-label="보드 보기 방식">
              <button aria-pressed={view === 'date'} onClick={() => setView('date')}>날짜별</button>
              <button aria-pressed={view === 'status'} onClick={() => setView('status')}>상태별</button>
            </div>
          </div>

          {view === 'date' ? (
            <div className="scroll-x">
              <div className="days">
                {MON_FIRST.map((wd, i) => {
                  const dt = addDays(monday, i);
                  const key = ymd(dt);
                  const list = visible.filter((t) => t.date === key);
                  const isToday = key === todayKey;
                  return (
                    <section key={key} className={'day' + (isToday ? ' today' : '')} aria-label={`${dt.getMonth() + 1}월 ${dt.getDate()}일 ${WEEKDAYS[wd]}요일`}>
                      <div className="day-head">
                        <span className={'wd' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '')}>{WEEKDAYS[wd]}</span>
                        <span className="day-num">{dt.getDate()}</span>
                        {isToday && <span className="today-pill">오늘</span>}
                        <span className="day-count">{list.length ? list.length + '개' : ''}</span>
                      </div>
                      {list.length === 0 && <span className="day-empty">비어 있어요</span>}
                      {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} compact />)}
                      <button className="add-day" onClick={() => openCreate(key)} aria-label={`${fmtDay(key)}에 추가`}><I.Plus size={12} /> 추가</button>
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
                    <section key={id} className="status-col">
                      <div className="day-head">
                        <span className="dot" style={{ background: s.color }} />
                        <span className="col-title">{s.label}</span>
                        <span className="count-pill">{list.length}</span>
                      </div>
                      {list.length === 0 && <span className="day-empty">비어 있어요</span>}
                      {list.map((t) => <Card key={t.id} t={t} cat={catById[t.categoryId]} />)}
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
          defaultCategoryId={filter === 'all' ? (categories[0] && categories[0].id) : filter}
          onClose={() => setTicketModal(null)}
          onCreated={(n) => { setTicketModal(null); setToast(n > 1 ? `티켓 ${n}개를 만들었어요` : '만들었어요'); }}
          onOpenCategories={() => setCatOpen(true)}
        />
      )}
      {catOpen && <CategoryModal categories={categories} onClose={() => setCatOpen(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
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

function Card({ t, cat, compact }) {
  const [confirming, setConfirming] = useState(false);
  if (!cat) return null;
  const p = PALETTE[cat.colorIndex] || PALETTE[0];
  const s = STATUS[t.status];
  const isMeeting = t.kind === 'meeting';
  const time = isMeeting ? (t.allDay ? '하루 종일' : `${fmtTime(t.start)} ~ ${fmtTime(t.end)}`) : '';
  const deadline = t.deadline ? `${fmtDay(t.deadline)}${t.deadlineTime ? ' ' + fmtTime(t.deadlineTime) : ''}까지` : '';
  const done = t.status === 'done';

  return (
    <div className={'card' + (compact ? ' compact' : '')}>
      <button className="card-main" onClick={() => cycleStatus(t)}
        aria-label={`${t.title}, ${s.label}, 눌러서 다음 상태로`}>
        <span className="card-top">
          <span className="dot" style={{ background: s.color }} />
          <span className="card-key">{code(cat.key, t.number)}</span>
          {isMeeting && <span className="meeting-tag">미팅</span>}
        </span>
        <span className={'card-title' + (done ? ' done' : '')}>{t.title}</span>
        {t.desc && !compact && <span className="card-desc">{t.desc}</span>}
        {!compact && <span className="card-meta"><I.Clock /> {fmtDay(t.date)}{time ? ' · ' + time : ''}</span>}
        {compact && time && <span className="card-meta"><I.Clock /> {time}</span>}
        {deadline && <span className={'card-meta' + (t.priority === 'high' && !done ? ' urgent' : '')}><I.Flag /> 마감 {deadline}</span>}
        <span className="card-tags">
          <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
          <span className="muted tiny">{s.label}</span>
          {t.seriesTotal > 1 && <span className="muted tiny"><I.Repeat /> 반복</span>}
          {t.priority === 'high' && <span className="urgent" role="img" aria-label="높은 우선순위"><I.ArrowUp /></span>}
        </span>
      </button>
      {t.checklist && t.checklist.length > 0 && (
        <ul className="checklist" aria-label={`${t.title} 체크리스트`}>
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
      <button className="card-del" aria-label={`${t.title} 지우기`} onClick={() => setConfirming(true)}><I.Trash size={12} /></button>
      {confirming && (
        <div className="card-confirm" role="alert">
          <button className="btn danger small" onClick={() => deleteTicket(t.id)}>이것만 지우기</button>
          {t.seriesId && (
            <button className="btn danger-outline small" onClick={() => deleteSeries(t.seriesId)}>반복 {t.seriesTotal}개 전부</button>
          )}
          <button className="btn ghost small" onClick={() => setConfirming(false)}>취소</button>
        </div>
      )}
    </div>
  );
}
