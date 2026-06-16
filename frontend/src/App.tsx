import { useState, useEffect, useMemo } from 'react';
import './css/styles.css';
import { F1_DATA, generateLapData, processRealLapData, buildResultsFromLaps, processStintData, type Race, type Driver, type Result, type LapEntry, type LapRanking, type Stint } from './data';


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
import Classification from './components/Classification';
import LapChart from './components/LapChart';
import StatGrid from './components/StatGrid';
import TopBar from './components/TopBar';
import TyreStrategy from './components/TyreStrategy';
import Sidebar from './components/Sidebar';
import TrackMap from './components/TrackMap';
import BottomRaceDrawer from './components/BottomDrawer';

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

export default function App() {
  const D = F1_DATA;
  const [activeRound, setActiveRound] = useState(1);
  const [activeYear, setActiveYear] = useState(2025);
  const [races, setRaces] = useState<Race[]>(D.races);
  const [drivers, setDrivers] = useState<Driver[]>(D.drivers);
  const [results, setResults] = useState<Result[]>(D.results);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/races?season=2025`)
      .then(r => r.json())
      .then(data => {
        const adapted = data.races.map(adaptRace);
        if (adapted.length > 0) setRaces(adapted);
      })
      .catch(() => {}); // silently keep mock data if backend is offline
  }, []);

  const race = races.find(r => r.round === activeRound && r.year === activeYear) ?? races[0];
  const [lap, setLap] = useState(1);

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

    // Fetch laps + tyres in parallel, then combine
    Promise.all([
      fetch(`${base}/api/laps?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/tyres?session_key=${key}`).then(r => r.json()),
      fetch(`${base}/api/drivers?session_key=${key}`).then(r => r.json()),
    ])
      .then(([lapData, tyreData, driverData]) => {
        const numToCode: Record<number, string> = {};
        (driverData.drivers ?? []).forEach((d: any) => {
          numToCode[d.driver_number] = d.name_acronym;
        });

        if (lapData.laps?.length) {
          const { chartData, rankings } = processRealLapData(lapData.laps, numToCode);
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
      .catch(() => {});
  }, [race?.session_key]);

  const [selectedCode, setSelectedCode] = useState('VER');

  useEffect(() => {
    if (lap > race.laps) setLap(Math.min(lap, race.laps));
  }, [race.laps]);

  // Start with mock data, replaced by real data when a race is fetched
  const mockLapData = useMemo(() => generateLapData(D.results, race.laps), [race.laps]);
  const [chartData, setChartData] = useState<LapEntry[]>(mockLapData.chartData);
  const [rankings, setRankings]   = useState<LapRanking[]>(mockLapData.rankings);
  const [stintsByCode, setStintsByCode] = useState<Record<string, Stint[]>>({});

  // Reset to mock data when race changes before real data arrives
  useEffect(() => {
    setChartData(mockLapData.chartData);
    setRankings(mockLapData.rankings);
    setResults(D.results);
    setStintsByCode({});
  }, [race?.session_key]);

  const leader = results[0];

  return (
    <div className="app">
      <TopBar
        race={race}
        currentLap={lap}
        totalLaps={race.laps}
        races={races}
        onChangeRace={r => { setActiveRound(r.round); setActiveYear(r.year); }}
      />
      <div className="shell">
        <Sidebar
          races={races}
          activeRound={activeRound}
          activeYear={activeYear}
          onPick={r => { setActiveRound(r.round); setActiveYear(r.year); }}
        />

        <main className="canvas">
          <header className="canvas-head">
            <div id="summary" className="title">
              <span className="eb">{activeYear} · ROUND {String(race.round).padStart(2, '0')} · {race.country}</span>
              <span className="nm">{race.name.toUpperCase()} — RACE</span>
            </div>
            <div className="meta">
              <div className="item"><span className="lbl">DISTANCE</span><span className="v">{race.laps} LAPS</span></div>
              <div className="item"><span className="lbl">WINNER</span><span className="v" style={{color:'#e10600'}}>VER</span></div>
              <div className="item"><span className="lbl">FASTEST</span><span className="v">1:14.260</span></div>
            </div>
          </header>

     
          <Scrubber totalLaps={race.laps} lap={lap} onChange={setLap} />
          
          <StatGrid leader={leader} />
          <div id="map-classi" className='panel flex 2xl:!flex-row'>
            <TrackMap track={race.track} year={activeYear} />
            <Classification
              results={results} drivers={drivers}
              selectedCode={selectedCode} onSelect={setSelectedCode}
              rankings={rankings} currentLap={lap} />
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