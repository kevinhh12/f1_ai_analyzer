// Left rail — race list with the focused race highlighted.
export default function Sidebar({ races, activeRound, onPick }) {
  return (
    <aside className="sidebar">
      <div className="rail-eb">2023 SEASON</div>
      <div className="rail-list">
        {races.map(r => (
          <button
            key={r.round}
            className={"rail-item" + (r.round === activeRound ? " active" : "")}
            onClick={() => onPick(r)}
          >
            <span className="rd">R{String(r.round).padStart(2,'0')}</span>
            <span className="nm">{r.name}</span>
            <span className="dt">{r.date}</span>
          </button>
        ))}
      </div>

      <div className="rail-eb" style={{marginTop:24}}>VIEWS</div>
      <div className="rail-views">
        <button className="rail-view active">CLASSIFICATION</button>
        <button className="rail-view">LAP CHART</button>
        <button className="rail-view">TYRE STRATEGY</button>
        <button className="rail-view">TELEMETRY</button>
        <button className="rail-view">PIT STOPS</button>
      </div>
    </aside>
  );
};
