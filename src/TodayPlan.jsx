import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addPlan, updatePlan, deletePlan, reorderPlans, clearPlans } from './db.js';
import { addDays, fmtLong, fmtTime, parseDate, today, weekdayLong, weekdayName, ymd } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

// 오늘의 플랜: a plain checklist for one day. Go back to earlier days or ahead to plan future days.
export default function TodayPlan() {
  const todayKey = ymd(today());
  const [day, setDay] = useState(todayKey);
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const items = useLiveQuery(
    async () => (await db.plans.where('date').equals(day).toArray()).sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)),
    [day],
    []
  );

  // drop the dragged row where the target row is
  const dropOn = (targetId) => {
    if (dragId == null || dragId === targetId) return;
    const ids = items.map((x) => x.id).filter((x) => x !== dragId);
    const at = targetId == null ? ids.length : ids.indexOf(targetId);
    ids.splice(at, 0, dragId);
    reorderPlans(ids);
  };
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
  else if (day === ymd(addDays(today(), 1))) label += tr(' · 내일');
  const isFuture = day > todayKey;

  return (
    <section className="plan" aria-labelledby="plan-title">
      <div className="plan-head">
        <div>
          <h1 id="plan-title">{tr('오늘의 플랜')}</h1>
          <small className="muted">{items.length ? tr('{n}개 중 {d}개 완료', { n: items.length, d: done }) : tr('오늘 할 일을 적어 보세요')}</small>
        </div>
        <div className="plan-nav">
          <button className="icon-btn" aria-label={tr('전날 보기')} onClick={() => { setDay(ymd(addDays(d, -1))); setConfirmClear(false); }}><I.ChevronLeft /></button>
          <span className="plan-date">{label}</span>
          <button className="icon-btn" aria-label={tr('다음 날 보기')} onClick={() => { setDay(ymd(addDays(d, 1))); setConfirmClear(false); }}><I.ChevronRight /></button>
          {!isToday && <button className="btn ghost small" onClick={() => { setDay(todayKey); setConfirmClear(false); }}>{tr('오늘로')}</button>}
        </div>
      </div>

      <ul className="plan-list">
        {items.map((it) => (
          <PlanRow key={it.id} it={it}
            dragging={dragId === it.id} over={overId === it.id && dragId !== it.id}
            onDragStart={() => setDragId(it.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDragOver={() => setOverId(it.id)}
            onDrop={() => { dropOn(it.id); setDragId(null); setOverId(null); }} />
        ))}
        {items.length === 0 && <li className="plan-empty">{isToday ? tr('아직 비어 있어요') : isFuture ? tr('이 날 할 일을 미리 적어 둘 수 있어요') : tr('이 날은 적은 게 없어요')}</li>}
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
      <div className="plan-foot">
        <small className="muted">{tr('시간은 안 넣어도 돼요. 왼쪽 손잡이를 끌어서 순서를 바꿀 수 있어요.')}</small>
        {items.length > 0 && !confirmClear && (
          <button className="btn danger-outline small" onClick={() => setConfirmClear(true)}><I.Trash size={12} /> {tr('모두 지우기')}</button>
        )}
      </div>
      {confirmClear && (
        <div className="confirm" role="alert">
          <span className="grow">{tr('이 날 할 일 {n}개를 모두 지울까요?', { n: items.length })}</span>
          <button className="btn ghost small" onClick={() => setConfirmClear(false)}>{tr('취소')}</button>
          <button className="btn danger small" onClick={() => { clearPlans(day); setConfirmClear(false); }}>{tr('모두 지우기')}</button>
        </div>
      )}
    </section>
  );
}

function PlanRow({ it, dragging, over, onDragStart, onDragEnd, onDragOver, onDrop }) {
  const [text, setText] = useState(it.text);
  const [armed, setArmed] = useState(false);
  const save = () => {
    const v = text.trim();
    if (!v) { setText(it.text); return; }
    if (v !== it.text) updatePlan(it.id, { text: v });
  };
  return (
    <li className={'plan-row' + (it.done ? ' done' : '') + (dragging ? ' dragging' : '') + (over ? ' over' : '')}
      draggable={armed}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(it.id)); onDragStart(); }}
      onDragEnd={() => { setArmed(false); onDragEnd(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}>
      <span className="grip" aria-hidden="true" title={tr('끌어서 순서 바꾸기')}
        onPointerDown={() => setArmed(true)} onPointerUp={() => setArmed(false)}>
        <I.Grip />
      </span>
      <input type="checkbox" aria-label={tr('{x} 완료', { x: it.text })} checked={it.done} onChange={() => updatePlan(it.id, { done: !it.done })} />
      <input className="plan-text" aria-label={tr('할 일')} value={text} onChange={(e) => setText(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }} />
      <input className="plan-time" type="time" aria-label={tr('시간 (선택)')} value={it.time || ''} onChange={(e) => updatePlan(it.id, { time: e.target.value })} />
      {it.time && <span className="plan-time-label">{fmtTime(it.time)}</span>}
      <button className="icon-btn small" aria-label={tr('{x} 지우기', { x: it.text })} onClick={() => deletePlan(it.id)}><I.Close size={14} /></button>
    </li>
  );
}
