import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Section = { id: string; label: string; content: ReactNode };
/** Abas internas: setas/Home/End movem foco e seleção; painéis mantêm seus dados. */
export function SectionTabs({ label, sections, selectedId, onSelect }: { label: string; sections: readonly Section[]; selectedId?: string; onSelect?: (id: string) => void }) {
  const prefix = useId();
  const [internal, setInternal] = useState(sections[0]?.id ?? '');
  const selected = selectedId ?? internal;
  const setSelected = (id: string) => { setInternal(id); onSelect?.(id); };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="section-tabs">
    <div className="section-tabs__list" role="tablist" aria-label={label}>
      {sections.map((section, index) => <button key={section.id} ref={(node) => { buttons.current[index] = node; }}
        type="button" role="tab" id={`${prefix}-tab-${section.id}`} aria-controls={`${prefix}-panel-${section.id}`}
        aria-selected={selected === section.id} tabIndex={selected === section.id ? 0 : -1}
        onClick={() => setSelected(section.id)} onKeyDown={(event) => {
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % sections.length;
          else if (event.key === 'ArrowLeft') next = (index - 1 + sections.length) % sections.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = sections.length - 1;
          else return;
          event.preventDefault(); setSelected(sections[next]!.id); buttons.current[next]?.focus();
        }}>{section.label}</button>)}
    </div>
    {sections.map((section) => <div key={section.id} role="tabpanel" id={`${prefix}-panel-${section.id}`}
      aria-labelledby={`${prefix}-tab-${section.id}`} hidden={selected !== section.id} tabIndex={0}>{section.content}</div>)}
  </div>;
}
