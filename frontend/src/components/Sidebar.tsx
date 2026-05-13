import { type Race } from '../data';

interface Props {
  races: Race[];
  activeRound: number;
  activeYear: number;
  onPick: (race: Race) => void;
}

export default function Sidebar({ races, activeRound, activeYear, onPick }: Props) {
  const filteredRaces = races.filter(r => r.year === activeYear);

  return (
    <aside className="sidebar">
      <div className="rail-eb">{activeYear} SEASON</div>
      <div className="rail-list">
        {filteredRaces.map(r => (
          <button
            key={r.round}
            className={"rail-item" + (r.round === activeRound && r.year === activeYear ? " active" : "")}
            onClick={() => onPick(r)}
          >
            <span className="rd">R{String(r.round).padStart(2, '0')}</span>
            <span className="nm">{r.name}</span>
            <span className="dt">{r.date}</span>
          </button>
        ))}
      </div>

      <div className="rail-eb" style={{ marginTop: 24 }}>VIEWS</div>
      <div className="rail-views">
        <button className="rail-view active">CLASSIFICATION</button>
        <button className="rail-view">LAP CHART</button>
        <button className="rail-view">TYRE STRATEGY</button>
        <button className="rail-view">TELEMETRY</button>
        <button className="rail-view">PIT STOPS</button>
      </div>
    </aside>
  );
}