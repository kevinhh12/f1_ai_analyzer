import { useState, useEffect, useMemo, useRef } from 'react';
import { processRealLapData, buildResultsFromLaps, processStintData, type Race, type Driver, type Result, type LapEntry, type LapRanking, type Stint } from '../data';
import Classification from '../components/Classification';
import LapChart from '../components/LapChart';
import StatGrid from '../components/StatGrid';
import TopBar from '../components/TopBar';
import TyreStrategy from '../components/TyreStrategy';
import Sidebar from '../components/Sidebar';
import TrackMap from '../components/TrackMap';
import BottomRaceDrawer from '../components/BottomDrawer';
import WeatherWidget from '../components/WeatherWidget';
import {Link} from 'react-router-dom';


function adaptDriver(d: any): Driver {
  return {
    num: String(d.driver_number),
    code: d.name_acronym,
    name: d.full_name.split(' ').map((w: string) =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' '),
    team: d.team_name,
    color: '#' + (d.team_colour ?? '9ea2ac'),
  };
}

function adaptRace(session: any, index: number): Race {
  return {
    year: session.year,
    round: index + 1,
    name: session.circuit_short_name,
    country: session.country_name,
    date: session.date_start.slice(0, 10),
    track: session.circuit_short_name,
    laps: 1,
    session_key: session.session_key,
  };
}

const COUNTRY_ISO: Record<string, string> = {
  'Australia': 'au', 'Austria': 'at', 'Azerbaijan': 'az',
  'Bahrain': 'bh', 'Belgium': 'be', 'Brazil': 'br',
  'Canada': 'ca', 'China': 'cn', 'France': 'fr',
  'Hungary': 'hu', 'Italy': 'it', 'Japan': 'jp',
  'Mexico': 'mx', 'Monaco': 'mc', 'Netherlands': 'nl',
  'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Singapore': 'sg',
  'Spain': 'es', 'United Arab Emirates': 'ae',
  'United Kingdom': 'gb', 'United States': 'us',
};
const countryFlagUrl = (name: string) => {
  const iso = COUNTRY_ISO[name];
  return iso ? `https://flagcdn.com/w320/${iso}.png` : null;
};

function fmtRaceTime(ms: number) {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = String(totalS % 60).padStart(2, '0');
  return `${m}:${s}`;
}

interface ScrubberProps {
  raceDurationMs: number;
  currentTimeMs: number;
  currentLap: number;
  totalLaps: number;
  onChange: (ms: number) => void;
}

// Real-time playback: 1ms of real time = 1ms of race time
const TICK_MS = 100; // fire every 100ms
const STEP_MS = TICK_MS; // advance race time by same amount

function Scrubber({ raceDurationMs, currentTimeMs, currentLap, totalLaps, onChange }: ScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(currentTimeMs);
  timeRef.current = currentTimeMs;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = timeRef.current + STEP_MS;
      if (next >= raceDurationMs) {
        onChange(raceDurationMs);
        setPlaying(false);
      } else {
        onChange(next);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, raceDurationMs]);

  return (
    <div className="scrubber">
      <button className="play" onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="lap-lbl">LAP</span>
      <input
        type="range"
        min={0}
        max={raceDurationMs || 1}
        step={1000}
        value={currentTimeMs}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span className="lap-v">{currentLap}/{totalLaps}</span>
      <span className="lap-time">{fmtRaceTime(currentTimeMs)}</span>
    </div>
  );
}

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

interface CanvasHeadProps {
  race: Race; activeYear: number; lap: number;
  rankings: LapRanking[]; chartData: LapEntry[]; drivers: Driver[];
  weather: Record<string, number | null>;
}

