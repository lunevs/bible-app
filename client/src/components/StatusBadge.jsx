export function StatusBadge({ status, size = 22 }) {
  const map = {
    green: { cls: 'status-green', sym: '✓', title: 'Прочитано вовремя' },
    blue: { cls: 'status-blue', sym: '✓', title: 'Прочитано позже' },
    missed: { cls: 'status-missed', sym: '✕', title: 'Пропущено' },
    empty: { cls: 'status-empty', sym: '', title: 'До начала участия' },
    neutral: { cls: 'status-neutral', sym: '', title: 'Сегодня или позже' },
  };
  const s = map[status] || map.neutral;
  return (
    <span
      className={`status-dot ${s.cls}`}
      title={s.title}
      style={{ width: size, height: size }}
    >
      {s.sym}
    </span>
  );
}

export function Legend() {
  return (
    <div className="card-soft p-3 mb-3">
      <div className="legend-item">
        <StatusBadge status="green" /> прочитано вовремя (1 балл)
      </div>
      <div className="legend-item">
        <StatusBadge status="blue" /> прочитано позже (0,5 балла)
      </div>
      <div className="legend-item">
        <StatusBadge status="missed" /> пропущено (0 баллов)
      </div>
      <div className="legend-item">
        <StatusBadge status="neutral" /> сегодня или в будущем
      </div>
      <div className="legend-item">
        <StatusBadge status="empty" /> до начала участия
      </div>
    </div>
  );
}
