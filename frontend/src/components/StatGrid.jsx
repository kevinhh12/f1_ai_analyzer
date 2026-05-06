// Three stat tiles + a tyre legend chip row.
export default function StatGrid({ leader }) {
  return (
    <div className="stat-grid">
      <div className="stat-card" style={{borderLeftColor:'#3671c6'}}>
        <div className="stat-lbl">FASTEST LAP</div>
        <div className="stat-row">
          <div className="stat-v">1:14.260</div>
          <div className="stat-delta">−0.118</div>
        </div>
        <div className="stat-sub">{leader.code} · LAP 47 · MEDIUM</div>
      </div>

      <div className="stat-card">
        <div className="stat-lbl">PIT STOPS</div>
        <div className="stat-v">14</div>
        <div className="stat-sub">AVG 2.41s · FASTEST 2.04s</div>
      </div>

      <div className="stat-card">
        <div className="stat-lbl">OVERTAKES</div>
        <div className="stat-v">17</div>
        <div className="stat-sub">DRS 11 · NON-DRS 6</div>
      </div>

      <div className="stat-card">
        <div className="stat-lbl">SAFETY CAR</div>
        <div className="stat-v">2</div>
        <div className="stat-sub">VSC L18–22 · SC L41–44</div>
      </div>
    </div>
  );
};
