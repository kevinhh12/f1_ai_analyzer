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

const LAPS_BY_CIRCUIT: Record<string, number> = {
  Melbourne: 58,
  Shanghai: 56,
  Suzuka: 53,
  Bahrain: 57,
  Jeddah: 50,
  Miami: 57,
  Imola: 63,
  Monaco: 78,
  Barcelona: 66,
  Montreal: 70,
  Spielberg: 71,
  Silverstone: 52,
  Budapest: 70,
  Spa: 44,
  Zandvoort: 72,
  Monza: 53,
  Baku: 51,
  Singapore: 62,
  Austin: 56,
  'Mexico City': 71,
  'São Paulo': 71,
  'Las Vegas': 50,
  Lusail: 57,
  'Yas Marina': 58,
};

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
    laps: LAPS_BY_CIRCUIT[session.circuit_short_name] ?? 58, // real laps loaded after pick
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

interface ScrubberProps {
  totalLaps: number;
  lap: number;
  onChange: React.Dispatch<React.SetStateAction<number>>;
}

function Scrubber({ totalLaps, lap, onChange }: ScrubberProps) {

  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onChange(l => l >= totalLaps ? 1 : l + 1);
    }, 250);
    return () => clearInterval(id);
  }, [playing, totalLaps, onChange]);

  return (
    <div className="scrubber">
      <button className="play" onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="lap-lbl">LAP</span>
      <input type="range" min="1" max={totalLaps} value={lap}
             onChange={e => onChange(Number(e.target.value))} />
      <span className="lap-v">{lap}/{totalLaps}</span>
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
}

function CanvasHead({ race, activeYear, lap, rankings, chartData, drivers }: CanvasHeadProps) {
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
          <WeatherWidget />
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
    const seasons = [2025, 2024, 2023];
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
  const [lap, setLap] = useState(1);

  const [chartData, setChartData] = useState<LapEntry[]>([]);
  const [rankings, setRankings]   = useState<LapRanking[]>([]);
  const [stintsByCode, setStintsByCode] = useState<Record<string, Stint[]>>({});
  const [pitStops, setPitStops] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // When a race is picked, fetch real lap count + drivers
  useEffect(() => {
    if (!race?.session_key) return;
    const key = race.session_key;
    const base = import.meta.env.VITE_API_URL;

    // Fetch total laps
    fetch(`${base}/api/total-laps?session_key=${key}`)
      .then(r => r.json())
      .then(data => {
        if (data.total_laps) {
          setRaces(prev => prev.map(r =>
            r.session_key === key ? { ...r, laps: data.total_laps } : r
          ));
        }
      })
      .catch(() => {});

    // Fetch real drivers
    fetch(`${base}/api/drivers?session_key=${key}`)
      .then(r => r.json())
      .then(data => {
        if (data.drivers?.length) {
          setDrivers(data.drivers.map(adaptDriver));
        }
      })
      .catch(() => {});

    // Fetch laps + tyres + pitstops + positions in parallel, then combine
    setDataLoading(true);
    Promise.all([
      fetch(`${base}/api/laps?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/tyres?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/drivers?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/pitstops?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/position?session_key=${key}`).then(r => r.json()),
    ])
      .then(([lapData, tyreData, driverData, pitData, posData]) => {
        if (pitData.pit_stops?.length) setPitStops(pitData.pit_stops);
        const numToCode: Record<number, string> = {};
        (driverData.drivers ?? []).forEach((d: any) => {
          numToCode[d.driver_number] = d.name_acronym;
        });

        if (lapData.laps?.length) {
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

  useEffect(() => {
    if (race && lap > race.laps) setLap(Math.min(lap, race.laps));
  }, [race?.laps]);

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

  // Clear state when switching races; set scrubber to last lap for historical races
  useEffect(() => {
    setChartData([]);
    setRankings([]);
    setResults([]);
    setStintsByCode({});
    setPitStops([]);
    if (race) {
      const today = new Date().toISOString().slice(0, 10);
      setLap(race.date < today ? race.laps : 1);
    }
  }, [race?.session_key]);

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
          />

     
          <Scrubber totalLaps={race.laps} lap={lap} onChange={setLap} />
          
          <StatGrid
            chartData={chartData} stintsByCode={stintsByCode}
            pitStops={pitStops} rankings={rankings}
            currentLap={lap} results={results} drivers={drivers}
          />
          <div id="map-classi" className='panel flex 2xl:!flex-row'>
            <TrackMap track={race.track} year={activeYear} />
            <Classification
              results={results} drivers={drivers}
              selectedCode={selectedCode} onSelect={setSelectedCode}
              rankings={rankings} currentLap={lap}
              stintsByCode={stintsByCode}
              fastestLapCode={fastestLapCode} activeSeason={activeYear} />
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
          />
          
        </main>
      </div>
    </div>
  );
}