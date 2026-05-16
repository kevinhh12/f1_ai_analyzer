import { useState, useEffect } from 'react';
import './css/styles.css';
import { F1_DATA } from './data';
import Classification from './components/Classification';
import LapChart from './components/LapChart';
import StatGrid from './components/StatGrid';
import TopBar from './components/TopBar';
import TyreStrategy from './components/TyreStrategy';
import Sidebar from './components/Sidebar';
import TrackMap from './components/TrackMap';

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
  const [activeRound, setActiveRound] = useState(6);
  const latestYear = Math.max(...D.races.map(r => r.year));
  const [activeYear, setActiveYear] = useState(latestYear);
  const race = D.races.find(r => r.round === activeRound && r.year === activeYear) ?? D.races[0];
  const [lap, setLap] = useState(47);
  const [selectedCode, setSelectedCode] = useState('VER');

  useEffect(() => {
    if (lap > race.laps) setLap(Math.min(lap, race.laps));
  }, [race.laps]);

  const leader = D.results[0];

  return (
    <div className="app">
      <TopBar
        race={race}
        currentLap={lap}
        totalLaps={race.laps}
        races={D.races}
        onChangeRace={r => { setActiveRound(r.round); setActiveYear(r.year); }}
      />
      <div className="shell">
        <Sidebar
          races={D.races}
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
          <div id="map-classi" className='panel'>
            <TrackMap track={race.track} year={activeYear} />
            <Classification
            results={D.results} drivers={D.drivers}
            selectedCode={selectedCode} onSelect={setSelectedCode} />

          </div>
          
          <LapChart
            results={D.results} drivers={D.drivers}
            totalLaps={race.laps} currentLap={lap}
            selectedCode={selectedCode} />
          <TyreStrategy
            results={D.results} drivers={D.drivers}
            totalLaps={race.laps}
            selectedCode={selectedCode} onSelect={setSelectedCode} />
        </main>
      </div>
    </div>
  );
}