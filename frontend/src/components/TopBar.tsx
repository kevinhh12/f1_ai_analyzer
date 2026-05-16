import { useState, useRef, useEffect } from 'react';
import { type Race } from '../data';



interface Props {
  race: Race;
  currentLap: number;
  totalLaps: number;
  onChangeRace: (race: Race) => void;
  races: Race[];
}

export default function TopBar({ race, currentLap, totalLaps, onChangeRace, races }: Props) {
  const [open, setOpen] = useState(false);
  const years = [...new Set(races.map(r => r.year))];
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedYear(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setSelectedYear(null);
    setOpen(o => !o);
  }

  const filteredRaces = selectedYear ? races.filter(r => r.year === selectedYear) : [];

  return (
    <header className="topbar">
      <div className="brand">
        <div className="wm">
          <span>F1</span><span style={{ color: '#e10600' }}>ANALYZER</span>
        </div>
      </div>

      <div className="topbar-divider" />

      <div className="race-dropdown-wrap" ref={ref}>
        <button className="race-button" onClick={handleOpen}>
          <span className="eb">{String(race.year)} · ROUND {String(race.round).padStart(2, '0')}</span>
          <span className="nm">{race.name.toUpperCase()} 
            <span className="eb" >{open ? '▲' : '▼'}</span>
          </span>
          
        </button>

        {open && (
          <div className="race-dropdown">
            {/* Step 1: year only */}
            {selectedYear === null && (
              <div className="dropdown-years-only">
                <div className="dropdown-step-label">SELECT SEASON</div>
                {years.map(y => (
                  <button
                    key={y}
                    className="dropdown-year-row"
                    onClick={() => setSelectedYear(y)}
                  >
                    <span className="yr">{y}</span>
                    <span className="arr">›</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: races for selected year */}
            {selectedYear !== null && (
              <>
                <button className="dropdown-back" onClick={() => setSelectedYear(null)}>
                  ‹ {selectedYear}
                </button>
                <div className="dropdown-races">
                  {filteredRaces.map(r => (
                    <button
                      key={r.round}
                      className={'dropdown-row' + (r.round === race.round && r.year === race.year ? ' active' : '')}
                      onClick={() => { onChangeRace(r); setOpen(false); setSelectedYear(null); }}
                    >
                      <span className="rd">R{String(r.round).padStart(2, '0')}</span>
                      <span className="nm">{r.name}</span>
                      <span className="dt">{r.date}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="topbar-spacer" />

      <div className="lap-counter">
        <span className="eb">LAP</span>
        <span className="lap-v">{currentLap}<span className="of">/{totalLaps}</span></span>
      </div>
    </header>
  );
}