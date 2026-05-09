import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import './styles.css';
import { type Race, type Driver, type Result } from './data';
import { fetchRaces, fetchRaceData } from './api';
import Classification from './components/Classification';
import LapChart from './components/LapChart';
import StatGrid from './components/StatGrid';
import TopBar from './components/TopBar';
import TyreStrategy from './components/TyreStrategy';
import Sidebar from './components/Sidebar';

interface ScrubberProps {
  totalLaps: number;
  lap: number;
  onChange: Dispatch<SetStateAction<number>>;
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
      <input type="range" min="1" max={totalLaps || 1} value={lap}
             onChange={e => onChange(Number(e.target.value))} />
      <span className="lap-v">{lap}/{totalLaps || '—'}</span>
    </div>
  );
}

interface RacePickerProps {
  races: Race[];
  activeRound: number;
  onPick: (race: Race) => void;
  onClose: () => void;
}

function RacePicker({ races, activeRound, onPick, onClose }: RacePickerProps) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">SELECT RACE · 2023</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-list">
          {races.map(r => (
            <button key={r.round}
                    className={"modal-row" + (r.round === activeRound ? " active" : "")}
                    onClick={() => { onPick(r); onClose(); }}>
              <span className="rd">R{String(r.round).padStart(2, '0')}</span>
              <span className="nm">{r.name}</span>
              <span className="dt">{r.date}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [races, setRaces]           = useState<Race[]>([]);
  const [activeRound, setActiveRound] = useState(1);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [results, setResults]       = useState<Result[]>([]);
  const [totalLaps, setTotalLaps]   = useState(0);
  const [lap, setLap]               = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Load the race list once on mount
  useEffect(() => {
    fetchRaces(2023)
      .then(r => {
        setRaces(r);
        setActiveRound(r[0]?.round ?? 1);
      })
      .catch(e => setError(e.message));
  }, []);

  const race = races.find(r => r.round === activeRound) ?? races[0];

  // Load lap/tyre/driver data whenever the selected race changes
  useEffect(() => {
    if (!race?.session_key) return;
    setLoading(true);
    setError(null);
    fetchRaceData(race.session_key)
      .then(({ drivers, results, totalLaps }) => {
        setDrivers(drivers);
        setResults(results);
        setTotalLaps(totalLaps);
        setLap(1);
        setSelectedCode(results[0]?.code ?? '');
        // Patch total laps back into the race list so the scrubber is accurate
        setRaces(prev => prev.map(r =>
          r.round === race.round ? { ...r, laps: totalLaps } : r
        ));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [race?.session_key]);

  if (error) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#e10600' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ color: '#9ea2ac', fontSize: '0.85rem' }}>{error}</div>
          <div style={{ color: '#6a6e78', fontSize: '0.75rem', marginTop: 8 }}>Is the backend running on port 8000?</div>
        </div>
      </div>
    );
  }

  const leader = results[0];

  return (
    <div className="app">
      <TopBar
        race={race ?? { session_key: 0, round: 1, name: '—', date: '—', country: '—', laps: 0 }}
        currentLap={lap}
        totalLaps={totalLaps}
        onChangeRace={() => setPickerOpen(true)}
      />
      <div className="shell">
        <Sidebar
          races={races}
          activeRound={activeRound}
          onPick={r => setActiveRound(r.round)}
        />
        <main className="canvas">
          <header className="canvas-head">
            <div className="title">
              <span className="eb">2023 · ROUND {String(race?.round ?? 1).padStart(2, '0')} · {race?.country ?? '—'}</span>
              <span className="nm">{(race?.name ?? '—').toUpperCase()} — RACE</span>
            </div>
            <div className="meta">
              <div className="item"><span className="lbl">DISTANCE</span><span className="v">{totalLaps || '—'} LAPS</span></div>
              <div className="item"><span className="lbl">WINNER</span><span className="v" style={{ color: '#e10600' }}>{leader?.code ?? '—'}</span></div>
              <div className="item"><span className="lbl">FASTEST</span><span className="v">{leader?.best ?? '—'}</span></div>
            </div>
          </header>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6a6e78' }}>
              Loading race data...
            </div>
          ) : (
            <>
              <Scrubber totalLaps={totalLaps} lap={lap} onChange={setLap} />

              {leader && <StatGrid leader={leader} />}

              <Classification
                results={results} drivers={drivers}
                selectedCode={selectedCode} onSelect={setSelectedCode} />

              <LapChart
                results={results} drivers={drivers}
                totalLaps={totalLaps || 1} currentLap={lap}
                selectedCode={selectedCode} />

              <TyreStrategy
                results={results} drivers={drivers}
                totalLaps={totalLaps || 1}
                selectedCode={selectedCode} onSelect={setSelectedCode} />
            </>
          )}
        </main>
      </div>

      {pickerOpen && races.length > 0 && (
        <RacePicker
          races={races} activeRound={activeRound}
          onPick={r => setActiveRound(r.round)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
