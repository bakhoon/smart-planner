import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PALETTE, code, setStatus, toggleCheck, updateTicket, deleteTicket, deleteSeries } from './db.js';
import { fmtDay, fmtTime } from './dates.js';
import * as I from './icons.jsx';

export const STATUS = {
  todo: { label: '할 일', color: '#8B929D', soft: '#2B3038' },
  doing: { label: '진행 중', color: '#579DFF', soft: '#1E3358' },
  hard: { label: 'Block', color: '#F87462', soft: '#4A2422' },
  done: { label: '완료', color: '#4CC38A', soft: '#163628' },
};
const PRIORITY = { high: '높음', mid: '보통', low: '낮음' };

export default function TicketDetail({ id, catById, onClose }) {
  const t = useLiveQuery(() => db.tickets.get(id), [id]);
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
            {isMeeting && <span className="meeting-tag">미팅</span>}
          </div>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}><I.Close /></button>
        </div>

        <div className="modal-body">
          <input id="td-title" className="title-input" aria-label="제목" value={title}
            onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }} />

          <div className="field">
            <span className="label">상태</span>
            <div className="status-pick" role="group" aria-label="상태">
              {Object.entries(STATUS).map(([k, s]) => (
                <button key={k} aria-pressed={t.status === k} onClick={() => setStatus(t.id, k)}
                  style={t.status === k ? { background: s.soft, borderColor: s.color, color: '#fff' } : undefined}>
                  <span className="dot" style={{ background: s.color }} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="facts">
            <dt>날짜</dt>
            <dd>{fmtDay(t.date)}</dd>
            {isMeeting && (<><dt>시간</dt><dd>{t.allDay ? '하루 종일' : `${fmtTime(t.start)} ~ ${fmtTime(t.end)}`}</dd></>)}
            {!isMeeting && (<><dt>데드라인</dt><dd className={t.deadline && t.priority === 'high' && t.status !== 'done' ? 'urgent' : ''}>
              {t.deadline ? `${fmtDay(t.deadline)}${t.deadlineTime ? ' ' + fmtTime(t.deadlineTime) : ''}까지` : '없음'}</dd></>)}
            <dt>우선순위</dt>
            <dd>{PRIORITY[t.priority] || '보통'}</dd>
            {t.seriesTotal > 1 && (<><dt>반복</dt><dd>반복으로 만든 티켓이에요</dd></>)}
          </dl>

          <div className="field">
            <label className="label" htmlFor="td-desc">설명</label>
            <textarea id="td-desc" rows={3} value={desc} placeholder="설명을 적어 보세요"
              onChange={(e) => setDesc(e.target.value)} onBlur={saveDesc} />
          </div>

          <div className="field">
            <span className="label">체크리스트 {checklist.length > 0 && <span className="muted">{doneCount}/{checklist.length}</span>}</span>
            {checklist.length > 0 && (
              <ul className="checklist flush">
                {checklist.map((item, i) => (
                  <li key={i} className="row">
                    <label className={'check grow' + (item.done ? ' done' : '')}>
                      <input type="checkbox" checked={item.done} onChange={() => toggleCheck(t, i)} />
                      <span>{item.text}</span>
                    </label>
                    <button className="icon-btn small" aria-label={`${item.text} 지우기`} onClick={() => removeItem(i)}><I.Close size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <input aria-label="체크리스트 항목 추가" value={newItem} placeholder="항목을 쓰고 Enter"
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addItem(); } }} />
              <button className="btn outline small" onClick={addItem}><I.Plus size={12} /> 추가</button>
            </div>
          </div>

          {confirming && (
            <div className="confirm" role="alert">
              <span className="grow">{t.seriesId ? '이 티켓만 지울까요, 반복으로 만든 티켓 전부를 지울까요?' : '이 티켓을 지울까요?'}</span>
              <button className="btn ghost small" onClick={() => setConfirming(false)}>취소</button>
              <button className="btn danger small" onClick={() => { deleteTicket(t.id); onClose(); }}>이것만 지우기</button>
              {t.seriesId && (
                <button className="btn danger-outline small" onClick={() => { deleteSeries(t.seriesId); onClose(); }}>반복 전부 지우기</button>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot spread">
          <button className="btn danger-outline small" onClick={() => setConfirming(true)}><I.Trash size={12} /> 지우기</button>
          <button className="btn primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
