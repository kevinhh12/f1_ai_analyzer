// Tyre strategy — horizontal stint bars per driver (Gantt-style)
const TYRE_COLORS = { S:'#ff2e2e', M:'#ffd400', H:'#f3f3f3', I:'#00d27a', W:'#2bb6ff' };
const TYRE_NAMES  = { S:'SOFT',    M:'MEDIUM', H:'HARD',    I:'INTER',   W:'WET' };

export default function TyreStrategy({ results, drivers, totalLaps, selectedCode, onSelect }) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  // Synth stint lengths per driver from their tyres array (totals to ~totalLaps)
  function stints(tyres) {
    const base = Math.floor(totalLaps / tyres.length);
    let used = 0;
    return tyres.map((t, i) => {
      const len = i === tyres.length - 1 ? totalLaps - used : base + (i % 2 === 0 ? 4 : -3);
      used += len;
      return { t, len };
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-eb">TYRE STRATEGY</span>
        <span className="panel-meta">STINTS BY DRIVER · LAP 1 — {totalLaps}</span>
      </div>
      <div className="strat">
        {results.slice(0, 8).map(r => {
          const d = byCode[r.code] || { team:'—', color:'#9ea2ac', name:'' };
          const sel = r.code === selectedCode;
          const segs = stints(r.tyres);
          return (
            <button key={r.code}
                    className={"strat-row" + (sel ? " sel" : "")}
                    onClick={() => onSelect(r.code)}>
              <span className="strat-pos">P{r.pos}</span>
              <span className="strat-team" style={{background: d.color}} />
              <span className="strat-code">{r.code}</span>
              <span className="strat-bar">
                {segs.map((s, i) => (
                  <span key={i} className="strat-seg"
                        title={`${TYRE_NAMES[s.t]} · ${s.len} laps`}
                        style={{
                          flex: s.len,
                          background: TYRE_COLORS[s.t],
                          color: s.t === 'M' || s.t === 'H' ? '#0a0b0d' : '#fff',
                        }}>
                    <span className="strat-seg-lbl">{TYRE_NAMES[s.t]}</span>
                    <span className="strat-seg-len">{s.len}L</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="strat-legend">
        {['S','M','H','I','W'].map(t => (
          <span key={t} className="legend-item">
            <span className="legend-dot" style={{borderColor: TYRE_COLORS[t]}} />
            {TYRE_NAMES[t]}
          </span>
        ))}
      </div>
    </section>
  );
};
