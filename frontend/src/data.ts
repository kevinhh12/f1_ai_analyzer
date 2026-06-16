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

// Returns the exact lap ranges for each stint based on pit lap logic
// (mirrors the pit timing in calcLapTime)
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

export interface F1Data {
  season: number;
  races: Race[];
  drivers: Driver[];
  results: Result[];
}

export const F1_DATA: F1Data = {
  season: 2024,
races: [
  // 2025
  { year: 2025, round: 1,  track: 'sakhir',      name: 'Bahrain GP',        date: '05 MAR', country: 'BH', laps: 57 },
  { year: 2025, round: 2,  track: 'jeddah',       name: 'Saudi Arabian GP',  date: '19 MAR', country: 'SA', laps: 50 },
  { year: 2025, round: 3,  track: 'melbourne',    name: 'Australian GP',     date: '02 APR', country: 'AU', laps: 58 },
  { year: 2025, round: 4,  track: 'baku',         name: 'Azerbaijan GP',     date: '30 APR', country: 'AZ', laps: 51 },
  { year: 2025, round: 5,  track: 'miami',        name: 'Miami GP',          date: '07 MAY', country: 'US', laps: 57 },
  { year: 2025, round: 6,  track: 'montecarlo',       name: 'Monaco GP',         date: '28 MAY', country: 'MC', laps: 78, featured: true },
  { year: 2025, round: 7,  track: 'catalunya',        name: 'Spanish GP',        date: '04 JUN', country: 'ES', laps: 66 },
  { year: 2025, round: 8,  track: 'montreal',       name: 'Canadian GP',     date: '18 JUN', country: 'CA', laps: 70 },
  { year: 2025, round: 9,  track: 'spielberg',      name: 'Austrian GP',       date: '02 JUL', country: 'AT', laps: 71 },
  { year: 2025, round: 10, track: 'silverstone',  name: 'British GP',        date: '09 JUL', country: 'GB', laps: 52 },
  { year: 2025, round: 11, track: 'hungaroring',      name: 'Hungarian GP',      date: '23 JUL', country: 'HU', laps: 70 },
  { year: 2025, round: 12, track: 'spafrancorchamps',          name: 'Belgian GP',        date: '30 JUL', country: 'BE', laps: 44 },
  { year: 2025, round: 13, track: 'zandvoort',    name: 'Dutch GP',          date: '27 AUG', country: 'NL', laps: 72 },
  { year: 2025, round: 14, track: 'monza',        name: 'Italian GP',        date: '03 SEP', country: 'IT', laps: 53 },
  { year: 2025, round: 15, track: 'singapore',    name: 'Singapore GP',      date: '17 SEP', country: 'SG', laps: 62 },
  { year: 2025, round: 16, track: 'suzuka',       name: 'Japanese GP',       date: '24 SEP', country: 'JP', laps: 53 },
  { year: 2025, round: 17, track: 'lusail',        name: 'Qatar GP',          date: '08 OCT', country: 'QA', laps: 57 },
  { year: 2025, round: 18, track: 'austin',         name: 'United States GP',  date: '22 OCT', country: 'US', laps: 56 },
  { year: 2025, round: 19, track: 'mexicocity',       name: 'Mexico City GP',    date: '29 OCT', country: 'MX', laps: 71 },
  { year: 2025, round: 20, track: 'interlagos',   name: 'São Paulo GP',      date: '05 NOV', country: 'BR', laps: 71 },
  { year: 2025, round: 21, track: 'lasvegas',    name: 'Las Vegas GP',      date: '18 NOV', country: 'US', laps: 50 },
  { year: 2025, round: 22, track: 'yasmarina',    name: 'Abu Dhabi GP',      date: '26 NOV', country: 'AE', laps: 58 },

  // 2024
  { year: 2024, round: 1,  track: 'sakhir',      name: 'Bahrain GP',        date: '05 MAR', country: 'BH', laps: 57 },
  { year: 2024, round: 2,  track: 'jeddah',       name: 'Saudi Arabian GP',  date: '19 MAR', country: 'SA', laps: 50 },
  { year: 2024, round: 3,  track: 'melbourne',    name: 'Australian GP',     date: '02 APR', country: 'AU', laps: 58 },
  { year: 2024, round: 4,  track: 'baku',         name: 'Azerbaijan GP',     date: '30 APR', country: 'AZ', laps: 51 },
  { year: 2024, round: 5,  track: 'miami',        name: 'Miami GP',          date: '07 MAY', country: 'US', laps: 57 },
  { year: 2024, round: 6,  track: 'montecarlo',       name: 'Monaco GP',         date: '28 MAY', country: 'MC', laps: 78, featured: true },
  { year: 2024, round: 7,  track: 'catalunya',        name: 'Spanish GP',        date: '04 JUN', country: 'ES', laps: 66 },
  { year: 2024, round: 8,  track: 'montreal',       name: 'Canadian GP',     date: '18 JUN', country: 'CA', laps: 70 },
  { year: 2024, round: 9,  track: 'spielberg',      name: 'Austrian GP',       date: '02 JUL', country: 'AT', laps: 71 },
  { year: 2024, round: 10, track: 'silverstone',  name: 'British GP',        date: '09 JUL', country: 'GB', laps: 52 },
  { year: 2024, round: 11, track: 'hungaroring',      name: 'Hungarian GP',      date: '23 JUL', country: 'HU', laps: 70 },
  { year: 2024, round: 12, track: 'spafrancorchamps',          name: 'Belgian GP',        date: '30 JUL', country: 'BE', laps: 44 },
  { year: 2024, round: 13, track: 'zandvoort',    name: 'Dutch GP',          date: '27 AUG', country: 'NL', laps: 72 },
  { year: 2024, round: 14, track: 'monza',        name: 'Italian GP',        date: '03 SEP', country: 'IT', laps: 53 },
  { year: 2024, round: 15, track: 'singapore',    name: 'Singapore GP',      date: '17 SEP', country: 'SG', laps: 62 },
  { year: 2024, round: 16, track: 'suzuka',       name: 'Japanese GP',       date: '24 SEP', country: 'JP', laps: 53 },
  { year: 2024, round: 17, track: 'lusail',        name: 'Qatar GP',          date: '08 OCT', country: 'QA', laps: 57 },
  { year: 2024, round: 18, track: 'austin',         name: 'United States GP',  date: '22 OCT', country: 'US', laps: 56 },
  { year: 2024, round: 19, track: 'mexicocity',       name: 'Mexico City GP',    date: '29 OCT', country: 'MX', laps: 71 },
  { year: 2024, round: 20, track: 'interlagos',   name: 'São Paulo GP',      date: '05 NOV', country: 'BR', laps: 71 },
  { year: 2024, round: 21, track: 'lasvegas',    name: 'Las Vegas GP',      date: '18 NOV', country: 'US', laps: 50 },
  { year: 2024, round: 22, track: 'yasmarina',    name: 'Abu Dhabi GP',      date: '26 NOV', country: 'AE', laps: 58 },
],
  drivers: [
    { num: '01', code: 'VER', name: 'Verstappen',  team: 'Red Bull Racing', color: '#3671c6' },
    { num: '22', code: 'TSU', name: 'Tsunoda',     team: 'Red Bull Racing', color: '#3671c6' },
    { num: '04', code: 'NOR', name: 'Norris',      team: 'McLaren',         color: '#ff8000' },
    { num: '81', code: 'PIA', name: 'Piastri',     team: 'McLaren',         color: '#ff8000' },
    { num: '16', code: 'LEC', name: 'Leclerc',     team: 'Ferrari',         color: '#dc0000' },
    { num: '44', code: 'HAM', name: 'Hamilton',    team: 'Ferrari',         color: '#dc0000' },
    { num: '63', code: 'RUS', name: 'Russell',     team: 'Mercedes',        color: '#27f4d2' },
    { num: '12', code: 'ANT', name: 'Antonelli',   team: 'Mercedes',        color: '#27f4d2' },
    { num: '14', code: 'ALO', name: 'Alonso',      team: 'Aston Martin',    color: '#229971' },
    { num: '18', code: 'STR', name: 'Stroll',      team: 'Aston Martin',    color: '#229971' },
    { num: '23', code: 'ALB', name: 'Albon',       team: 'Williams',        color: '#64c4ff' },
    { num: '55', code: 'SAI', name: 'Sainz',       team: 'Williams',        color: '#64c4ff' },
    { num: '10', code: 'GAS', name: 'Gasly',       team: 'Alpine',          color: '#0090ff' },
    { num: '07', code: 'DOO', name: 'Doohan',      team: 'Alpine',          color: '#0090ff' },
    { num: '30', code: 'LAW', name: 'Lawson',      team: 'Racing Bulls',    color: '#6692ff' },
    { num: '06', code: 'HAD', name: 'Hadjar',      team: 'Racing Bulls',    color: '#6692ff' },
    { num: '87', code: 'BEA', name: 'Bearman',     team: 'Haas',            color: '#b6babd' },
    { num: '31', code: 'OCO', name: 'Ocon',        team: 'Haas',            color: '#b6babd' },
    { num: '27', code: 'HUL', name: 'Hülkenberg',  team: 'Audi',          color: '#52e252' },
    { num: '05', code: 'BOR', name: 'Bortoleto',   team: 'Audi',          color: '#52e252' },
  ],
  results: [
    { pos:  1, num: '01', code: 'VER', best: '1:14.260', gap: 'LEADER',    tyres: ['M','M'],     stops: 1 },
    { pos:  2, num: '04', code: 'NOR', best: '1:14.486', gap: '+22.134',   tyres: ['M','M'],     stops: 1 },
    { pos:  3, num: '16', code: 'LEC', best: '1:14.589', gap: '+31.452',   tyres: ['M','H'],     stops: 1 },
    { pos:  4, num: '44', code: 'HAM', best: '1:14.621', gap: '+33.891',   tyres: ['M','I','M'], stops: 2 },
    { pos:  5, num: '81', code: 'PIA', best: '1:14.712', gap: '+41.223',   tyres: ['M','H'],     stops: 1 },
    { pos:  6, num: '63', code: 'RUS', best: '1:14.882', gap: '+44.668',   tyres: ['M','I','M'], stops: 2 },
    { pos:  7, num: '14', code: 'ALO', best: '1:14.998', gap: '+52.341',   tyres: ['M','M'],     stops: 1 },
    { pos:  8, num: '12', code: 'ANT', best: '1:15.112', gap: '+58.112',   tyres: ['M','H'],     stops: 1 },
    { pos:  9, num: '55', code: 'SAI', best: '1:15.234', gap: '+1:04.231', tyres: ['M','I','M'], stops: 2 },
    { pos: 10, num: '18', code: 'STR', best: '1:15.445', gap: '+1:12.445', tyres: ['M','M'],     stops: 1 },
    { pos: 11, num: '10', code: 'GAS', best: '1:15.556', gap: '+1:21.334', tyres: ['M','I'],     stops: 1 },
    { pos: 12, num: '23', code: 'ALB', best: '1:15.678', gap: '+1 LAP',    tyres: ['M','H'],     stops: 1 },
    { pos: 13, num: '22', code: 'TSU', best: '1:15.789', gap: '+1 LAP',    tyres: ['H','M'],     stops: 1 },
    { pos: 14, num: '30', code: 'LAW', best: '1:15.891', gap: '+1 LAP',    tyres: ['M','I','M'], stops: 2 },
    { pos: 15, num: '07', code: 'DOO', best: '1:16.001', gap: '+1 LAP',    tyres: ['M','H'],     stops: 1 },
    { pos: 16, num: '06', code: 'HAD', best: '1:16.112', gap: '+1 LAP',    tyres: ['M','I'],     stops: 1 },
    { pos: 17, num: '87', code: 'BEA', best: '1:16.234', gap: '+1 LAP',    tyres: ['H','M'],     stops: 1 },
    { pos: 18, num: '31', code: 'OCO', best: '1:16.445', gap: '+1 LAP',    tyres: ['M','I'],     stops: 1 },
    { pos: 19, num: '27', code: 'HUL', best: '1:16.556', gap: '+2 LAPS',   tyres: ['M','H'],     stops: 1 },
    { pos: 20, num: '05', code: 'BOR', best: '1:16.678', gap: '+2 LAPS',   tyres: ['H','M','H'], stops: 2 },
  ],
};

