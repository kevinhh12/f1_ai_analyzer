import { useMemo } from 'react';
import { type Result, type Driver, type LapEntry, type LapRanking, type Stint } from '../data';

interface Props {
  chartData: LapEntry[];
  stintsByCode: Record<string, Stint[]>;
  pitStops: any[];
  rankings: LapRanking[];
  currentLap: number;
  results: Result[];
  drivers: Driver[];
}

const COMPOUND_NAMES: Record<string, string> = {
  S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTER', W: 'WET',
};
const COMPOUND_COLORS: Record<string, string> = {
  S: '#ff2e2e', M: '#ffd400', H: '#f3f3f3', I: '#00d27a', W: '#2bb6ff',
};

function fmtMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

export default function StatGrid({ chartData, stintsByCode, pitStops, rankings, currentLap, results, drivers }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  // ── 1. FASTEST LAP ──────────────────────────────────────────────────────────
  const fastestLap = useMemo(() => {
    let bestMs = Infinity, bestCode = '', bestLapNum = 0;
    const limit = Math.min(currentLap, chartData.length);
    for (let i = 0; i < limit; i++) {
      const entry = chartData[i];
      for (const [key, val] of Object.entries(entry)) {
        if (key === 'lap' || key.endsWith('_pos') || key.endsWith('_gap')) continue;
        // Exclude pit laps (> 120s) and invalid values
        if (typeof val === 'number' && val > 0 && val < 120000 && val < bestMs) {
          bestMs = val;
          bestCode = key;
          bestLapNum = entry.lap as number;
        }
      }
    }
    if (!bestCode) return null;
    const compound = stintsByCode[bestCode]?.find(
      s => s.startLap <= bestLapNum && s.endLap >= bestLapNum
    )?.compound ?? null;
    return { time: fmtMs(bestMs), code: bestCode, lap: bestLapNum, compound };
  }, [chartData, stintsByCode, currentLap]);

  // ── 2. PIT STOPS ────────────────────────────────────────────────────────────
  const pitStats = useMemo(() => {
    // Exclude lap 1 (formation stop) and future laps; ignore very long durations
    const stops = pitStops.filter(
      p => p.lap_number > 1 && p.lap_number <= currentLap
    );
    const durations = stops
      .map(p => p.stop_duration ?? p.pit_duration)
      .filter((d): d is number => typeof d === 'number' && d > 1 && d < 35);
    const fastest = durations.length > 0 ? Math.min(...durations) : null;
    const avg = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;
    return { count: stops.length, fastest, avg };
  }, [pitStops, currentLap]);

  // ── 3. P1 LEAD (gap to P2) ──────────────────────────────────────────────────
  const leaderInfo = useMemo(() => {
    const ranking = rankings[currentLap - 1];
    if (!ranking || ranking.order.length < 2) return null;
    const p1 = ranking.order[0];
    const p2 = ranking.order[1];
    return {
      code: p1.code,
      gap: (p2.gapMs / 1000).toFixed(2),
    };
  }, [rankings, currentLap]);

  // ── 4. RETIREMENTS ──────────────────────────────────────────────────────────
  const retirements = useMemo(() => {
    const dnfDrivers = results.filter(r => r.dnf && (r.lastLap ?? 0) < currentLap);
    return {
      count: dnfDrivers.length,
      codes: dnfDrivers.map(r => r.code).slice(0, 4),
    };
  }, [results, currentLap]);

  const flColor = fastestLap ? (byCode[fastestLap.code]?.color ?? '#9ea2ac') : '#9ea2ac';
  const leaderColor = leaderInfo ? (byCode[leaderInfo.code]?.color ?? '#9ea2ac') : '#9ea2ac';

  return (
    <div className="stat-grid">

      {/* FASTEST LAP */}
      <div className="stat-card" style={{ borderLeftColor: flColor }}>
        <div className="stat-lbl">FASTEST LAP</div>
        {fastestLap ? (
          <>
            <div className="stat-row">
              <div className="stat-v">{fastestLap.time}</div>
              {fastestLap.compound && (
                <span
                  className="stat-compound"
                  style={{
                    background: COMPOUND_COLORS[fastestLap.compound],
                    color: fastestLap.compound === 'M' || fastestLap.compound === 'H' ? '#000' : '#fff',
                  }}
                >
                  {COMPOUND_NAMES[fastestLap.compound]}
                </span>
              )}
            </div>
            <div className="stat-sub">
              {fastestLap.code} · LAP {fastestLap.lap}
            </div>
          </>
        ) : (
          <div className="stat-v stat-v--empty">—</div>
        )}
      </div>

      {/* PIT STOPS */}
      <div className="stat-card" style={{ borderLeftColor: '#6366f1' }}>
        <div className="stat-lbl">PIT STOPS</div>
        <div className="stat-v">{pitStats.count}</div>
        <div className="stat-sub">
          {pitStats.fastest != null
            ? `FASTEST ${pitStats.fastest.toFixed(1)}s · AVG ${pitStats.avg!.toFixed(1)}s`
            : 'NO STOPS YET'}
        </div>
      </div>

      {/* P1 LEAD */}
      <div className="stat-card" style={{ borderLeftColor: leaderColor }}>
        <div className="stat-lbl">P1 LEAD</div>
        {leaderInfo ? (
          <>
            <div className="stat-row">
              <div className="stat-v">+{leaderInfo.gap}s</div>
            </div>
            <div className="stat-sub">{leaderInfo.code} OVER P2</div>
          </>
        ) : (
          <div className="stat-v stat-v--empty">—</div>
        )}
      </div>

      {/* RETIREMENTS */}
      <div className="stat-card" style={{ borderLeftColor: retirements.count > 0 ? '#f97316' : 'var(--border-strong)' }}>
        <div className="stat-lbl">RETIREMENTS</div>
        <div className="stat-v">{retirements.count}</div>
        <div className="stat-sub">
          {retirements.count > 0 ? retirements.codes.join(' · ') : 'ALL CARS RUNNING'}
        </div>
      </div>

    </div>
  );
}
