'use client';

import { useState, useRef, useEffect } from 'react';
import { GLOSSARY } from '@/lib/glossary';

export default function GlossaryPopover({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY.find(g => g.term === term);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!entry) return <>{children}</>;

  return (
    <span ref={ref} className="glossary-pop-wrap" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}>
      <span className="glossary-pop-trigger">{children}<span className="glossary-pop-icon">ⓘ</span></span>

      {open && (
        <div className="glossary-popover">
          <div className="glossary-pop-header">
            <span className="glossary-pop-term">{entry.term}</span>
            <span className="glossary-pop-cat">{entry.category}</span>
          </div>
          <p className="glossary-pop-desc">{entry.definition}</p>
        </div>
      )}
    </span>
  );
}
