import { type Driver, type Result, type LapRanking, type Stint, formatGap } from '../data';

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
  stintsByCode: Record<string, Stint[]>;
  fastestLapCode?: string | null;
  activeSeason?: number;
}

export default function Classification({ results, drivers, selectedCode, onSelect, rankings, currentLap, stintsByCode, fastestLapCode, activeSeason }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));
  const resultByCode = Object.fromEntries(results.map(r => [r.code, r]));
  const teamLogoURL = (team: string) =>
    `https://media.formula1.com/image/upload/c_lfill,w_48/q_auto/v1740000001/common/f1/${activeSeason}/${team.toLowerCase().replace(/\s/g, '')}/${activeSeason}${team.toLowerCase().replace(/\s/g, '')}logowhite.webp`;

  console.log(activeSeason, teamLogoURL('Mercedes'));
  const currentLapIndex = currentLap - 1;
  const currentRanking = rankings[currentLapIndex];

  const rankedOrder: { code: string; pos: number; gapMs: number }[] = currentRanking
    ? currentRanking.order
    : results.map((r, i) => ({ code: r.code, pos: i + 1, gapMs: 0 }));

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
          const d = driverInfo ?? { team: '—', color: '#3f434c', name: code, num: r.num, code };

          const sel = code === selectedCode;
          const lead = pos === 1;
          const hasFastestLap = code === fastestLapCode;

          // Stints used up to currentLap — from real data if available, fall back to r.tyres
          const realStints = stintsByCode[code];
          const usedCompounds: string[] = realStints
            ? realStints.filter(s => s.startLap <= currentLap).map(s => s.compound)
            : r.tyres.slice(0, r.stops + 1);

          // Pit count = stints started so far minus 1
          const livePits = realStints
            ? Math.max(0, realStints.filter(s => s.startLap <= currentLap).length - 1)
            : r.stops;

          return (
            <button
              key={code}
              className={"cl-row" + (lead ? " lead" : "") + (sel ? " sel" : "") + (hasFastestLap ? " fl" : "")}
              onClick={() => onSelect(code)}
              style={{ borderLeftColor: hasFastestLap ? '#a855f7' : d.color }}
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
                {usedCompounds.map((t, i) => (
                  <span
                    key={i}
                    className="t-chip"
                    title={t === 'S' ? 'SOFT' : t === 'M' ? 'MEDIUM' : t === 'H' ? 'HARD' : t === 'I' ? 'INTER' : 'WET'}
                    style={{
                      background: TYRES[t],
                      color: t === 'M' || t === 'H' ? '#0a0b0d' : '#fff',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
              <span className="cl-h stops">{livePits}</span>
              <span className="cl-h gap">{formatGap(gapMs)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
