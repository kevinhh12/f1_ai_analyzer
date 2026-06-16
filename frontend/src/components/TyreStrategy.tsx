import { type Driver, type Result, type LapRanking, type Stint, getStints } from '../data';

const TYRE_COLORS: Record<string, string> = {
  S: '#ff2e2e', M: '#ffd400', H: '#f3f3f3', I: '#00d27a', W: '#2bb6ff',
};
const TYRE_NAMES: Record<string, string> = {
  S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTER', W: 'WET',
};

const DNF_COLOR = '#f97316';

interface Props {
  results: Result[];
  drivers: Driver[];
  totalLaps: number;
  currentLap: number;
  rankings: LapRanking[];
  stintsByCode: Record<string, Stint[]>;
  selectedCode: string;
  onSelect: (code: string) => void;
}

export default function TyreStrategy({ results, drivers, totalLaps, currentLap, rankings, stintsByCode, selectedCode, onSelect }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));
  const resultByCode = Object.fromEntries(results.map(r => [r.code, r]));


  // Live order from rankings, fall back to final results order
  const currentRanking = rankings[currentLap - 1];
  const rankedOrder = currentRanking
    ? currentRanking.order
    : results.map((r, i) => ({ code: r.code, pos: i + 1, gapMs: 0 }));

  // Append drivers in results but missing from the live ranking (DNS/immediate DNF)
  const rankedCodes = new Set(rankedOrder.map(o => o.code));
  const unranked = results
    .filter(r => !rankedCodes.has(r.code))
    .map((r, i) => ({ code: r.code, pos: rankedOrder.length + i + 1, gapMs: -1 }));

  const liveOrder = [...rankedOrder, ...unranked];

  return (
    <section id="tyre-strategy">
      <div className="panel-head">
        <span className="panel-eb">TYRE STRATEGY</span>
        <span className="panel-meta">LIVE STINTS · LAP {currentLap} / {totalLaps}</span>
      </div>
      <div className="strat">
        {liveOrder.map(({ code, pos }) => {
          const r = resultByCode[code];
          if (!r) return null;
          const d = byCode[code] ?? { team: '—', color: '#9ea2ac', name: '', num: r.num, code };
          const sel = code === selectedCode;

          // Use real stints from API if available, fall back to mock
          const stints = stintsByCode[code]?.length
            ? stintsByCode[code]
            : getStints(r, totalLaps);

          // Use lap-count-based DNF flag (reliable) rather than stint endLap (OpenF1 fills it to race end)
          // Only show the badge once we're past the lap they retired on
          const retiredOnLap = r.lastLap ?? 0;
          const isDNF = !!r.dnf && retiredOnLap > 0 && currentLap > retiredOnLap;
          const hasNoData = stints.length === 0 && !!r.dnf;

          // Only stints that have started by currentLap
          const revealedStints = stints.filter(s => currentLap >= s.startLap);

          return (
            <button
              key={code}
              className={"strat-row" + (sel ? " sel" : "") + (isDNF || hasNoData ? " strat-row--dnf" : "")}
              onClick={() => onSelect(code)}
            >
              <span className="strat-pos">P{pos}</span>
              <span className="strat-team" style={{ background: d.color }} />
              <span className="strat-code" style={isDNF || hasNoData ? { color: DNF_COLOR } : undefined}>{code}</span>
              <span className="strat-bar">
                {hasNoData ? (
                  <span className="strat-dnf-badge" style={{ background: DNF_COLOR }}>DNF</span>
                ) : (
                  <>
                    {revealedStints.map((s, i) => {
                      const visibleLaps = Math.min(s.endLap, currentLap) - s.startLap + 1;
                      const isActive = currentLap >= s.startLap && currentLap <= s.endLap;
                      return (
                        <span
                          key={i}
                          className={"strat-seg" + (isActive ? " strat-seg--active" : "")}
                          title={`${TYRE_NAMES[s.compound]} · ${visibleLaps} laps`}
                          style={{
                            flex: visibleLaps,
                            background: TYRE_COLORS[s.compound],
                            color: s.compound === 'M' || s.compound === 'H' ? '#0a0b0d' : '#fff',
                          }}
                        >
                          <span className="strat-seg-lbl">{TYRE_NAMES[s.compound]}</span>
                          <span className="strat-seg-len">{visibleLaps}L</span>
                        </span>
                      );
                    })}
                    {isDNF && (
                      <span className="strat-dnf-badge" style={{ background: DNF_COLOR }}>
                        DNF · L{retiredOnLap}
                      </span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="strat-legend">
        {(['S', 'M', 'H', 'I', 'W'] as const).map(t => (
          <span key={t} className="legend-item">
            <span className="legend-dot" style={{ borderColor: TYRE_COLORS[t] }} />
            {TYRE_NAMES[t]}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-dot" style={{ borderColor: DNF_COLOR }} />
          DNF
        </span>
      </div>
    </section>
  );
}
