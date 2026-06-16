import { type Driver, type Result, type LapRanking, formatGap } from '../data';

const TYRES: Record<string, string> = {
  S: '#ff2e2e', M: '#ffd400', H: '#f3f3f3', I: '#00d27a', W: '#2bb6ff',
};

interface Props {
  results: Result[];
  drivers: Driver[];
  selectedCode: string;
  onSelect: (code: string) => void;
  rankings: LapRanking[];
  currentLap: number;
}

export default function Classification({ results, drivers, selectedCode, onSelect, rankings, currentLap }: Props) {
  // Build lookup tables for drivers and results by code for easy access
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));
  const resultByCode = Object.fromEntries(results.map(r => [r.code, r]));
  const teamLogoURL = (team: string) =>
    `https://media.formula1.com/image/upload/c_lfill,w_48/q_auto/v1740000001/common/f1/2026/${team.toLowerCase().replace(/\s/g, '')}/2026${team.toLowerCase().replace(/\s/g, '')}logowhite.webp`;

  // Live ranking at currentLap, fall back to final results order
  const currentLapIndex = currentLap - 1;
  const currentRanking = rankings[currentLapIndex];

  const rankedOrder: { code: string; pos: number; gapMs: number }[] = currentRanking
    ? currentRanking.order
    : results.map((r, i) => ({ code: r.code, pos: i + 1, gapMs: 0 }));

  // Append any drivers that exist in results but are missing from the live ranking
  // (drivers with no lap data: DNS, immediate DNF, data gaps)
  const rankedCodes = new Set(rankedOrder.map(o => o.code));
  const unrankedRows = results
    .filter(r => !rankedCodes.has(r.code))
    .map((r, i) => ({ code: r.code, pos: rankedOrder.length + i + 1, gapMs: -1 }));

  const liveOrder = [...rankedOrder, ...unrankedRows];

  return (
    <section id="classification" className='panel classification-scroll f1-hover'>
      <header className="cl-head">
        <span className="cl-h pos">POS</span>
        <span className="cl-h num">#</span>
        <span className="cl-h drv">DRIVER</span>
        <span className="cl-h tm">TEAM</span>
        <span className="cl-h best">BEST LAP</span>
        <span className="cl-h tyre">STINTS</span>
        <span className="cl-h stops">PITS</span>
        <span className="cl-h gap">GAP</span>
      </header>
      <div className="cl-body">
        {liveOrder.map(({ code, pos, gapMs }) => {
          const r = resultByCode[code];
          if (!r) return null;
          const driverInfo = byCode[code];
          let d;

          if (driverInfo) { // if driver info available, use it, if not return default value
            d = driverInfo;
          } else {
            d = {
              team: '—',
              color: '#3f434c',
              name: code,
              num: r.num,
              code: code,
            };
          }
          const sel = code === selectedCode; // whether this driver is currently selected
          const lead = pos === 1; // if this driver is leading, highlight them and show "P1" instead of position number
          return (
            <button
              key={code}
              className={"cl-row" + (lead ? " lead" : "") + (sel ? " sel" : "")}
              onClick={() => onSelect(code)}
              style={{ borderLeftColor: d.color }}
            >
              <span className="cl-h pos">{lead ? 'P1' : pos}</span>
              <span className="cl-h num">{d.num ?? r.num}</span>
              <span className="cl-h drv"><strong>{code}</strong></span>
              <div className='teams'>
                <div className='logo-background' style={{ backgroundColor: d.color }}>
                  <img className='logo' src={teamLogoURL(d.team)} alt={d.team} />
                </div>
                <span className="cl-h tm" style={{ color: d.color }}>{d.team.toUpperCase()}</span>
              </div>
              <span className="cl-h best">{r.best}</span>
              <span className="cl-h tyre">
                {r.tyres.map((t, i) => (
                  <span key={i} className="t-dot" style={{ borderColor: TYRES[t] }} />
                ))}
              </span>
              <span className="cl-h stops">{r.stops}</span>
              <span className="cl-h gap">{formatGap(gapMs)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
