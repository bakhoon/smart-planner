import { useEffect, useState } from 'react';
import { tr } from './i18n.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PALETTE, code, cleanKey, saveCategory, deleteCategory } from './db.js';
import * as I from './icons.jsx';

const blank = (n) => ({ id: null, name: '', key: '', colorIndex: n % PALETTE.length });

export default function CategoryModal({ categories, onClose }) {
  const [form, setForm] = useState(() => blank(categories.length));
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const counts = useLiveQuery(async () => {
    const out = {};
    for (const c of categories) out[c.id] = await db.tickets.where('categoryId').equals(c.id).count();
    return out;
  }, [categories], {});

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = PALETTE[form.colorIndex];

  async function save() {
    try {
      await saveCategory(form);
      setForm(blank(categories.length + (form.id ? 0 : 1)));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cm-title">
        <div className="modal-head">
          <div>
            <h2 id="cm-title">{tr('카테고리 설정')}</h2>
            <small className="muted">{tr('이름, 키, 색을 정하거나 바꿀 수 있어요')}</small>
          </div>
          <button className="icon-btn" aria-label={tr('닫기')} onClick={onClose}><I.Close /></button>
        </div>

        <div className="modal-body">
          <div className="cat-form">
            <strong>{form.id ? tr('카테고리 편집') : tr('새 카테고리')}</strong>
            <div className="row">
              <div className="field grow">
                <label className="label" htmlFor="cm-name">{tr('이름')}</label>
                <input id="cm-name" value={form.name} placeholder={tr('예: 회사')} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cm-key">{tr('키 (작은 표시)')}</label>
                <input id="cm-key" className="key-input" value={form.key} placeholder="WRK" maxLength={6}
                  onChange={(e) => { setForm({ ...form, key: cleanKey(e.target.value) }); setError(''); }} />
              </div>
            </div>
            <div className="field">
              <span className="label">{tr('색깔')}</span>
              <div className="wrap" role="group" aria-label={tr('색깔')}>
                {PALETTE.map((sw, i) => (
                  <button key={sw.name} className="swatch" aria-label={tr(sw.name)} aria-pressed={form.colorIndex === i}
                    style={{ background: sw.soft, borderColor: form.colorIndex === i ? sw.color : 'transparent' }}
                    onClick={() => setForm({ ...form, colorIndex: i })}>
                    <span style={{ background: sw.color }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <span className="tag" style={{ background: p.soft, color: p.color }}>{form.name.trim() || tr('카테고리 이름')}</span>
              <small className="muted">{tr('번호 예시 {c}', { c: code(form.key || 'WRK', 1) })}</small>
              <span className="grow" />
              {form.id && <button className="btn ghost small" onClick={() => setForm(blank(categories.length))}>{tr('새로 만들기')}</button>}
              <button className="btn primary small" onClick={save}>{form.id ? tr('저장') : tr('추가')}</button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </div>

          {categories.length === 0 && <p className="muted center">{tr('아직 카테고리가 없어요')}</p>}
          {categories.map((c) => {
            const cp = PALETTE[c.colorIndex] || PALETTE[0];
            const n = counts[c.id] || 0;
            return (
              <div key={c.id} className="cat-item">
                <div className="row">
                  <span className="key-badge" style={{ background: cp.soft, color: cp.color }}>{c.key}</span>
                  <span className="grow">
                    <strong>{c.name}</strong>
                    <small className="muted block">{tr('번호 예시 {c} · 티켓 {n}개', { c: code(c.key, 1), n })}</small>
                  </span>
                  <button className="btn outline small" onClick={() => { setForm({ id: c.id, name: c.name, key: c.key, colorIndex: c.colorIndex }); setError(''); }}>{tr('편집')}</button>
                  <button className="btn danger-outline small" onClick={() => setConfirmId(c.id)}>{tr('삭제')}</button>
                </div>
                {confirmId === c.id && (
                  <div className="confirm" role="alert">
                    <span className="grow">{n ? tr('이 카테고리의 티켓 {n}개도 같이 지워져요. 정말 지울까요?', { n }) : tr('이 카테고리를 지울까요?')}</span>
                    <button className="btn ghost small" onClick={() => setConfirmId(null)}>{tr('취소')}</button>
                    <button className="btn danger small" onClick={() => { deleteCategory(c.id); setConfirmId(null); }}>{tr('지우기')}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>{tr('완료')}</button>
        </div>
      </div>
    </div>
  );
}
