'use client';

import { useEffect, useMemo, useState } from 'react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '@/lib/glossary';

export default function GlossaryModal() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GLOSSARY.filter(t => {
      const matchesCategory = !category || t.category === category;
      const matchesSearch = !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const grouped = useMemo(() => {
    return GLOSSARY_CATEGORIES.map(c => ({
      category: c,
      terms: filtered.filter(t => t.category === c),
    })).filter(g => g.terms.length > 0);
  }, [filtered]);

  return (
    <>
      <button type="button" className="glossary-modal-trigger" onClick={() => setOpen(true)}>
        📖 用語集
      </button>

      {open && (
        <div className="glossary-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="glossary-modal" onClick={e => e.stopPropagation()}>
            <div className="glossary-modal-header">
              <h3>用語集</h3>
              <button type="button" className="glossary-modal-close" onClick={() => setOpen(false)} aria-label="閉じる">✕</button>
            </div>

            <div className="glossary-toolbar">
              <input
                type="search"
                placeholder="用語を検索"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              <div className="glossary-cat-filter">
                <button className={category === '' ? 'active' : ''} onClick={() => setCategory('')}>すべて</button>
                {GLOSSARY_CATEGORIES.map(c => (
                  <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="glossary-modal-body">
              {grouped.length === 0 && <p className="glossary-empty">該当する用語が見つかりませんでした。</p>}
              {grouped.map(g => (
                <div key={g.category} className="glossary-group">
                  <h3>{g.category}</h3>
                  <dl className="glossary-list">
                    {g.terms.map(t => (
                      <div key={t.term} className="glossary-item">
                        <dt>{t.term}</dt>
                        <dd>{t.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