// ---------- LAP CHART TEST DATA ----------

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

function calcLapTime(r: Result, lap: number, totalLaps: number, BASE_MS: number): number {
  const pit1 = Math.floor(totalLaps * 0.35);
  const pit2 = Math.floor(totalLaps * 0.65);

  if (lap === 1)                              return BASE_MS + 9000 + (r.pos - 1) * 300;
  if (r.stops >= 1 && lap === pit1)           return BASE_MS + 26000 + (r.pos - 1) * 200;
  if (r.stops >= 2 && lap === pit2)           return BASE_MS + 26000 + (r.pos - 1) * 200;

  let stintLap: number;
  if (r.stops === 0 || lap < pit1)        stintLap = lap - 1;
  else if (r.stops === 1 || lap < pit2)   stintLap = lap - pit1;
  else                                     stintLap = lap - pit2;

  let ms = BASE_MS
    + stintLap * 55
    + (r.pos - 1) * 110
    + Math.sin(lap * 7.31 + r.pos * 13.7) * 320
    + Math.sin(lap * 3.17 + r.pos * 5.3)  * 180
    + Math.sin(lap * 19.1 + r.pos * 2.9)  * 90;

  if (r.pos >= 6 && lap > Math.floor(totalLaps * 0.45) && lap < Math.floor(totalLaps * 0.50))
    ms += 600;

  return Math.max(70000, ms);
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
  driverNumberToCode: Record<number, string>
): { chartData: LapEntry[]; rankings: LapRanking[] } {
  // Group lap times (ms) by driver code and lap number
  const lapsByCode: Record<string, Record<number, number>> = {};

  for (const lap of rawLaps) {
    const code = driverNumberToCode[lap.driver_number];
    if (!code || lap.lap_duration == null) continue;
    if (!lapsByCode[code]) lapsByCode[code] = {};
    lapsByCode[code][lap.lap_number] = Math.round(lap.lap_duration * 1000);
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

    // Only rank drivers who have started (cumulative > 0)
    const active = codes.filter(code => cumulative[code] > 0);

    // Sort by laps completed DESC first — a finisher always beats a DNF.
    // Among drivers on the same lap, sort by cumulative time ASC.
    const lapsCompleted: Record<string, number> = {};
    active.forEach(code => {
      lapsCompleted[code] = lapsByCode[code][lap] != null
        ? lap
        : Object.keys(lapsByCode[code]).filter(l => Number(l) <= lap).length;
    });

    const sorted = [...active].sort((a, b) => {
      const lapDiff = lapsCompleted[b] - lapsCompleted[a];
      if (lapDiff !== 0) return lapDiff;
      return cumulative[a] - cumulative[b];
    });

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

export function generateLapData(
  results: Result[],
  totalLaps: number
): { chartData: LapEntry[]; rankings: LapRanking[] } {
  const BASE_MS = 74200;

  // Accumulate cumulative race time per driver across all laps
  const cumulative: Record<string, number> = {};
  results.forEach(r => { cumulative[r.code] = 0; });

  const chartData: LapEntry[] = [];
  const rankings: LapRanking[] = [];

  for (let lap = 1; lap <= totalLaps; lap++) {
    const entry: LapEntry = { lap };

    // Compute this lap's time for each driver and add to cumulative
    results.forEach(r => {
      const lt = calcLapTime(r, lap, totalLaps, BASE_MS);
      cumulative[r.code] += lt;
      entry[r.code] = lt;
    });

    // Derive position and gap from cumulative race time
    const sorted = [...results].sort((a, b) => cumulative[a.code] - cumulative[b.code]);
    const leaderTime = cumulative[sorted[0].code];

    sorted.forEach((r, i) => {
      entry[`${r.code}_pos`] = i + 1;
      entry[`${r.code}_gap`] = cumulative[r.code] - leaderTime;
    });

    chartData.push(entry);

    rankings.push({
      lap,
      order: sorted.map((r, i) => ({
        code: r.code,
        pos: i + 1,
        gapMs: cumulative[r.code] - leaderTime,
      })),
    });
  }

  return { chartData, rankings };
}