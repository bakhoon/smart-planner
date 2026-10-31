import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PALETTE, code, setStatus, toggleCheck, toggleDay, updateTicket, deleteTicket, deleteSeries, sprintEnd } from './db.js';
import DayChecks from './DayChecks.jsx';
import { Toggle } from './TicketModal.jsx';
import { fmtDay, fmtTime, weekdayLong, weekdayName } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

export const STATUS = {
  todo: { label: '할 일', color: '#8B929D', soft: '#2B3038' },
  doing: { label: '진행 중', color: '#579DFF', soft: '#1E3358' },
  hard: { label: 'Block', color: '#F87462', soft: '#4A2422' },
  done: { label: '완료', color: '#4CC38A', soft: '#163628' },
};
const PRIORITY = { high: '높음', mid: '보통', low: '낮음' };
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const NO_DAYS = [false, false, false, false, false, false, false];

export default function TicketDetail({ id, catById, onClose }) {
  const t = useLiveQuery(() => db.tickets.get(id), [id]);
  const chainCount = useLiveQuery(() => (t && t.chainId ? db.tickets.where('chainId').equals(t.chainId).count() : 0), [t && t.chainId], 0);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [newItem, setNewItem] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (t) { setTitle(t.title); setDesc(t.desc || ''); }
  }, [t && t.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (t === undefined) return null;
  if (t === null || !catById[t.categoryId]) { onClose(); return null; }

  const cat = catById[t.categoryId];
  const p = PALETTE[cat.colorIndex] || PALETTE[0];
  const isMeeting = t.kind === 'meeting';
  const checklist = t.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;

  const saveTitle = () => { const v = title.trim(); if (v && v !== t.title) updateTicket(t.id, { title: v }); else setTitle(t.title); };
  const saveDesc = () => { if (desc !== (t.desc || '')) updateTicket(t.id, { desc }); };
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    updateTicket(t.id, { checklist: [...checklist, { text, done: false }] });
    setNewItem('');
  };
  const removeItem = (i) => updateTicket(t.id, { checklist: checklist.filter((_, k) => k !== i) });

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="td-title">
        <div className="modal-head">
          <div className="row">
            <span className="tag" style={{ background: p.soft, color: p.color }}>{cat.name}</span>
            <span className="card-key big">{code(cat.key, t.number)}</span>
            {isMeeting && <span className="meeting-tag">{tr('미팅')}</span>}
          </div>
          <button className="icon-btn" aria-label={tr('닫기')} onClick={onClose}><I.Close /></button>
        </div>

        <div className="modal-body">
          <input id="td-title" className="title-input" aria-label={tr('제목')} value={title}
            onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }} />

          <div className="field">
            <span className="label">{tr('상태')}</span>
            <div className="status-pick" role="group" aria-label={tr('상태')}>
              {Object.entries(STATUS).map(([k, s]) => (
                <button key={k} aria-pressed={t.status === k} onClick={() => setStatus(t.id, k)}
                  style={t.status === k ? { background: s.soft, borderColor: s.color, color: '#fff' } : undefined}>
                  <span className="dot" style={{ background: s.color }} /> {tr(s.label)}
                </button>
              ))}
            </div>
          </div>

          <dl className="facts">
            {isMeeting ? (
              <><dt>{tr('날짜')}</dt><dd>{fmtDay(t.date)}</dd>
                <dt>{tr('시간')}</dt><dd>{t.allDay ? tr('하루 종일') : `${fmtTime(t.start)} ~ ${fmtTime(t.end)}`}</dd></>
            ) : (
              <><dt>{tr('스프린트')}</dt><dd>{t.sprint} <span className="muted">({fmtDay(t.sprint.slice(7))} ~ {fmtDay(sprintEnd(t.sprint))})</span></dd>
                <dt>{tr('데드라인')}</dt><dd className={t.priority === 'high' && t.status !== 'done' ? 'urgent' : ''}>
                  {t.deadline
                    ? tr('{d}까지', { d: fmtDay(t.deadline) + (t.deadlineTime ? ' ' + fmtTime(t.deadlineTime) : '') })
                    : tr('스프린트 끝 ({d})', { d: fmtDay(sprintEnd(t.sprint)) })}</dd></>
            )}
            <dt>{tr('우선순위')}</dt>
            <dd>{tr(PRIORITY[t.priority] || '보통')}</dd>
          </dl>

          {!isMeeting && (
            <div className="field">
              <span className="label">{tr('할 요일')}</span>
              <div className="wrap" role="group" aria-label={tr('할 요일')}>
                {MON_FIRST.map((wd, i) => (
                  <button key={i} className={'day-toggle' + ((t.days || NO_DAYS)[i] ? ' on' : '')} aria-pressed={!!(t.days || NO_DAYS)[i]}
                    aria-label={weekdayLong(wd)} onClick={() => toggleDay(t, i)}>{weekdayName(wd)}</button>
                ))}
              </div>
              {(t.days || NO_DAYS).some(Boolean) && (
                <>
                  <span className="label">{tr('한 날 체크')}</span>
                  <DayChecks t={t} />
                </>
              )}
            </div>
          )}

          <Toggle checked={!!t.carry} onChange={(v) => updateTicket(t.id, { carry: v })}
            label={isMeeting ? tr('매주 이어서') : tr('다음 스프린트에도 이어서')}
            hint={t.carriedTo ? tr('{s}에 이미 이어졌어요', { s: t.carriedTo }) : tr('켜 두면 새 스프린트마다 같은 티켓이 새로 생겨요.')} />

          <div className="field">
            <label className="label" htmlFor="td-desc">{tr('설명')}</label>
            <textarea id="td-desc" rows={3} value={desc} placeholder={tr('설명을 적어 보세요')}
              onChange={(e) => setDesc(e.target.value)} onBlur={saveDesc} />
          </div>

          <div className="field">
            <span className="label">{tr('체크리스트')} {checklist.length > 0 && <span className="muted">{doneCount}/{checklist.length}</span>}</span>
            {checklist.length > 0 && (
              <ul className="checklist flush">
                {checklist.map((item, i) => (
                  <li key={i} className="row">
                    <label className={'check grow' + (item.done ? ' done' : '')}>
                      <input type="checkbox" checked={item.done} onChange={() => toggleCheck(t, i)} />
                      <span>{item.text}</span>
                    </label>
                    <button className="icon-btn small" aria-label={tr('{x} 지우기', { x: item.text })} onClick={() => removeItem(i)}><I.Close size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <input aria-label={tr('체크리스트 항목 추가')} value={newItem} placeholder={tr('항목을 쓰고 Enter')}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addItem(); } }} />
              <button className="btn outline small" onClick={addItem}><I.Plus size={12} /> {tr('추가')}</button>
            </div>
          </div>

          {confirming && (
            <div className="confirm" role="alert">
              <span className="grow">{chainCount > 1 ? tr('이 티켓만 지울까요, 이어진 티켓 {n}개 전부를 지울까요?', { n: chainCount }) : tr('이 티켓을 지울까요?')}</span>
              <button className="btn ghost small" onClick={() => setConfirming(false)}>{tr('취소')}</button>
              <button className="btn danger small" onClick={() => { deleteTicket(t.id); onClose(); }}>{tr('이것만 지우기')}</button>
              {chainCount > 1 && (
                <button className="btn danger-outline small" onClick={() => { deleteSeries(t.chainId); onClose(); }}>{tr('이어진 티켓 전부 지우기')}</button>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot spread">
          <button className="btn danger-outline small" onClick={() => setConfirming(true)}><I.Trash size={12} /> {tr('지우기')}</button>
          <button className="btn primary" onClick={onClose}>{tr('닫기')}</button>
        </div>
      </div>
    </div>
  );
}
