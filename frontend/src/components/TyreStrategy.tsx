import { type Driver, type Result, type TyreCompound } from '../data';

const TYRE_COLORS: Record<TyreCompound, string> = {
  S: '#ff2e2e',
  M: '#ffd400',
  H: '#f3f3f3',
  I: '#00d27a',
  W: '#2bb6ff',
};
const TYRE_NAMES: Record<TyreCompound, string> = {
  S: 'SOFT',
  M: 'MEDIUM',
  H: 'HARD',
  I: 'INTER',
  W: 'WET',
};

interface Stint {
  t: TyreCompound;
  len: number;
}

interface Props {
  results: Result[];
  drivers: Driver[];
  totalLaps: number;
  selectedCode: string;
  onSelect: (code: string) => void;
}

// Tyre strategy — horizontal stint bars per driver (Gantt-style)
export default function TyreStrategy({ results, drivers, totalLaps, selectedCode, onSelect }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  function stints(tyres: TyreCompound[]): Stint[] {
    const base = Math.floor(totalLaps / tyres.length);
    let used = 0;
    return tyres.map((t, i) => {
      const len = i === tyres.length - 1 ? totalLaps - used : base + (i % 2 === 0 ? 4 : -3);
      used += len;
      return { t, len };
    });
  }

  return (
    <section id="tyre-strategy">
      <div className="panel-head">
        <span className="panel-eb">TYRE STRATEGY</span>
        <span className="panel-meta">STINTS BY DRIVER · LAP 1 — {totalLaps}</span>
      </div>
      <div className="strat">
        {results.slice(0, 8).map(r => {
          const d = byCode[r.code] ?? { team: '—', color: '#9ea2ac', name: '', num: r.num, code: r.code };
          const sel = r.code === selectedCode;
          const segs = stints(r.tyres);
          return (
            <button key={r.code}
                    className={"strat-row" + (sel ? " sel" : "")}
                    onClick={() => onSelect(r.code)}>
              <span className="strat-pos">P{r.pos}</span>
              <span className="strat-team" style={{ background: d.color }} />
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
        {(['S', 'M', 'H', 'I', 'W'] as TyreCompound[]).map(t => (
          <span key={t} className="legend-item">
            <span className="legend-dot" style={{ borderColor: TYRE_COLORS[t] }} />
            {TYRE_NAMES[t]}
          </span>
        ))}
      </div>
    </section>
  );
}
