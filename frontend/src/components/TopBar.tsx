import { type Race } from '../data';

interface Props {
  race: Race;
  currentLap: number;
  totalLaps: number;
  onChangeRace: () => void;
}



export default function TopBar({ race, currentLap, totalLaps, onChangeRace }: Props) {
  const isLive = false; // Placeholder for demo; real app determines live status via backend data (e.g. /position endpoint). Can also be used to trigger "LIVE" pill in UI.

  return (
    <header className="topbar">
      <div className="brand">
        <div className="wm">
          <span>F1</span><span style={{ color: '#e10600' }}>ANALYZER</span>
        </div>
      </div>

      <div className="topbar-divider" />

      <button className="race-button" onClick={onChangeRace}>
        <span className="eb">{String(race.year)} · ROUND {String(race.round).padStart(2, '0')}</span>
        <span className="nm">{race.name.toUpperCase()}</span>
      </button>

      {isLive && (
        <span className="live-pill">
          <span className="live-dot" /> LIVE
        </span>
      )}

      <div className="topbar-spacer" />

      <div className="lap-counter">
        <span className="eb">LAP</span>
        <span className="lap-v">{currentLap}<span className="of">/{totalLaps}</span></span>
      </div>
    </header>
  );
}
