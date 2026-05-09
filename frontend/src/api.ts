import type { Driver, Race, Result, TyreCompound } from './data';

const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

export interface RaceData {
  drivers: Driver[];
  results: Result[];
  totalLaps: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Backend returned ${res.status} for ${path}`);
  return res.json();
}

function teamColor(hex: string | null | undefined): string {
  return hex ? `#${hex}` : '#9ea2ac';
}

function mapCompound(raw: string): TyreCompound {
  const map: Record<string, TyreCompound> = {
    SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W',
  };
  return map[raw?.toUpperCase()] ?? 'M';
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

// ── Public fetch functions ────────────────────────────────────────────────────

export async function fetchRaces(season: number): Promise<Race[]> {
  const data = await get(`/races?season=${season}`);
  return (data.races as Race[]).map(r => ({ ...r, laps: 0 }));
}

export async function fetchRaceData(sessionKey: number): Promise<RaceData> {
  const [driversRes, lapsRes, tyresRes, pitsRes] = await Promise.all([
    get(`/drivers?session_key=${sessionKey}`),
    get(`/laps?session_key=${sessionKey}`),
    get(`/tyres?session_key=${sessionKey}`),
    get(`/pitstops?session_key=${sessionKey}`),
  ]);

  const rawDrivers: any[] = driversRes.drivers ?? [];
  const rawLaps: any[]    = lapsRes.laps ?? [];
  const rawStints: any[]  = tyresRes.stints ?? [];
  const rawPits: any[]    = pitsRes.pit_stops ?? [];

  const driverByNum = Object.fromEntries(rawDrivers.map(d => [d.driver_number, d]));

  // Collect valid lap durations per driver; track total laps in the race
  const lapsByDriver: Record<number, number[]> = {};
  let totalLaps = 0;
  for (const lap of rawLaps) {
    if (!lap.lap_duration || lap.is_pit_out_lap) continue;
    (lapsByDriver[lap.driver_number] ??= []).push(lap.lap_duration);
    if (lap.lap_number > totalLaps) totalLaps = lap.lap_number;
  }

  // Sum all valid laps per driver → used to determine finishing order and gaps
  const totalTime: Record<number, number> = {};
  for (const [num, laps] of Object.entries(lapsByDriver)) {
    totalTime[Number(num)] = laps.reduce((a, b) => a + b, 0);
  }

  const sorted = Object.entries(totalTime)
    .sort(([, a], [, b]) => a - b)
    .map(([num]) => Number(num));

  const leaderTime = totalTime[sorted[0]] ?? 0;

  // Tyre compounds per driver in stint order
  const stintsByDriver: Record<number, TyreCompound[]> = {};
  for (const stint of [...rawStints].sort((a, b) => a.stint_number - b.stint_number)) {
    (stintsByDriver[stint.driver_number] ??= []).push(mapCompound(stint.compound));
  }

  // Pit stop counts per driver
  const pitsByDriver: Record<number, number> = {};
  for (const pit of rawPits) {
    pitsByDriver[pit.driver_number] = (pitsByDriver[pit.driver_number] ?? 0) + 1;
  }

  // Fastest single lap per driver
  const bestLap: Record<number, number> = {};
  for (const [num, laps] of Object.entries(lapsByDriver)) {
    bestLap[Number(num)] = Math.min(...laps);
  }

  const drivers: Driver[] = rawDrivers.map(d => ({
    num:   String(d.driver_number).padStart(2, '0'),
    code:  d.name_acronym ?? String(d.driver_number),
    name:  d.last_name ?? d.full_name?.split(' ').at(-1) ?? String(d.driver_number),
    team:  d.team_name ?? '—',
    color: teamColor(d.team_colour),
  }));

  const results: Result[] = sorted.slice(0, 20).map((driverNum, i) => {
    const raw = driverByNum[driverNum];
    const gap = i === 0
      ? 'LEADER'
      : `+${(totalTime[driverNum] - leaderTime).toFixed(3)}`;
    return {
      pos:   i + 1,
      num:   String(driverNum).padStart(2, '0'),
      code:  raw?.name_acronym ?? String(driverNum),
      best:  bestLap[driverNum] ? formatLapTime(bestLap[driverNum]) : '—:——.———',
      gap,
      tyres: stintsByDriver[driverNum] ?? ['M' as TyreCompound],
      stops: pitsByDriver[driverNum] ?? 0,
    };
  });

  return { drivers, results, totalLaps };
}
