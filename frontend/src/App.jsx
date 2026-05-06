import { useState, useEffect } from 'react';
import './styles.css';
import { F1_DATA } from './data.js';
import Classification from './components/Classification';
import LapChart from './components/LapChart';
import StatGrid from './components/StatGrid';
import TopBar from './components/TopBar';
import TyreStrategy from './components/TyreStrategy';
import Sidebar from './components/Sidebar';

function Scrubber({ totalLaps, lap, onChange }) {
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
             onChange={e => onChange(Number(e.target.value))}/>
      <span className="lap-v">{lap}/{totalLaps}</span>
    </div>
  );
};

function RacePicker({ races, activeRound, onPick, onClose }) {
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
              <span className="rd">R{String(r.round).padStart(2,'0')}</span>
              <span className="nm">{r.name}</span>
              <span className="dt">{r.date}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const D = F1_DATA;
  const [activeRound, setActiveRound] = useState(6);
  const race = D.races.find(r => r.round === activeRound) || D.races[0];
  const [lap, setLap] = useState(47);
  const [pickerOpen, setPickerOpen] = useState(false);
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
        onChangeRace={() => setPickerOpen(true)}
      />
      <div className="shell">
        <Sidebar
          races={D.races}
          activeRound={activeRound}
          onPick={r => setActiveRound(r.round)}
        />
        <main className="canvas">
          <header className="canvas-head">
            <div className="title">
              <span className="eb">2023 · ROUND {String(race.round).padStart(2,'0')} · {race.country}</span>
              <span className="nm">{race.name.toUpperCase()} — RACE</span>
            </div>
            <div className="meta">
              <div className="item"><span className="lbl">DISTANCE</span><span className="v">{race.laps} LAPS</span></div>
              <div className="item"><span className="lbl">WINNER</span><span className="v" style={{color:'#e10600'}}>VER</span></div>
              <div className="item"><span className="lbl">FASTEST</span><span className="v">1:14.260</span></div>
            </div>
          </header>

          <Scrubber totalLaps={race.laps} lap={lap} onChange={setLap}/>

          <StatGrid leader={leader}/>

          <Classification
            results={D.results} drivers={D.drivers}
            selectedCode={selectedCode} onSelect={setSelectedCode}/>

          <LapChart
            results={D.results} drivers={D.drivers}
            totalLaps={race.laps} currentLap={lap}
            selectedCode={selectedCode}/>

          <TyreStrategy
            results={D.results} drivers={D.drivers}
            totalLaps={race.laps}
            selectedCode={selectedCode} onSelect={setSelectedCode}/>
        </main>
      </div>

      {pickerOpen && (
        <RacePicker
          races={D.races} activeRound={activeRound}
          onPick={r => setActiveRound(r.round)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};
