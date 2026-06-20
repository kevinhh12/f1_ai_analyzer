const TYRES: Record<string, string> = {
  S: '#ff2e2e', M: '#ffd400', H: '#f3f3f3', I: '#00d27a', W: '#2bb6ff',
};
const TYRE_NAMES: Record<string, string> = {
  S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTER', W: 'WET',
};

interface Props {
  code: string;
  name: string;
  team: string;
  color: string;
  num: string;
  img?: string;
  usedCompounds: string[];
  bestLap?: string;
  position: number;
  gap: string;
}

export default function DriverInfoCard({ code, name, team, color, num, img, usedCompounds, bestLap, position, gap }: Props) {
  return (
    <div className="di-card">
      {/* Driver header */}
      <div className="di-card__header">
        <div className="di-card__photo-wrap" style={{ borderColor: color }}>
          {img ? (
            <img className="di-card__photo" src={img} alt={code} />
          ) : (
            <div className="di-card__photo-placeholder">{code}</div>
          )}
        </div>
        <div className="di-card__info">
          <div className="di-card__name">{name}</div>
          <div className="di-card__team" style={{ color }}>{team.toUpperCase()}</div>
          <div className="di-card__num" style={{ color }}>#{num}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="di-card__stats">
        <div className="di-card__stat">
          <span className="di-card__stat-label">POS</span>
          <span className="di-card__stat-value">{position}</span>
        </div>
        <div className="di-card__stat">
          <span className="di-card__stat-label">GAP</span>
          <span className="di-card__stat-value">{gap}</span>
        </div>
        <div className="di-card__stat">
          <span className="di-card__stat-label">BEST</span>
          <span className="di-card__stat-value">{bestLap ?? '—'}</span>
        </div>
      </div>

      {/* Tyre stints */}
      <div className="di-card__tyres">
        <span className="di-card__tyres-label">STINTS</span>
        <div className="di-card__tyres-list">
          {usedCompounds.map((t, i) => (
            <span
              key={i}
              className="di-card__tyre"
              style={{
                background: TYRES[t],
                color: t === 'M' || t === 'H' ? '#0a0b0d' : '#fff',
              }}
            >
              {TYRE_NAMES[t] ?? t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
