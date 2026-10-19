import { useEffect, useRef, useState } from 'react';

// Текст заметки сворачивается до четырёх строк и раскрывается по запросу.
export default function CollapsibleNoteText({ text, className = '' }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const check = () => setOverflow(el.scrollHeight - el.clientHeight > 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text, expanded]);

  return (
    <div className={`note-wrap ${className}`.trim()}>
      <div ref={ref} className={`note-text ${expanded ? '' : 'clamp-lines'}`}>
        {text}
      </div>
      {expanded ? (
        <button type="button" className="clamp-toggle" onClick={() => setExpanded(false)}>
          свернуть
        </button>
      ) : overflow ? (
        <button type="button" className="clamp-toggle clamp-more" onClick={() => setExpanded(true)}>
          ещё
        </button>
      ) : null}
    </div>
  );
}