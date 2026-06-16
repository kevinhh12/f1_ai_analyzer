export type TyreCompound = 'S' | 'M' | 'H' | 'I' | 'W';

export interface Stint {
  compound: TyreCompound;
  startLap: number; // 1-indexed, inclusive
  endLap: number;   // 1-indexed, inclusive
}

const COMPOUND_MAP: Record<string, TyreCompound> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W',
};

export function processStintData(
  rawStints: any[],
  driverNumberToCode: Record<number, string>,
  totalLaps: number,
): Record<string, Stint[]> {
  const byCode: Record<string, Stint[]> = {};
  for (const s of rawStints) {
    const code = driverNumberToCode[s.driver_number];
    if (!code) continue;
    const compound: TyreCompound = COMPOUND_MAP[s.compound] ?? 'H';
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({
      compound,
      startLap: s.lap_start ?? 1,
      endLap: s.lap_end ?? totalLaps,
    });
  }
  // Sort each driver's stints chronologically
  for (const code of Object.keys(byCode)) {
    byCode[code].sort((a, b) => a.startLap - b.startLap);
  }
  return byCode;
}

export function getStints(result: Result, totalLaps: number): Stint[] {
  const pit1 = Math.floor(totalLaps * 0.35);
  const pit2 = Math.floor(totalLaps * 0.65);
  const { tyres, stops } = result;

  if (stops === 0) {
    return [{ compound: tyres[0], startLap: 1, endLap: totalLaps }];
  }
  if (stops === 1) {
    return [
      { compound: tyres[0], startLap: 1,        endLap: pit1 - 1 },
      { compound: tyres[1], startLap: pit1,      endLap: totalLaps },
    ];
  }
  // 2+ stops
  return [
    { compound: tyres[0], startLap: 1,        endLap: pit1 - 1 },
    { compound: tyres[1], startLap: pit1,      endLap: pit2 - 1 },
    { compound: tyres[2] ?? tyres[1], startLap: pit2, endLap: totalLaps },
  ];
}

export interface Race {
  year: number;
  round: number;
  name: string;
  track: string;
  date: string;
  country: string;
  laps: number;
  featured?: boolean;
  session_key?: number;
}

export interface Driver {
  num: string;
  code: string;
  name: string;
  team: string;
  color: string;
}

export interface Result {
  pos: number;
  num: string;
  code: string;
  name?: string;
  best: string;
  gap: string;
  tyres: TyreCompound[];
  stops: number;
  dnf?: boolean;   // true if driver retired before completing 90% of race distance
  lastLap?: number; // last lap they completed (for showing DNF at the right time)
}

