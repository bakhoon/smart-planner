import { useRef, useState } from 'react';
import { PALETTE, code, toggleCheck, deleteTicket } from './db.js';
import { addDays, fmtDay, fmtLong, fmtTime, weekdayLong, weekdayName, ymd } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

const START_HOUR = 6;
const END_HOUR = 24;
const ROW = 40; // px per hour
const HEIGHT = (END_HOUR - START_HOUR) * ROW;
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

const toHour = (s) => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
const toHHMM = (h) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh < 10 ? '0' + hh : hh}:${mm < 10 ? '0' + mm : mm}`;
};

// Side-by-side columns for meetings that overlap in time
function layout(list) {
  const items = list
    .map((t) => ({ t, s: toHour(t.start), e: Math.max(toHour(t.end), toHour(t.start) + 0.25) }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = [];
    cluster.forEach((it) => {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(it.e); } else cols[c] = it.e;
      it.col = c;
    });
    cluster.forEach((it) => { it.cols = cols.length; });
    cluster = [];
  };
  items.forEach((it) => {
    if (it.s >= clusterEnd) { flush(); clusterEnd = it.e; } else clusterEnd = Math.max(clusterEnd, it.e);
    cluster.push(it);
  });
  flush();
  return items;
}

export default function MeetingCalendar({ monday, meetings, catById, todayKey, onCreate, onOpen }) {
  const [drag, setDrag] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const dragRef = useRef(null);

  const hourAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const h = START_HOUR + Math.floor(y / (ROW / 2)) * 0.5;
    return Math.min(END_HOUR - 0.5, Math.max(START_HOUR, h));
  };

  const down = (key) => (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = hourAt(e);
    dragRef.current = { key, a: h, c: h };
    setDrag(dragRef.current);
  };
  const move = (key) => (e) => {
    const d = dragRef.current;
    if (!d || d.key !== key) return;
    const h = hourAt(e);
    if (h !== d.c) { dragRef.current = { ...d, c: h }; setDrag(dragRef.current); }
  };
  const up = (key) => () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.key !== key) return;
    const s = Math.min(d.a, d.c);
    let en = Math.max(d.a, d.c) + 0.5;
    if (d.a === d.c) en = Math.min(s + 1, END_HOUR);
    onCreate(key, toHHMM(s), toHHMM(Math.min(en, 23.99)));
  };

  const selected = meetings.find((m) => m.id === selectedId);
  const weekList = [...meetings].sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h);

  return (
    <div className="mc">
      <section className="mc-grid-wrap" aria-label={tr('이번 주 미팅 캘린더')}>
        <div className="mc-grid">
          <div className="mc-head">
            <span />
            {MON_FIRST.map((wd, i) => {
              const key = ymd(addDays(monday, i));
              return (
                <span key={key} className={'mc-day-head' + (key === todayKey ? ' today' : '')}>
                  <span className={'wd' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '')}>{weekdayName(wd)}</span>
                  <strong>{addDays(monday, i).getDate()}</strong>
                </span>
              );
            })}
          </div>

          <div className="mc-allday">
            <span className="mc-gutter-label">{tr('종일')}</span>
            {MON_FIRST.map((_, i) => {
              const key = ymd(addDays(monday, i));
              return (
                <div key={key} className="mc-allday-cell">
                  {meetings.filter((m) => m.date === key && m.allDay).map((m) => {
                    const p = PALETTE[(catById[m.categoryId] || {}).colorIndex] || PALETTE[0];
                    return (
                      <button key={m.id} className="mc-chip" style={{ background: p.soft, color: p.color, borderColor: selectedId === m.id ? p.color : 'transparent' }}
                        onClick={() => onOpen(m.id)}>{m.title}</button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mc-body">
            <div className="mc-gutter" style={{ height: HEIGHT }}>
              {hours.map((h) => (
                <span key={h} style={{ top: (h - START_HOUR) * ROW }}>{fmtTime(toHHMM(h)).replace(':00', tr('시'))}</span>
              ))}
            </div>
            {MON_FIRST.map((_, i) => {
              const key = ymd(addDays(monday, i));
              const items = layout(meetings.filter((m) => m.date === key && !m.allDay && m.start));
              const ghost = drag && drag.key === key
                ? { s: Math.min(drag.a, drag.c), e: Math.max(drag.a, drag.c) + 0.5 }
                : null;
              return (
                <div key={key} className={'mc-col' + (key === todayKey ? ' today' : '')} style={{ height: HEIGHT }}
                  onPointerDown={down(key)} onPointerMove={move(key)} onPointerUp={up(key)}>
                  {hours.map((h) => <span key={h} className="mc-line" style={{ top: (h - START_HOUR) * ROW }} />)}
                  {items.map(({ t, s, e, col, cols }) => {
                    const cat = catById[t.categoryId];
                    if (!cat) return null;
                    const p = PALETTE[cat.colorIndex] || PALETTE[0];
                    const top = (Math.max(s, START_HOUR) - START_HOUR) * ROW;
                    const height = Math.max((Math.min(e, END_HOUR) - Math.max(s, START_HOUR)) * ROW - 2, 18);
                    return (
                      <button key={t.id} className={'mc-event' + (t.status === 'done' ? ' done' : '')}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={() => onOpen(t.id)}
                        aria-label={`${t.title}, ${fmtDay(t.date)} ${fmtTime(t.start)}`}
                        style={{
                          top, height,
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          background: p.soft,
                          borderColor: selectedId === t.id ? p.color : 'transparent',
                        }}>
                        <span className="mc-event-title" style={{ color: p.color }}>{t.title}</span>
                        <span className="mc-event-time">{fmtTime(t.start)} ~ {fmtTime(t.end)}</span>
                      </button>
                    );
                  })}
                  {ghost && (
                    <div className="mc-ghost" style={{ top: (ghost.s - START_HOUR) * ROW, height: (ghost.e - ghost.s) * ROW }}>
                      {fmtTime(toHHMM(ghost.s))} ~ {fmtTime(toHHMM(Math.min(ghost.e, 23.99)))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="mc-side">
        {selected && catById[selected.categoryId] ? (
          <MeetingDetail t={selected} cat={catById[selected.categoryId]} confirming={confirming}
            onAskDelete={() => setConfirming(true)} onCancelDelete={() => setConfirming(false)}
            onDelete={() => { deleteTicket(selected.id); setSelectedId(null); setConfirming(false); }}
            onClose={() => setSelectedId(null)} />
        ) : (
          <div className="mc-panel">
            <h2>{tr('이번 주 미팅')} <span className="muted">{tr('{n}개', { n: weekList.length })}</span></h2>
            {weekList.length === 0 && <p className="muted small-text">{tr('아직 미팅이 없어요. 캘린더의 빈 시간을 위아래로 드래그해서 만들어 보세요.')}</p>}
            {weekList.map((m) => {
              const cat = catById[m.categoryId];
              if (!cat) return null;
              const p = PALETTE[cat.colorIndex] || PALETTE[0];
              return (
                <button key={m.id} className="mc-list-item" onClick={() => onOpen(m.id)}>
                  <span className="mc-list-day">{fmtDay(m.date)}</span>
                  <span className="grow">
                    <strong>{m.title}</strong>
                    <small className="muted block">{m.allDay ? tr('하루 종일') : `${fmtTime(m.start)} ~ ${fmtTime(m.end)}`}</small>
                  </span>
                  <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function MeetingDetail({ t, cat, confirming, onAskDelete, onCancelDelete, onDelete, onClose }) {
  const p = PALETTE[cat.colorIndex] || PALETTE[0];
  return (
    <div className="mc-panel">
      <div className="row-between">
        <small className="muted">{code(cat.key, t.number)}</small>
        <button className="icon-btn small" aria-label={tr('닫기')} onClick={onClose}><I.Close size={14} /></button>
      </div>
      <h2>{t.title}</h2>
      <div className="row">
        <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
        <span className="meeting-tag">{tr('미팅')}</span>
      </div>
      <p className="card-meta"><I.Clock /> {fmtDay(t.date)} · {t.allDay ? tr('하루 종일') : `${fmtTime(t.start)} ~ ${fmtTime(t.end)}`}</p>
      {t.desc && <p className="detail-desc">{t.desc}</p>}
      {t.checklist && t.checklist.length > 0 && (
        <ul className="checklist flush">
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
      {!confirming ? (
        <button className="btn danger-outline small" onClick={onAskDelete}><I.Trash size={12} /> {tr('이 미팅 지우기')}</button>
      ) : (
        <div className="confirm" role="alert">
          <span className="grow">{tr('이 미팅을 지울까요?')}</span>
          <button className="btn ghost small" onClick={onCancelDelete}>{tr('취소')}</button>
          <button className="btn danger small" onClick={onDelete}>{tr('지우기')}</button>
        </div>
      )}
    </div>
  );
}
