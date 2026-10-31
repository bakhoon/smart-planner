import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addPlan, updatePlan, deletePlan } from './db.js';
import { addDays, fmtLong, fmtTime, parseDate, today, weekdayLong, weekdayName, ymd } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

// 오늘의 플랜: a plain checklist for one day. Go back to see earlier days.
export default function TodayPlan() {
  const todayKey = ymd(today());
  const [day, setDay] = useState(todayKey);
  const [text, setText] = useState('');
  const [time, setTime] = useState('');

  const items = useLiveQuery(() => db.plans.where('date').equals(day).sortBy('createdAt'), [day], []);
  const d = parseDate(day);
  const isToday = day === todayKey;
  const done = items.filter((x) => x.done).length;

  const add = () => {
    if (!text.trim()) return;
    const [v, tm] = [text, time];
    setText('');
    setTime('');
    addPlan(day, v, tm);
  };

  let label = fmtLong(day);
  if (isToday) label += tr(' · 오늘');
  else if (day === ymd(addDays(today(), -1))) label += tr(' · 어제');

  return (
    <section className="plan" aria-labelledby="plan-title">
      <div className="plan-head">
        <div>
          <h1 id="plan-title">{tr('오늘의 플랜')}</h1>
          <small className="muted">{items.length ? tr('{n}개 중 {d}개 완료', { n: items.length, d: done }) : tr('오늘 할 일을 적어 보세요')}</small>
        </div>
        <div className="plan-nav">
          <button className="icon-btn" aria-label={tr('전날 보기')} onClick={() => setDay(ymd(addDays(d, -1)))}><I.ChevronLeft /></button>
          <span className="plan-date">{label}</span>
          <button className="icon-btn" aria-label={tr('다음 날 보기')} disabled={isToday} onClick={() => setDay(ymd(addDays(d, 1)))}><I.ChevronRight /></button>
          {!isToday && <button className="btn ghost small" onClick={() => setDay(todayKey)}>{tr('오늘로')}</button>}
        </div>
      </div>

      <ul className="plan-list">
        {items.map((it) => (
          <PlanRow key={it.id} it={it} />
        ))}
        {items.length === 0 && <li className="plan-empty">{isToday ? tr('아직 비어 있어요') : tr('이 날은 적은 게 없어요')}</li>}
      </ul>

      <div className="plan-add">
        <span className="box" aria-hidden="true" />
        <input className="plan-text" aria-label={tr('새 할 일')} placeholder={tr('할 일을 쓰고 Enter')} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} />
        <input className="plan-time" type="time" aria-label={tr('시간 (선택)')} value={time} onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn primary small" onClick={add}><I.Plus size={12} /> {tr('추가')}</button>
      </div>
      <small className="muted">{tr('시간은 안 넣어도 돼요.')}</small>
    </section>
  );
}

function PlanRow({ it }) {
  const [text, setText] = useState(it.text);
  const save = () => {
    const v = text.trim();
    if (!v) { setText(it.text); return; }
    if (v !== it.text) updatePlan(it.id, { text: v });
  };
  return (
    <li className={'plan-row' + (it.done ? ' done' : '')}>
      <input type="checkbox" aria-label={tr('{x} 완료', { x: it.text })} checked={it.done} onChange={() => updatePlan(it.id, { done: !it.done })} />
      <input className="plan-text" aria-label={tr('할 일')} value={text} onChange={(e) => setText(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }} />
      <input className="plan-time" type="time" aria-label={tr('시간 (선택)')} value={it.time || ''} onChange={(e) => updatePlan(it.id, { time: e.target.value })} />
      {it.time && <span className="plan-time-label">{fmtTime(it.time)}</span>}
      <button className="icon-btn small" aria-label={tr('{x} 지우기', { x: it.text })} onClick={() => deletePlan(it.id)}><I.Close size={14} /></button>
    </li>
  );
}
