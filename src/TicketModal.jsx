import { useEffect, useState } from 'react';
import { PALETTE, datesFor, validateTicket, createTickets } from './db.js';
import { parseDate, addDays, ymd, fmtDay } from './dates.js';
import * as I from './icons.jsx';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function TicketModal({ categories, defaultDate, defaultCategoryId, onClose, onCreated, onOpenCategories }) {
  const [form, setForm] = useState(() => {
    const days = [false, false, false, false, false, false, false];
    days[parseDate(defaultDate).getDay()] = true;
    return {
      kind: 'task',
      title: '',
      desc: '',
      categoryId: defaultCategoryId || null,
      repeat: 'once',
      date: defaultDate,
      from: defaultDate,
      to: ymd(addDays(parseDate(defaultDate), 6)),
      days,
      allDay: false,
      start: '14:00',
      end: '15:00',
      hasDeadline: false,
      deadline: '',
      deadlineTime: '18:00',
      priority: 'mid',
      checklist: [],
    };
  });
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, text] }));
    setNewItem('');
  };
  const editItem = (i, text) => setForm((f) => ({ ...f, checklist: f.checklist.map((x, k) => (k === i ? text : x)) }));
  const removeItem = (i) => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, k) => k !== i) }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // pick the first category once categories exist
  useEffect(() => {
    if (!form.categoryId && categories.length) setForm((f) => ({ ...f, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const isMeeting = form.kind === 'meeting';
  const isRepeat = form.repeat !== 'once';
  const dates = datesFor(form);

  async function submit() {
    const msg = validateTicket(form);
    if (msg) { setError(msg); return; }
    setSaving(true);
    try {
      const n = await createTickets(form);
      onCreated(n);
    } catch (err) {
      setError(err.message || '저장에 실패했어요.');
      setSaving(false);
    }
  }

  let periodHint = '시작 날짜와 끝 날짜를 골라 주세요';
  if (form.from && form.to) {
    periodHint = form.to < form.from
      ? '끝 날짜가 시작 날짜보다 빨라요'
      : `${fmtDay(form.from)} ~ ${fmtDay(form.to)} · 총 ${Math.round((parseDate(form.to) - parseDate(form.from)) / 86400000) + 1}일`;
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tm-title">
        <div className="modal-head">
          <h2 id="tm-title">{isMeeting ? '미팅 만들기' : '할 일 만들기'}</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}><I.Close /></button>
        </div>

        <div className="modal-body">
          <Choice value={form.kind} onChange={(v) => set('kind', v)} big
            options={[{ v: 'task', label: '할 일' }, { v: 'meeting', label: '미팅' }]} label="종류" />

          <Field label="제목" htmlFor="tm-t">
            <input id="tm-t" autoFocus value={form.title} placeholder="무엇을 할까요?" onChange={(e) => set('title', e.target.value)} />
          </Field>

          <div className="field">
            <span className="label">카테고리</span>
            <div className="wrap">
              {categories.map((c) => {
                const p = PALETTE[c.colorIndex] || PALETTE[0];
                const on = form.categoryId === c.id;
                return (
                  <button key={c.id} aria-pressed={on} className={'chip' + (on ? ' on' : '')}
                    style={on ? { borderColor: p.color, background: p.soft, color: p.color } : undefined}
                    onClick={() => set('categoryId', c.id)}>
                    {c.name} <small>{c.key}</small>
                  </button>
                );
              })}
              <button className="chip dashed" onClick={onOpenCategories}><I.Plus size={12} /> 새 카테고리</button>
            </div>
          </div>

          <Field label="설명" htmlFor="tm-d">
            <textarea id="tm-d" rows={3} value={form.desc} placeholder="예: 주간 보고서 정리해서 금요일 회의 전에 공유하기" onChange={(e) => set('desc', e.target.value)} />
          </Field>

          <div className="field">
            <label className="label" htmlFor="tm-check">체크리스트 <span className="muted">(선택)</span></label>
            {form.checklist.length > 0 && (
              <ul className="check-edit">
                {form.checklist.map((text, i) => (
                  <li key={i} className="row">
                    <span className="box" aria-hidden="true" />
                    <input aria-label={`항목 ${i + 1}`} value={text} onChange={(e) => editItem(i, e.target.value)} />
                    <button className="icon-btn small" aria-label={`항목 ${i + 1} 지우기`} onClick={() => removeItem(i)}><I.Close size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <input id="tm-check" value={newItem} placeholder="해야 할 일을 쓰고 Enter (예: 지난주 숫자 모으기)"
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addItem(); } }} />
              <button className="btn outline small" onClick={addItem}><I.Plus size={12} /> 추가</button>
            </div>
            {isRepeat && <small className="muted">반복 티켓마다 체크리스트가 따로 생겨요. 오늘 체크해도 다른 날은 그대로예요.</small>}
          </div>

          <Choice label="반복 (기간 안의 날짜마다 티켓 만들기)" value={form.repeat} onChange={(v) => set('repeat', v)}
            options={[{ v: 'once', label: '한 번만' }, { v: 'daily', label: '매일' }, { v: 'weekly', label: '매주 (요일)' }]} />

          {form.repeat === 'weekly' && (
            <div className="wrap" role="group" aria-label="반복할 요일">
              {DAY_ORDER.map((i) => (
                <button key={i} className={'day-toggle' + (form.days[i] ? ' on' : '')} aria-pressed={form.days[i]}
                  aria-label={DAY_NAMES[i] + '요일'}
                  onClick={() => { const ds = form.days.slice(); ds[i] = !ds[i]; set('days', ds); }}>
                  {DAY_NAMES[i]}
                </button>
              ))}
            </div>
          )}

          {isMeeting && !isRepeat && (
            <Field label="미팅 날짜" htmlFor="tm-date">
              <input id="tm-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          )}

          {isRepeat && (
            <div className="field">
              <span className="label">기간 (며칠부터 며칠까지)</span>
              <div className="row">
                <input aria-label="시작 날짜" type="date" value={form.from} onChange={(e) => set('from', e.target.value)} />
                <span className="muted">~</span>
                <input aria-label="끝나는 날짜" type="date" value={form.to} onChange={(e) => set('to', e.target.value)} />
              </div>
              <small className="muted">{periodHint} · 날짜마다 티켓이 하나씩 생겨요</small>
            </div>
          )}

          {isMeeting ? (
            <div className="field">
              <Choice label="시간" value={form.allDay ? 'all' : 'time'} onChange={(v) => set('allDay', v === 'all')}
                options={[{ v: 'all', label: '하루 종일' }, { v: 'time', label: '시간 지정' }]} />
              {!form.allDay && (
                <div className="row">
                  <input aria-label="시작 시간" type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
                  <span className="muted">~</span>
                  <input aria-label="끝나는 시간" type="time" value={form.end} onChange={(e) => set('end', e.target.value)} />
                </div>
              )}
            </div>
          ) : (
            <div className="field">
              <Choice label="데드라인 (선택)" value={form.hasDeadline ? 'yes' : 'no'}
                onChange={(v) => setForm((f) => ({ ...f, hasDeadline: v === 'yes', deadline: v === 'yes' && !f.deadline ? f.date : f.deadline }))}
                options={[{ v: 'no', label: '없음' }, { v: 'yes', label: '날짜 정하기' }]} />
              {form.hasDeadline && (
                <div className="row">
                  <input aria-label="데드라인 날짜" type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
                  <input aria-label="데드라인 시간" type="time" className="narrow" value={form.deadlineTime} onChange={(e) => set('deadlineTime', e.target.value)} />
                  <span className="muted">까지</span>
                </div>
              )}
            </div>
          )}

          <Choice label="우선순위" value={form.priority} onChange={(v) => set('priority', v)}
            options={[{ v: 'high', label: '높음' }, { v: 'mid', label: '보통' }, { v: 'low', label: '낮음' }]} />

          {isRepeat && (
            <div className="preview">
              <strong>티켓 {dates.length}개가 만들어져요</strong>
              <small>
                {dates.length
                  ? dates.slice(0, 4).map(fmtDay).join(', ') + (dates.length > 4 ? ` ... ${fmtDay(dates[dates.length - 1])}까지` : '')
                  : '기간이나 요일을 골라 주세요'}
              </small>
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={saving} onClick={submit}>추가</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function Choice({ label, value, onChange, options, big }) {
  return (
    <div className="field">
      {label && <span className="label">{label}</span>}
      <div className={'choice' + (big ? ' big' : '')} role="group" aria-label={label}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button key={o.v} aria-pressed={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
