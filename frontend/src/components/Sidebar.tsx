import { useState } from 'react';
import { type Race } from '../data';

interface Props {
  races: Race[];
  activeRound: number;
  activeYear: number;
  onPick: (race: Race) => void;
}

export default function Sidebar({ races, activeRound, activeYear, onPick }: Props) {
  const filteredRaces = races.filter(r => r.year === activeYear);

  const [activeView, setActiveView] = useState<string>("classification");

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);

    console.log(id, element);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      setActiveView(id);
    }
  };

  return (
    <aside className="sidebar">
      <div className="rail-eb">{activeYear} SEASON</div>

      <div className="rail-list">
        {filteredRaces.map(r => (
          <button
            key={r.round}
            className={
              "rail-item" +
              (r.round === activeRound && r.year === activeYear ? " active" : "")
            }
            onClick={() => onPick(r)}
          >
            <span className="rd">R{String(r.round).padStart(2, '0')}</span>
            <span className="nm">{r.name}</span>
            <span className="dt">{r.date}</span>
          </button>
        ))}
      </div>

      <div className="rail-eb" style={{ marginTop: 24 }}>VIEWS</div>

      <div className="rail-views">
        <button
          onClick={() => scrollToSection('classification')}
          className={activeView === "classification" ? "rail-view active" : "rail-view"}
        >
          CLASSIFICATION
        </button>

        <button
          onClick={() => scrollToSection('lap-chart')}
          className={activeView === "lap-chart" ? "rail-view active" : "rail-view"}
        >
          LAP CHART
        </button>

        <button
          onClick={() => scrollToSection('tyre-strategy')}
          className={activeView === "tyre-strategy" ? "rail-view active" : "rail-view"}
        >
          TYRE STRATEGY
        </button>

        <button
          onClick={() => scrollToSection('telemetry')}
          className={activeView === "telemetry" ? "rail-view active" : "rail-view"}
        >
          TELEMETRY
        </button>

        <button
          onClick={() => scrollToSection('pit-stops')}
          className={activeView === "pit-stops" ? "rail-view active" : "rail-view"}
        >
          PIT STOPS
        </button>
      </div>
    </aside>
  );
}