function CanvasHead({ race, activeYear, lap, rankings, chartData, drivers, weather }: CanvasHeadProps) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  const leaderCode = rankings[lap - 1]?.order[0]?.code ?? null;
  const leaderColor = leaderCode ? (byCode[leaderCode]?.color ?? '#e10600') : '#e10600';

  const fastestLap = useMemo(() => {
    let bestMs = Infinity, bestCode = '';
    for (const entry of chartData) {
      for (const [key, val] of Object.entries(entry)) {
        if (key === 'lap' || key.endsWith('_pos') || key.endsWith('_gap')) continue;
        if (typeof val === 'number' && val > 0 && val < 120000 && val < bestMs) {
          bestMs = val; bestCode = key;
        }
      }
    }
    return bestCode ? { time: fmtMs(bestMs), code: bestCode } : null;
  }, [chartData]);

  const flColor = fastestLap ? (byCode[fastestLap.code]?.color ?? '#a855f7') : '#a855f7';

  return (
    <header className="canvas-head">
      <div className="flex flex-row">
        <div id="summary" className="title">
          <span className="nm font">{race.name.toUpperCase()} — RACE</span>
          <span className="eb">{activeYear} · ROUND {String(race.round).padStart(2, '0')} · {race.country}</span>
        </div>
        <div className= "px-10">
          <WeatherWidget weather={weather} />
        </div>
        
      </div>
      

       
      <div className="meta">
        <div className="item">
          <span className="lbl">DISTANCE</span>
          <span className="v">{race.laps} LAPS</span>
        </div>
        <div className="item">
          <span className="lbl">LEADER</span>
          <span className="v" style={{ color: leaderColor }}>{leaderCode ?? '—'}</span>
        </div>
        <div className="item">
          <span className="lbl">FASTEST</span>
          <span className="v" style={{ color: fastestLap ? flColor : undefined }}>
            {fastestLap ? fastestLap.time : '—'}
          </span>
        </div>
      </div>
     
    </header>
  );
}

