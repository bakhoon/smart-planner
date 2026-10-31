import { useEffect, useState } from 'react';
import { PALETTE, datesFor, validateTicket, createTickets } from './db.js';
import { addDays, fmtDay, fmtLong, parseDate, weekdayLong, weekdayName, ymd } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function TicketModal({ categories, defaultDate, defaultKind, defaultStart, defaultEnd, defaultCategoryId, onClose, onCreated, onOpenCategories }) {
  const [form, setForm] = useState(() => {
    const days = [false, false, false, false, false, false, false];
    days[parseDate(defaultDate).getDay()] = true;
    return {
      kind: defaultKind || 'task',
      title: '',
      desc: '',
      categoryId: defaultCategoryId || null,
      repeat: 'once',
      date: defaultDate,
      from: defaultDate,
      to: ymd(addDays(parseDate(defaultDate), 6)),
      days,
      allDay: false,
      start: defaultStart || '14:00',
      end: defaultEnd || '15:00',
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
      setError(err.message || tr('저장에 실패했어요.'));
      setSaving(false);
    }
  }

  let periodHint = tr('시작 날짜와 끝 날짜를 골라 주세요');
  if (form.from && form.to) {
    periodHint = form.to < form.from
      ? tr('끝 날짜가 시작 날짜보다 빨라요')
      : `${fmtDay(form.from)} ~ ${fmtDay(form.to)} · ${tr('총 {n}일', { n: Math.round((parseDate(form.to) - parseDate(form.from)) / 86400000) + 1 })}`;
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tm-title">
        <div className="modal-head">
          <h2 id="tm-title">{isMeeting ? tr('미팅 만들기') : tr('할 일 만들기')}</h2>
          <button className="icon-btn" aria-label={tr('닫기')} onClick={onClose}><I.Close /></button>
        </div>

        <div className="modal-body">
          <Choice value={form.kind} onChange={(v) => set('kind', v)} big
            options={[{ v: 'task', label: tr('할 일') }, { v: 'meeting', label: tr('미팅') }]} label={tr('종류')} />

          <Field label={tr('제목')} htmlFor="tm-t">
            <input id="tm-t" autoFocus value={form.title} placeholder={tr('무엇을 할까요?')} onChange={(e) => set('title', e.target.value)} />
          </Field>

          <div className="field">
            <span className="label">{tr('카테고리')}</span>
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
              <button className="chip dashed" onClick={onOpenCategories}><I.Plus size={12} /> {tr('새 카테고리')}</button>
            </div>
          </div>

          <Field label={tr('설명')} htmlFor="tm-d">
            <textarea id="tm-d" rows={3} value={form.desc} placeholder={tr('예: 주간 보고서 정리해서 금요일 회의 전에 공유하기')} onChange={(e) => set('desc', e.target.value)} />
          </Field>

          <div className="field">
            <label className="label" htmlFor="tm-check">{tr('체크리스트')} <span className="muted">{tr('(선택)')}</span></label>
            {form.checklist.length > 0 && (
              <ul className="check-edit">
                {form.checklist.map((text, i) => (
                  <li key={i} className="row">
                    <span className="box" aria-hidden="true" />
                    <input aria-label={tr('항목 {n}', { n: i + 1 })} value={text} onChange={(e) => editItem(i, e.target.value)} />
                    <button className="icon-btn small" aria-label={tr('항목 {n} 지우기', { n: i + 1 })} onClick={() => removeItem(i)}><I.Close size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <input id="tm-check" value={newItem} placeholder={tr('해야 할 일을 쓰고 Enter (예: 지난주 숫자 모으기)')}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addItem(); } }} />
              <button className="btn outline small" onClick={addItem}><I.Plus size={12} /> {tr('추가')}</button>
            </div>
            {isRepeat && <small className="muted">{tr('반복 티켓마다 체크리스트가 따로 생겨요. 오늘 체크해도 다른 날은 그대로예요.')}</small>}
          </div>

          <Choice label={tr('반복 (기간 안의 날짜마다 티켓 만들기)')} value={form.repeat} onChange={(v) => set('repeat', v)}
            options={[{ v: 'once', label: tr('한 번만') }, { v: 'daily', label: tr('매일') }, { v: 'weekly', label: tr('매주 (요일)') }]} />

          {form.repeat === 'weekly' && (
            <div className="wrap" role="group" aria-label={tr('반복할 요일')}>
              {DAY_ORDER.map((i) => (
                <button key={i} className={'day-toggle' + (form.days[i] ? ' on' : '')} aria-pressed={form.days[i]}
                  aria-label={weekdayLong(i)}
                  onClick={() => { const ds = form.days.slice(); ds[i] = !ds[i]; set('days', ds); }}>
                  {weekdayName(i)}
                </button>
              ))}
            </div>
          )}

          {!isRepeat && (
            <Field label={isMeeting ? tr('미팅 날짜') : tr('날짜 (보드에 들어갈 날)')} htmlFor="tm-date">
              <input id="tm-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          )}

          {isRepeat && (
            <div className="field">
              <span className="label">{tr('기간 (며칠부터 며칠까지)')}</span>
              <div className="row">
                <input aria-label={tr('시작 날짜')} type="date" value={form.from} onChange={(e) => set('from', e.target.value)} />
                <span className="muted">~</span>
                <input aria-label={tr('끝나는 날짜')} type="date" value={form.to} onChange={(e) => set('to', e.target.value)} />
              </div>
              <small className="muted">{periodHint} · {tr('날짜마다 티켓이 하나씩 생겨요')}</small>
            </div>
          )}

          {isMeeting ? (
            <div className="field">
              <Choice label={tr('시간')} value={form.allDay ? 'all' : 'time'} onChange={(v) => set('allDay', v === 'all')}
                options={[{ v: 'all', label: tr('하루 종일') }, { v: 'time', label: tr('시간 지정') }]} />
              {!form.allDay && (
                <div className="row">
                  <input aria-label={tr('시작 시간')} type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
                  <span className="muted">~</span>
                  <input aria-label={tr('끝나는 시간')} type="time" value={form.end} onChange={(e) => set('end', e.target.value)} />
                </div>
              )}
            </div>
          ) : (
            <div className="field">
              <Choice label={tr('데드라인 (선택)')} value={form.hasDeadline ? 'yes' : 'no'}
                onChange={(v) => setForm((f) => ({ ...f, hasDeadline: v === 'yes', deadline: v === 'yes' && !f.deadline ? f.date : f.deadline }))}
                options={[{ v: 'no', label: tr('없음') }, { v: 'yes', label: tr('날짜 정하기') }]} />
              {form.hasDeadline && (
                <div className="row">
                  <input aria-label={tr('데드라인 날짜')} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
                  <input aria-label={tr('데드라인 시간')} type="time" className="narrow" value={form.deadlineTime} onChange={(e) => set('deadlineTime', e.target.value)} />
                  <span className="muted">{tr('까지')}</span>
                </div>
              )}
            </div>
          )}

          <Choice label={tr('우선순위')} value={form.priority} onChange={(v) => set('priority', v)}
            options={[{ v: 'high', label: tr('높음') }, { v: 'mid', label: tr('보통') }, { v: 'low', label: tr('낮음') }]} />

          {isRepeat && (
            <div className="preview">
              <strong>{tr('티켓 {n}개가 만들어져요', { n: dates.length })}</strong>
              <small>
                {dates.length
                  ? dates.slice(0, 4).map(fmtDay).join(', ') + (dates.length > 4 ? ` ... ${tr('{d}까지', { d: fmtDay(dates[dates.length - 1]) })}` : '')
                  : tr('기간이나 요일을 골라 주세요')}
              </small>
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{tr('취소')}</button>
          <button className="btn primary" disabled={saving} onClick={submit}>{tr('추가')}</button>
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
