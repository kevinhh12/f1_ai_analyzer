// Top bar: brand mark + live session pill + lap counter.
// Sticky, backdrop-blurred — drops a shadow once content scrolls beneath.
export default function TopBar({ race, currentLap, totalLaps, onChangeRace }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">F1</div>
        <div className="wm">
          <span>F1</span><span style={{color:'#e10600'}}>ANALYZER</span>
        </div>
      </div>

      <div className="topbar-divider" />

      <button className="race-button" onClick={onChangeRace}>
        <span className="eb">2023 · ROUND {String(race.round).padStart(2,'0')}</span>
        <span className="nm">{race.name.toUpperCase()}</span>
      </button>

      <span className="live-pill">
        <span className="live-dot" /> LIVE
      </span>

      <div className="topbar-spacer" />

      <div className="lap-counter">
        <span className="eb">LAP</span>
        <span className="lap-v">{currentLap}<span className="of">/{totalLaps}</span></span>
      </div>
    </header>
  );
};