export default function RacePage() {
  const [activeRound, setActiveRound] = useState(1);
  const [activeYear, setActiveYear] = useState(2025);
  const [savedSessionKey] = useState(() => {
    const v = localStorage.getItem('f1_session_key');
    return v ? Number(v) : null;
  });

  const pickRace = (r: Race) => {
    setActiveRound(r.round);
    setActiveYear(r.year);
    if (r.session_key) localStorage.setItem('f1_session_key', String(r.session_key));
  };

  const [races, setRaces] = useState<Race[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL;
    const seasons = [2026,2025, 2024, 2023];
    Promise.all(
      seasons.map(s =>
        fetch(`${base}/api/races?season=${s}`)
          .then(r => r.json())
          .then(data => (data.races ?? []).map((session: any, i: number) => adaptRace({ ...session, year: s }, i)))
          .catch(() => [] as Race[])
      )
    )
      .then(results => {
        const all = results.flat();
        if (all.length > 0) setRaces(all);
      })
      .finally(() => setLoading(false));
  }, []);

  // Restore the previously selected race by session_key — only once on first load
  const didRestore = useRef(false);
  useEffect(() => {
    if (!savedSessionKey || races.length === 0 || didRestore.current) return;
    didRestore.current = true;
    const saved = races.find(r => r.session_key === savedSessionKey);
    if (saved) {
      setActiveRound(saved.round);
      setActiveYear(saved.year);
    }
  }, [races]);

  const race = races.find(r => r.round === activeRound && r.year === activeYear) ?? races[0];

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [lapStartOffsets, setLapStartOffsets] = useState<number[]>([]); // ms from race start, index = lap-1
  const [rawPositions, setRawPositions] = useState<any[]>([]);
  const [rawIntervals, setRawIntervals] = useState<any[]>([]);
  const [numToCode, setNumToCode] = useState<Record<string, string>>({});

  const [chartData, setChartData] = useState<LapEntry[]>([]);
  const [rankings, setRankings]   = useState<LapRanking[]>([]);
  const [stintsByCode, setStintsByCode] = useState<Record<string, Stint[]>>({});
  const [pitStops, setPitStops] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [weatherReadings, setWeatherReadings] = useState<any[]>([]);
  const [lapTimestamps, setLapTimestamps] = useState<string[]>([]); // index = lap-1, value = date_start
  const [raceDurationMs, setRaceDurationMs] = useState(0);
  const [lastLapByNum, setLastLapByNum] = useState<Record<string, number>>({});
  const [rawLaps, setRawLaps] = useState<any[]>([]);
  const [rawRaceControl, setRawRaceControl] = useState<any[]>([]);
   

  // Derive current lap from the time scrubber position
  const lap = useMemo(() => {
    if (!lapStartOffsets.length) return 1;
    let l = 1;
    for (let i = 0; i < lapStartOffsets.length; i++) {
      if (currentTimeMs >= lapStartOffsets[i]) {
        l = i + 1;
      } else {
        break;
      }
    }
    return l;
  }, [currentTimeMs, lapStartOffsets]);


  // When a race is picked, fetch real lap count + drivers
  useEffect(() => {
    if (!race?.session_key) return;
    const key = race.session_key;
    const base = import.meta.env.VITE_API_URL;

    // Fetch all race data in one shot so the canvas only renders when everything is ready
    setDataLoading(true);
    Promise.all([
      fetch(`${base}/api/total-laps?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/laps?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/tyres?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/drivers?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/pitstops?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/position?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/weather?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/intervals?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/race-controls?session_key=${key}`).then(r => r.json()),
    ])
      .then(([totalLapsData, lapData, tyreData, driverData, pitData, posData, weatherData, intervalData, raceControlData]) => {
        if (totalLapsData.total_laps) {
          setRaces(prev => prev.map(r =>
            r.session_key === key ? { ...r, laps: totalLapsData.total_laps } : r
          ));
        }
        if (weatherData.readings?.length) setWeatherReadings(weatherData.readings);
        if (driverData.drivers?.length) setDrivers(driverData.drivers.map(adaptDriver));
        if (pitData.pit_stops?.length) setPitStops(pitData.pit_stops);
        const numToCode: Record<string, string> = {};
        (driverData.drivers ?? []).forEach((d: any) => {
          numToCode[String(d.driver_number)] = d.name_acronym;
        });
        setNumToCode(numToCode);
        setRawPositions(posData.positions ?? []);
        setRawIntervals(intervalData.intervals ?? []);
        setRawRaceControl(raceControlData.controls ?? []);

        if (lapData.laps?.length) {
          setRawLaps(lapData.laps);

          // Last lap completed per driver — distinguishes DNFs (few laps) from finishers
          const lastLap: Record<string, number> = {};
          for (const l of lapData.laps) {
            const num = String(l.driver_number);
            if (num && l.lap_number && (!lastLap[num] || l.lap_number > lastLap[num])) {
              lastLap[num] = l.lap_number;
            }
          }
          setLastLapByNum(lastLap);

          // Build lap→timestamp map: for each lap number, take the earliest date_start across all drivers
          const lapDateMap: Record<number, string> = {};
          for (const lap of lapData.laps) {
            const n = lap.lap_number;
            if (n && lap.date_start && (!lapDateMap[n] || lap.date_start < lapDateMap[n])) {
              lapDateMap[n] = lap.date_start;
            }
          }
          const maxLap = Math.max(...Object.keys(lapDateMap).map(Number));
          const timestamps = Array.from({ length: maxLap }, (_, i) => lapDateMap[i + 1] ?? '');
          setLapTimestamps(timestamps);

          // Build ms-from-race-start offsets for the time scrubber
          const raceStartEpoch = timestamps[0] ? new Date(timestamps[0]).getTime() : 0;
          const offsets = timestamps.map(ts => ts ? new Date(ts).getTime() - raceStartEpoch : 0);
          setLapStartOffsets(offsets);

          // Race ends when the LAST driver crosses the finish line.
          // Sum date_start + lap_duration for every lap row and take the maximum.
          let raceEndEpoch = raceStartEpoch;
          for (const l of lapData.laps) {
            if (l.date_start && l.lap_duration) {
              const end = new Date(l.date_start).getTime() + l.lap_duration * 1000;
              if (end > raceEndEpoch) raceEndEpoch = end;
            }
          }
          setRaceDurationMs(raceEndEpoch - raceStartEpoch);

          // For finished races, start the scrubber at the end
          const today = new Date().toISOString().slice(0, 10);
          if (race.date < today) {
            setCurrentTimeMs(raceEndEpoch - raceStartEpoch);
          }

          const rawPositions = posData.positions ?? [];
          const { chartData, rankings } = processRealLapData(lapData.laps, numToCode, rawPositions);

          // OpenF1 often omits the final lap for all/some drivers — pad to race.laps
          // so the scrubber's last position shows correct final standings.
          while (chartData.length < race.laps && chartData.length > 0) {
            const last = chartData[chartData.length - 1];
            chartData.push({ ...last, lap: chartData.length + 1 });
            const lastR = rankings[rankings.length - 1];
            rankings.push({ ...lastR, lap: rankings.length + 1 });
          }

          let realResults = buildResultsFromLaps(lapData.laps, numToCode, rankings);

          // Merge real tyre/stop data into results
          if (tyreData.stints?.length) {
            const stints = processStintData(tyreData.stints, numToCode, race.laps);
            setStintsByCode(stints);
            realResults = realResults.map(r => {
              const s = stints[r.code] ?? [];
              return {
                ...r,
                tyres: s.map(st => st.compound),
                stops: Math.max(0, s.length - 1),
              };
            });
          }

          setChartData(chartData);
          setRankings(rankings);
          setResults(realResults);
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [race?.session_key]);

  const [selectedCode, setSelectedCode] = useState('');

  // Driver who holds the fastest lap up to the current scrubber position
  const fastestLapCode = useMemo(() => {
    let bestMs = Infinity, bestCode = '';
    const limit = Math.min(lap, chartData.length);
    for (let i = 0; i < limit; i++) {
      const entry = chartData[i];
      for (const [key, val] of Object.entries(entry)) {
        if (key === 'lap' || key.endsWith('_pos') || key.endsWith('_gap')) continue;
        if (typeof val === 'number' && val > 0 && val < 120000 && val < bestMs) {
          bestMs = val; bestCode = key;
        }
      }
    }
    return bestCode || null;
  }, [chartData, lap]);

  const raceStartEpoch = lapTimestamps[0] ? new Date(lapTimestamps[0]).getTime() : 0;

  // Set of driver numbers that are still active at the current race time.
  // A driver is active if their latest position entry is within 3 minutes of now.
  // DNS drivers have no entries → never added. DNF drivers' entries stop at retirement.

  const liveRanking = useMemo(() => {
    if (!rawPositions.length || !raceStartEpoch) return rankings[lap - 1] ?? null;

    const targetEpoch = raceStartEpoch + currentTimeMs;

    // Latest position entry per driver up to current time
    const latestPos: Record<string, { pos: number; epoch: number }> = {};
    for (const p of rawPositions) {
      if (!p.date) continue;
      const epoch = new Date(p.date).getTime();
      if (epoch > targetEpoch) continue;
      const num = String(p.driver_number);
      if (!latestPos[num] || epoch > latestPos[num].epoch) {
        latestPos[num] = { pos: p.position, epoch };
      }
    }

    if (!Object.keys(latestPos).length) return rankings[lap - 1] ?? null;

    // Latest gap_to_leader per driver from interval data up to current time
    const latestGap: Record<string, number> = {};
    for (const iv of rawIntervals) {
      if (!iv.date || iv.gap_to_leader == null) continue;
      const epoch = new Date(iv.date).getTime();
      if (epoch > targetEpoch) continue;
      const num = String(iv.driver_number);
      latestGap[num] = iv.gap_to_leader * 1000; // seconds → ms
    }

    const order = Object.entries(latestPos)
      .sort((a, b) => a[1].pos - b[1].pos)
      .map(([num, { pos }]) => {
        const code = numToCode[num] ?? num;
        return { code, pos, gapMs: latestGap[num] ?? 0 };
      });

    return { lap, order };
  }, [rawPositions, rawIntervals, currentTimeMs, raceStartEpoch, rankings, lap, numToCode]);

  // Best lap per driver up to the current scrubber time — only counts laps completed before now
  const liveBestByCode = useMemo(() => {
    if (!rawLaps.length || !raceStartEpoch) return {} as Record<string, string>;
    const targetEpoch = raceStartEpoch + currentTimeMs;
    const bestMs: Record<string, number> = {};
    for (const l of rawLaps) {
      if (!l.date_start || !l.lap_duration || l.is_pit_out_lap || l.lap_number === 1) continue;
      const completedAt = new Date(l.date_start).getTime() + l.lap_duration * 1000;
      if (completedAt > targetEpoch) continue;
      const code = numToCode[String(l.driver_number)];
      if (!code) continue;
      const ms = l.lap_duration * 1000;
      if (!bestMs[code] || ms < bestMs[code]) bestMs[code] = ms;
    }
    const out: Record<string, string> = {};
    for (const [code, ms] of Object.entries(bestMs)) {
      const m = Math.floor(ms / 60000);
      const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
      out[code] = `${m}:${s}`;
    }
    return out;
  }, [rawLaps, currentTimeMs, raceStartEpoch, numToCode]);

  // The most recent race control message up to the current scrubber time
  const raceControlStatus = useMemo(() => {
  if (!rawRaceControl.length || !raceStartEpoch) return null;
  const targetEpoch = raceStartEpoch + currentTimeMs;

  let latest: any = null;
  for (const msg of rawRaceControl) {
    if (!msg.date) continue;
    const epoch = new Date(msg.date).getTime();
    if (epoch > targetEpoch) continue;
    if (!latest || epoch > new Date(latest.date).getTime()) {
      latest = msg;
    }
  }
  return latest;
}, [rawRaceControl, currentTimeMs, raceStartEpoch]);

  // Weather reading closest to the current lap's timestamp
  const weather = useMemo(() => {
    if (!weatherReadings.length) return {};
    const lapDate = lapTimestamps[lap - 1];
    if (!lapDate) return weatherReadings[weatherReadings.length - 1];
    const lapMs = new Date(lapDate).getTime();
    let closest = weatherReadings[0];
    let minDiff = Infinity;
    for (const r of weatherReadings) {
      if (!r.date) continue;
      const diff = Math.abs(new Date(r.date).getTime() - lapMs);
      if (diff < minDiff) { minDiff = diff; closest = r; }
    }
    return closest;
  }, [weatherReadings, lapTimestamps, lap]);

  // Clear state when switching races
  useEffect(() => {
    setChartData([]);
    setRankings([]);
    setResults([]);
    setStintsByCode({});
    setPitStops([]);
    setWeatherReadings([]);
    setLapTimestamps([]);
    setLapStartOffsets([]);
    setCurrentTimeMs(0);
    setRawPositions([]);
    setRawIntervals([]);
    setNumToCode({});
    setRaceDurationMs(0);
    setLastLapByNum({});
    setRawLaps([]);
    setRawRaceControl([]);
  }, [race?.session_key]);

  // Live polling: re-fetch volatile data every 10s for today's (live) races (untested)
  const isLive = race?.date === new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!isLive || !race?.session_key) return;
    const key = race.session_key;
    const base = import.meta.env.VITE_API_URL;

    const poll = () => {
      Promise.all([
        fetch(`${base}/api/race-controls?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/position?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/intervals?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/laps?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/total-laps?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/pitstops?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/tyres?session_key=${key}`).then(r => r.json()),
        fetch(`${base}/api/weather?session_key=${key}`).then(r => r.json()),
      ])
        .then(([rcData, posData, ivData, lapData, totalLapsData, pitData, tyreData, weatherData]) => {
          setRawRaceControl(rcData.controls ?? []);
          setRawPositions(posData.positions ?? []);
          setRawIntervals(ivData.intervals ?? []);
          if (pitData.pit_stops?.length) setPitStops(pitData.pit_stops);
          if (weatherData.readings?.length) setWeatherReadings(weatherData.readings);

          if (totalLapsData.total_laps) {
            setRaces(prev => prev.map(r =>
              r.session_key === key ? { ...r, laps: totalLapsData.total_laps } : r
            ));
          }

          if (lapData.laps?.length) {
            setRawLaps(lapData.laps);

            const lastLap: Record<string, number> = {};
            for (const l of lapData.laps) {
              const num = String(l.driver_number);
              if (num && l.lap_number && (!lastLap[num] || l.lap_number > lastLap[num])) {
                lastLap[num] = l.lap_number;
              }
            }
            setLastLapByNum(lastLap);

            const lapDateMap: Record<number, string> = {};
            for (const l of lapData.laps) {
              const n = l.lap_number;
              if (n && l.date_start && (!lapDateMap[n] || l.date_start < lapDateMap[n])) {
                lapDateMap[n] = l.date_start;
              }
            }
            const maxLap = Math.max(...Object.keys(lapDateMap).map(Number));
            const timestamps = Array.from({ length: maxLap }, (_, i) => lapDateMap[i + 1] ?? '');
            setLapTimestamps(timestamps);

            const raceStart = timestamps[0] ? new Date(timestamps[0]).getTime() : 0;
            const offsets = timestamps.map(ts => ts ? new Date(ts).getTime() - raceStart : 0);
            setLapStartOffsets(offsets);

            let raceEnd = raceStart;
            for (const l of lapData.laps) {
              if (l.date_start && l.lap_duration) {
                const end = new Date(l.date_start).getTime() + l.lap_duration * 1000;
                if (end > raceEnd) raceEnd = end;
              }
            }
            setRaceDurationMs(raceEnd - raceStart);

            if (tyreData.stints?.length) {
              const stints = processStintData(tyreData.stints, numToCode as any, totalLapsData.total_laps ?? maxLap);
              setStintsByCode(stints);
            }
          }
        })
        .catch(() => {});
    };

    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [isLive, race?.session_key]);

  // Scan all race control messages up to current time to determine caution state.
  // Only SC deployed, VSC deployed, and red flags trigger the glow.
  // Green only appears when EXITING one of those periods.
  const glowClass = useMemo(() => {
    if (!rawRaceControl.length || !raceStartEpoch) return '';
    const targetEpoch = raceStartEpoch + currentTimeMs;

    let lastCautionEpoch = 0;
    let cautionType = ''; // 'yellow' | 'red'
    let lastResumeEpoch = 0;

    for (const msg of rawRaceControl) {
      if (!msg.date) continue;
      const epoch = new Date(msg.date).getTime();
      if (epoch > targetEpoch) continue;

      const cat = msg.category ?? '';
      const flag = msg.flag ?? '';
      const text = (msg.message ?? '').toUpperCase();

      // Caution starts: SC deployed, VSC deployed, or red flag
      if (flag === 'RED') {
        lastCautionEpoch = epoch;
        cautionType = 'red';
      } else if (cat === 'SafetyCar' && (text.includes('DEPLOYED') || text.includes('VIRTUAL SAFETY CAR'))) {
        lastCautionEpoch = epoch;
        cautionType = 'yellow';
      }

      // Caution ends: SC ending, green flag, or clear — only counts if a caution started
      if (lastCautionEpoch > 0) {
        if (cat === 'SafetyCar' && (text.includes('IN THIS LAP') || text.includes('ENDING'))) {
          lastResumeEpoch = epoch;
        } else if (flag === 'GREEN' || flag === 'CLEAR') {
          lastResumeEpoch = epoch;
        }
      }
    }

    if (lastCautionEpoch > lastResumeEpoch) {
      return cautionType === 'red' ? 'glow-red' : 'glow-yellow';
    }
    if (lastResumeEpoch > 0 && lastResumeEpoch > lastCautionEpoch) {
      return 'glow-green';
    }
    return '';
  }, [rawRaceControl, currentTimeMs, raceStartEpoch]);

  // Yellow/red stay active indefinitely. Green flashes for 5s then fades out.
  const [activeGlow, setActiveGlow] = useState('');
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);

    if (glowClass === 'glow-yellow' || glowClass === 'glow-red') {
      setActiveGlow(glowClass);
    } else if (glowClass === 'glow-green') {
      setActiveGlow('glow-green');
      glowTimerRef.current = setTimeout(() => {
        setActiveGlow('glow-exit');
        glowTimerRef.current = setTimeout(() => setActiveGlow(''), 800);
      }, 5000);
    } else if (activeGlow && activeGlow !== 'glow-exit') {
      setActiveGlow('glow-exit');
      glowTimerRef.current = setTimeout(() => setActiveGlow(''), 800);
    }

    return () => { if (glowTimerRef.current) clearTimeout(glowTimerRef.current); };
  }, [glowClass]);

  if (loading || !race) {
    return (
      <div className="app app--loading">
        <div className="loading-screen">
          <div className="loading-logo">F1</div>
          <p className="loading-label">CONNECTING TO TIMING DATA</p>
          <div className="loading-bar"><div className="loading-bar-fill" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`race-status ${activeGlow}`}>
      <div className="app">
        <TopBar
          race={race}
          currentLap={lap}
          totalLaps={race.laps}
          races={races}
          onChangeRace={pickRace}
        />
        <div className="shell">
          <Sidebar
            races={races}
            activeRound={activeRound}
            activeYear={activeYear}
            onPick={pickRace}
          />

          <main className="canvas">
            {dataLoading && (
              <div className="canvas-loader">
                <div className="canvas-loader-inner">
                  <div className="cl-flag">
                    {countryFlagUrl(race.country)
                      ? <img src={countryFlagUrl(race.country)!} alt={race.country} className="cl-flag-img" />
                      : '🏁'}
                  </div>
                  <p className="cl-race">{race.name.toUpperCase()}</p>
                  <p className="cl-sub">LOADING RACE DATA</p>
                  <div className="loading-bar"><div className="loading-bar-fill" /></div>
                </div>
              </div>
            )}
            <CanvasHead
              race={race} activeYear={activeYear}
              lap={lap} rankings={rankings}
              chartData={chartData} drivers={drivers}
              weather={weather}
            />

      
            <Scrubber
              raceDurationMs={raceDurationMs}
              currentTimeMs={currentTimeMs}
              currentLap={lap}
              totalLaps={race.laps}
              onChange={setCurrentTimeMs}
            />
            
            <StatGrid
              chartData={chartData} stintsByCode={stintsByCode}
              pitStops={pitStops} rankings={rankings}
              currentLap={lap} results={results} drivers={drivers}
            />
            <div id="map-classi" className='panel flex 2xl:!flex-row'>
              <TrackMap
                sessionKey={race.session_key!}
                lap={lap}
                totalLaps={race.laps}
                currentTimeMs={currentTimeMs}
                raceStartEpoch={raceStartEpoch}
                drivers={drivers}
                lastLapByNum={lastLapByNum}
              />
              <Classification
                results={results} drivers={drivers}
                selectedCode={selectedCode} onSelect={setSelectedCode}
                currentRanking={liveRanking} currentLap={lap}
                stintsByCode={stintsByCode}
                pitStops={pitStops}
                fastestLapCode={fastestLapCode} activeSeason={activeYear}
                liveBestByCode={liveBestByCode} />
            </div>
            
            <LapChart
              results={results} drivers={drivers}
              chartData={chartData}
              totalLaps={race.laps} currentLap={lap}
              selectedCode={selectedCode} />
            <TyreStrategy
              results={results} drivers={drivers}
              totalLaps={race.laps} currentLap={lap}
              rankings={rankings}
              stintsByCode={stintsByCode}
              selectedCode={selectedCode} onSelect={setSelectedCode} />

            <BottomRaceDrawer
              race={race}
              currentLap={lap}
              results={results}
              drivers={drivers}
              rankings={rankings}
              raceControlMessages={rawRaceControl}
              currentTimeMs={currentTimeMs}
              raceStartEpoch={raceStartEpoch}
            />
            
          </main>
        </div>
      </div>
    </div>
  );
}