export function msToLabel(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

export function msToAxisTick(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export type LapEntry = Record<string, number | null>;

// Per-lap position + gap snapshot, used by the live ranking panel
export interface LapRanking {
  lap: number;
  order: { code: string; pos: number; gapMs: number }[];
}

export function formatGap(ms: number): string {
  if (ms === 0) return 'LEADER';
  if (ms < 0) return 'DNF';
  const s = (ms / 1000).toFixed(3);
  return `+${s}`;
}

export function buildResultsFromLaps(
  rawLaps: any[],
  driverNumberToCode: Record<number, string>,
  finalRankings: LapRanking[]
): Result[] {
  // Best lap per driver — exclude lap 1 and pit-out laps
  const bestMs: Record<string, number> = {};
  const numByCode: Record<string, string> = {};

  for (const lap of rawLaps) {
    const code = driverNumberToCode[lap.driver_number];
    if (!code || !lap.lap_duration || lap.is_pit_out_lap || lap.lap_number === 1) continue;
    numByCode[code] = String(lap.driver_number);
    const ms = lap.lap_duration * 1000;
    if (!bestMs[code] || ms < bestMs[code]) bestMs[code] = ms;
  }

  // Total laps per driver (for detecting DNF)
  const lapsPerDriver: Record<string, number> = {};
  for (const lap of rawLaps) {
    const code = driverNumberToCode[lap.driver_number];
    if (!code) continue;
    lapsPerDriver[code] = Math.max(lapsPerDriver[code] ?? 0, lap.lap_number ?? 0);
  }
  const maxLaps = Math.max(...Object.values(lapsPerDriver));

  // Build numByCode for all drivers (not just those with clean laps)
  for (const [num, code] of Object.entries(driverNumberToCode)) {
    if (!numByCode[code]) numByCode[code] = num;
  }

  // Final race order from the last ranking entry
  const finalOrder = finalRankings[finalRankings.length - 1]?.order ?? [];
  const rankedCodes = new Set(finalOrder.map(o => o.code));

  // Drivers with no lap data at all (DNS/no timing) go to the back
  const unranked = Object.values(driverNumberToCode)
    .filter(code => !rankedCodes.has(code))
    .map((code, i) => ({ code, pos: finalOrder.length + i + 1, gapMs: -1 }));

  return [...finalOrder, ...unranked].map(({ code, pos, gapMs }) => {
    const ms = bestMs[code];
    const best = ms
      ? (() => {
          const m = Math.floor(ms / 60000);
          const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
          return `${m}:${s}`;
        })()
      : '—';

    const driverLaps = lapsPerDriver[code] ?? 0;
    const lapsDown = maxLaps - driverLaps;
    // DNF = completed less than 90% of race distance (FIA classification threshold)
    const dnf = driverLaps === 0 || driverLaps < maxLaps * 0.9;

    // Gap: only compute time gap for same-lap drivers; lapped/DNF drivers show lap count
    const gap = pos === 1
      ? 'LEADER'
      : driverLaps === 0
        ? 'DNF'
        : lapsDown > 0
          ? `+${lapsDown} LAP${lapsDown > 1 ? 'S' : ''}`
          : `+${(Math.abs(gapMs) / 1000).toFixed(3)}`;

    return {
      pos,
      num: numByCode[code] ?? '0',
      code,
      best,
      gap,
      dnf,
      lastLap: driverLaps || undefined,
      tyres: [] as TyreCompound[],  // filled in next step
      stops: 0,                      // filled in next step
    };
  });
}

export function processRealLapData(
  rawLaps: any[],
  driverNumberToCode: Record<number, string>,
  rawPositions?: any[]
): { chartData: LapEntry[]; rankings: LapRanking[] } {
  // Group lap times (ms) and lap-end timestamps by driver code and lap number
  const lapsByCode: Record<string, Record<number, number>> = {};
  const lapEndTs: Record<string, Record<number, number>> = {};

  for (const lap of rawLaps) {
    const code = driverNumberToCode[lap.driver_number];
    if (!code || lap.lap_duration == null) continue;
    if (!lapsByCode[code]) lapsByCode[code] = {};
    lapsByCode[code][lap.lap_number] = Math.round(lap.lap_duration * 1000);
    if (lap.date_start) {
      if (!lapEndTs[code]) lapEndTs[code] = {};
      lapEndTs[code][lap.lap_number] =
        new Date(lap.date_start).getTime() + lap.lap_duration * 1000;
    }
  }

  // Build per-driver position timeline from OpenF1 Position API data
  // posTimeline[driverNumber] = [{ts, pos}, ...] sorted ascending by time
  const posTimeline: Record<number, Array<{ ts: number; pos: number }>> = {};
  if (rawPositions?.length) {
    for (const p of rawPositions) {
      if (!p.driver_number || !p.position || !p.date) continue;
      if (!posTimeline[p.driver_number]) posTimeline[p.driver_number] = [];
      posTimeline[p.driver_number].push({
        ts: new Date(p.date).getTime(),
        pos: p.position,
      });
    }
    for (const num of Object.keys(posTimeline)) {
      posTimeline[Number(num)].sort((a, b) => a.ts - b.ts);
    }
  }

  // Reverse lookup: code → driver number
  const codeToNum: Record<string, number> = {};
  for (const [num, code] of Object.entries(driverNumberToCode)) {
    codeToNum[code] = Number(num);
  }

  /** Most recent official position for a driver at or before the given timestamp. */
  function posAt(driverNum: number, ts: number): number | null {
    const tl = posTimeline[driverNum];
    if (!tl?.length) return null;
    let last: number | null = null;
    for (const e of tl) {
      if (e.ts > ts) break;
      last = e.pos;
    }
    return last;
  }

  const codes = Object.keys(lapsByCode);
  const maxLap = Math.max(...rawLaps.map(l => l.lap_number).filter(Boolean));

  const cumulative: Record<string, number> = {};
  codes.forEach(code => { cumulative[code] = 0; });

  const chartData: LapEntry[] = [];
  const rankings: LapRanking[] = [];

  for (let lap = 1; lap <= maxLap; lap++) {
    const entry: LapEntry = { lap };

    codes.forEach(code => {
      const ms = lapsByCode[code][lap] ?? null;
      entry[code] = ms;
      if (ms != null) cumulative[code] += ms;
    });

    const active = codes.filter(code => cumulative[code] > 0);

    // ── Sort using official Position API when available ───────────────────
    // Reference time = 5s after the first driver completes lap L (the leader).
    // All positions should be updated by then for a finished race.
    let sorted: string[];
    const lapLEndTimes = active
      .map(code => lapEndTs[code]?.[lap])
      .filter((t): t is number => t != null);

    if (rawPositions?.length && lapLEndTimes.length > 0) {
      const refTs = Math.min(...lapLEndTimes) + 5000;
      const withPos = active.map(code => ({
        code,
        pos: posAt(codeToNum[code], refTs) ?? Infinity,
        cum: cumulative[code],
      }));
      withPos.sort((a, b) =>
        a.pos !== b.pos ? a.pos - b.pos : a.cum - b.cum
      );
      sorted = withPos.map(w => w.code);
    } else {
      // Fallback: sort by laps completed DESC, then cumulative time ASC
      const lapsCompleted: Record<string, number> = {};
      active.forEach(code => {
        lapsCompleted[code] = lapsByCode[code][lap] != null
          ? lap
          : Object.keys(lapsByCode[code]).filter(l => Number(l) <= lap).length;
      });
      sorted = [...active].sort((a, b) => {
        const lapDiff = lapsCompleted[b] - lapsCompleted[a];
        if (lapDiff !== 0) return lapDiff;
        return cumulative[a] - cumulative[b];
      });
    }

    const leaderTime = sorted.length ? cumulative[sorted[0]] : 0;

    sorted.forEach((code, i) => {
      entry[`${code}_pos`] = i + 1;
      entry[`${code}_gap`] = cumulative[code] - leaderTime;
    });

    chartData.push(entry);
    rankings.push({
      lap,
      order: sorted.map((code, i) => ({
        code,
        pos: i + 1,
        gapMs: cumulative[code] - leaderTime,
      })),
    });
  }

  return { chartData, rankings };
}

