import { type Driver, type Result, type LapRanking, type Stint, formatGap } from '../data';
import DriverTelemetryCard from './DriverTelemetryCard';
import DriverInfoCard from './DriverInfoCard';

const TYRES: Record<string, string> = {
  S: '#ff2e2e', M: '#ffd400', H: '#f3f3f3', I: '#00d27a', W: '#2bb6ff',
};

interface Props {
  results: Result[];
  drivers: Driver[];
  selectedCode: string;
  onSelect: (code: string) => void;
  currentRanking?: LapRanking | null;
  currentLap: number;
  stintsByCode: Record<string, Stint[]>;
  pitStops: any[];
  fastestLapCode?: string | null;
  activeSeason?: number;
  liveBestByCode?: Record<string, string>;
  sessionKey?: number;
  lap?: number;
  currentTimeMs?: number;
  raceStartEpoch?: number;
}

export default function Classification({ results, drivers, selectedCode, onSelect, currentRanking, currentLap, stintsByCode, pitStops, fastestLapCode, activeSeason, liveBestByCode, sessionKey, lap, currentTimeMs, raceStartEpoch }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));
  const resultByCode = Object.fromEntries(results.map(r => [r.code, r]));
  // Map driver number → code for pit stop lookups
  const numToCode = Object.fromEntries(drivers.map(d => [d.num, d.code]));
  const teamLogoURL = (team: string) =>
    `https://media.formula1.com/image/upload/c_lfill,w_48/q_auto/v1740000001/common/f1/${activeSeason}/${team.toLowerCase().replace(/\s/g, '')}/${activeSeason}${team.toLowerCase().replace(/\s/g, '')}logowhite.webp`;

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
          const isDnf = gapMs === -1;

          const realStints = stintsByCode[code];

          // Derive pit count from stints that have started by currentLap (not raw pit data,
          // which includes red-flag pit entries that inflate the count)
          const revealedStints = realStints
            ? realStints.filter(s => currentLap >= s.startLap)
            : [];
          const livePits = Math.max(0, revealedStints.length - 1);
          const usedCompounds: string[] = revealedStints.length
            ? revealedStints.map(s => s.compound)
            : r.tyres.slice(0, r.stops + 1);

          return (
            <div key={code} className="cl-entry">
              <button
                className={"cl-row" + (lead ? " lead" : "") + (sel ? " sel" : "") + (hasFastestLap ? " fl" : "") + (isDnf ? " dnf" : "")}
                onClick={() => onSelect(sel ? '' : code)}
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
                <span className="cl-h best">{liveBestByCode?.[code] ?? '—'}</span>
                <span className="cl-h stops">{livePits}</span>
                <span className="cl-h gap">{formatGap(gapMs,pos)}</span>
              </button>

              {sel && sessionKey && lap && currentTimeMs != null && raceStartEpoch != null && (
                <div className="cl-expand" style={{ borderLeftColor: d.color }}>
                  <div className="cl-expand__left">
                    <DriverTelemetryCard
                      sessionKey={sessionKey}
                      driverNumber={d.num ?? r.num}
                      driverCode={code}
                      driverColor={d.color}
                      lap={lap}
                      currentTimeMs={currentTimeMs}
                      raceStartEpoch={raceStartEpoch}
                    />
                  </div>
                  <div className="cl-expand__right">
                    <DriverInfoCard
                      code={code}
                      name={d.name ?? code}
                      team={d.team}
                      color={d.color}
                      num={d.num ?? r.num}
                      img={d.img}
                      usedCompounds={usedCompounds}
                      pitStops={livePits}
                      bestLap={liveBestByCode?.[code]}
                      position={pos}
                      gap={formatGap(gapMs, pos)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
