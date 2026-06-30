'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '@/lib/glossary';

export default function Glossary() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

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
    <section className="glossary-page">
      <div className="detail-wrap">
        <Link className="back-link" href="/">← ダッシュボードへ戻る</Link>

        <div className="section-heading">
          <div>
            <p className="eyebrow dark">NBA GLOSSARY</p>
            <h2>用語集</h2>
          </div>
          <p>サラリーキャップ・契約・トレードに関する用語を{GLOSSARY.length}個まとめました。</p>
        </div>

        <div className="glossary-toolbar">
          <input
            type="search"
            placeholder="用語を検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="glossary-cat-filter">
            <button className={category === '' ? 'active' : ''} onClick={() => setCategory('')}>すべて</button>
            {GLOSSARY_CATEGORIES.map(c => (
              <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        </div>

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
    </section>
  );
}
