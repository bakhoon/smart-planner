import { useEffect, useState } from 'react';
import { PALETTE, code, validateTicket, createTicket, sprintKey, sprintMonday, sprintOf, sprintEnd, dayIndexOf } from './db.js';
import { addDays, fmtDay, weekdayLong, weekdayName } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

// Monday-first weekday numbers for weekdayName (0 = Sunday in JS dates)
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function TicketModal({ categories, sprint, pickDay, defaultDate, defaultKind, defaultStart, defaultEnd, defaultCategoryId, onClose, onCreated, onOpenCategories }) {
  const [form, setForm] = useState(() => {
    const days = [false, false, false, false, false, false, false];
    // opened from a weekday column: that day is picked already
    if (pickDay && defaultDate && sprintOf(defaultDate) === sprint) days[dayIndexOf(defaultDate)] = true;
    return {
      kind: defaultKind || 'task',
      title: '',
      desc: '',
      categoryId: defaultCategoryId || null,
      sprint,
      days,
      repeat: 'none',
      every: 1,
      until: sprintKey(addDays(sprintMonday(sprint), 21)),
      date: defaultDate,
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [keepOpen, setKeepOpen] = useState(() => { try { return localStorage.getItem('planner-keep-open') === '1'; } catch (e) { return false; } });
  const [made, setMade] = useState(null);
  const changeKeepOpen = (v) => { setKeepOpen(v); try { localStorage.setItem('planner-keep-open', v ? '1' : '0'); } catch (e) { /* ignore */ } };

  useEffect(() => {
    if (!form.categoryId && categories.length) setForm((f) => ({ ...f, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); setMade(null); };
  const isMeeting = form.kind === 'meeting';
  const monday = sprintMonday(form.sprint);
  const moveSprint = (n) => set('sprint', sprintKey(addDays(monday, 7 * n)));

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, text] }));
    setNewItem('');
  };
  const editItem = (i, text) => setForm((f) => ({ ...f, checklist: f.checklist.map((x, k) => (k === i ? text : x)) }));
  const removeItem = (i) => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, k) => k !== i) }));

  async function submit() {
    const msg = validateTicket(form);
    if (msg) { setError(msg); return; }
    setSaving(true);
    try {
      const info = await createTicket(form);
      onCreated(info, keepOpen);
      if (keepOpen) {
        // stay open with every field as it was, ready for the next one
        setMade(info);
        setSaving(false);
      }
    } catch (err) {
      setError(err.message || tr('저장에 실패했어요.'));
      setSaving(false);
    }
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
          </div>

          {isMeeting ? (
            <>
              <Field label={tr('미팅 날짜')} htmlFor="tm-date">
                <input id="tm-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
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
              <RepeatPicker form={form} set={set} base={form.date ? sprintOf(form.date) : sprint}
                hint={tr('반복하면 다음 스프린트에도 같은 요일, 같은 시간으로 생겨요')} />
            </>
          ) : (
            <>
              <div className="field">
                <span className="label">{tr('스프린트')}</span>
                <div className="sprint-pick">
                  <button className="icon-btn small" aria-label={tr('이전 스프린트')} onClick={() => moveSprint(-1)}><I.ChevronLeft /></button>
                  <span className="grow">
                    <strong>{form.sprint}</strong>
                    <small className="muted block">{fmtDay(form.sprint.slice(7))} ~ {fmtDay(sprintEnd(form.sprint))}</small>
                  </span>
                  <button className="icon-btn small" aria-label={tr('다음 스프린트')} onClick={() => moveSprint(1)}><I.ChevronRight /></button>
                </div>
              </div>

              <div className="field">
                <span className="label">{tr('할 요일')} <span className="muted">{tr('(선택)')}</span></span>
                <div className="wrap" role="group" aria-label={tr('할 요일')}>
                  {MON_FIRST.map((wd, i) => (
                    <button key={i} className={'day-toggle' + (form.days[i] ? ' on' : '')} aria-pressed={form.days[i]}
                      aria-label={weekdayLong(wd)}
                      onClick={() => { const ds = form.days.slice(); ds[i] = !ds[i]; set('days', ds); }}>
                      {weekdayName(wd)}
                    </button>
                  ))}
                  <button className="chip dashed" onClick={() => set('days', form.days.every(Boolean) ? form.days.map(() => false) : form.days.map(() => true))}>
                    {form.days.every(Boolean) ? tr('모두 해제') : tr('매일')}
                  </button>
                </div>
                <small className="muted">{tr('고른 요일마다 카드에 체크칸이 생겨요. 안 골라도 돼요.')}</small>
              </div>

              <div className="field">
                <Choice label={tr('데드라인')} value={form.hasDeadline ? 'yes' : 'no'}
                  onChange={(v) => setForm((f) => ({ ...f, hasDeadline: v === 'yes', deadline: v === 'yes' && !f.deadline ? sprintEnd(f.sprint) : f.deadline }))}
                  options={[
                    { v: 'no', label: tr('스프린트 끝 ({d})', { d: fmtDay(sprintEnd(form.sprint)) }) },
                    { v: 'yes', label: tr('날짜 정하기') },
                  ]} />
                {form.hasDeadline && (
                  <div className="row">
                    <input aria-label={tr('데드라인 날짜')} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
                    <input aria-label={tr('데드라인 시간')} type="time" className="narrow" value={form.deadlineTime} onChange={(e) => set('deadlineTime', e.target.value)} />
                    <span className="muted">{tr('까지')}</span>
                  </div>
                )}
              </div>

              <RepeatPicker form={form} set={set} base={form.sprint}
                hint={tr('반복하면 스프린트마다 같은 티켓이 새로 생겨요. 요일 체크는 비워진 채로 시작해요.')} />
            </>
          )}

          <Choice label={tr('우선순위')} value={form.priority} onChange={(v) => set('priority', v)}
            options={[{ v: 'high', label: tr('높음') }, { v: 'mid', label: tr('보통') }, { v: 'low', label: tr('낮음') }]} />

          {error && <p className="error" role="alert">{error}</p>}
        </div>

        {made && (
          <div className="made-note" role="status">
            <I.CheckMark size={14} /> {tr('{c} 만들었어요. 내용은 그대로 있어요.', { c: code(made.key, made.number) })}
          </div>
        )}
        <div className="modal-foot spread">
          <label className="keep-open">
            <input type="checkbox" checked={keepOpen} onChange={(e) => changeKeepOpen(e.target.checked)} />
            {tr('만든 뒤에도 창 닫지 않기')}
          </label>
          <span className="row">
            <button className="btn ghost" onClick={onClose}>{keepOpen ? tr('닫기') : tr('취소')}</button>
            <button className="btn primary" disabled={saving} onClick={submit}>{tr('추가')}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

// Repeat across sprints: none / keep going / until a sprint, every week or every 2 weeks
function RepeatPicker({ form, set, base, hint }) {
  const until = form.until < base ? base : form.until;
  const count = Math.floor((sprintMonday(until) - sprintMonday(base)) / (7 * 86400000 * form.every)) + 1;
  const moveUntil = (n) => {
    const next = sprintKey(addDays(sprintMonday(until), 7 * n));
    if (next >= base) set('until', next);
  };
  return (
    <div className="field repeat-box">
      <Choice label={tr('스프린트 반복')} value={form.repeat} onChange={(v) => set('repeat', v)}
        options={[{ v: 'none', label: tr('반복 안 함') }, { v: 'forever', label: tr('계속') }, { v: 'until', label: tr('정한 스프린트까지') }]} />
      {form.repeat !== 'none' && (
        <Choice label={tr('간격')} value={String(form.every)} onChange={(v) => set('every', Number(v))}
          options={[{ v: '1', label: tr('매주') }, { v: '2', label: tr('2주마다') }]} />
      )}
      {form.repeat === 'until' && (
        <div className="field">
          <span className="label">{tr('마지막 스프린트')}</span>
          <div className="sprint-pick">
            <button className="icon-btn small" aria-label={tr('이전 스프린트')} onClick={() => moveUntil(-1)}><I.ChevronLeft /></button>
            <span className="grow">
              <strong>{until}</strong>
              <small className="muted block">{fmtDay(until.slice(7))} ~ {fmtDay(sprintEnd(until))} · {tr('티켓 {n}개', { n: count })}</small>
            </span>
            <button className="icon-btn small" aria-label={tr('다음 스프린트')} onClick={() => moveUntil(1)}><I.ChevronRight /></button>
          </div>
        </div>
      )}
      {form.repeat !== 'none' && <small className="muted">{hint}</small>}
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

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="grow">
        <strong>{label}</strong>
        {hint && <small className="muted block">{hint}</small>}
      </span>
    </label>
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

