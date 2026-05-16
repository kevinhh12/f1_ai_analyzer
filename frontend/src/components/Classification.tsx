import { type Driver, type Result, type TyreCompound } from '../data';

const TYRES: Record<TyreCompound, string> = {
  S: '#ff2e2e',
  M: '#ffd400',
  H: '#f3f3f3',
  I: '#00d27a',
  W: '#2bb6ff',
};

interface Props {
  results: Result[];
  drivers: Driver[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

export default function Classification({ results, drivers, selectedCode, onSelect }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));
  const teamLogoURL = (team: string) => `https://media.formula1.com/image/upload/c_lfill,w_48/q_auto/v1740000001/common/f1/2026/${team.toLowerCase().replace(/\s/g, '')}/2026${team.toLowerCase().replace(/\s/g, '')}logowhite.webp`;
  return (
    <section id="classification" className='panel'>
      <header className="cl-head">
        <span className="cl-h pos">POS</span>
        <span className="cl-h num">#</span>
        <span className="cl-h drv">DRIVER</span>
        <span className="cl-h tm">TEAM</span>
        <span className="cl-h best">BEST LAP</span>
        <span className="cl-h tyre">STINTS</span>
        <span className="cl-h stops">PITS</span>
        <span className="cl-h gap">GAP</span>
      </header>
      <div className="cl-body">
        {results.map(r => {
          const d = byCode[r.code] ?? { team: '—', color: '#3f434c', name: r.code, num: r.num, code: r.code };
          const sel = r.code === selectedCode;
          const lead = r.pos === 1;
          return (
            <button
              key={r.code}
              className={"cl-row" + (lead ? " lead" : "") + (sel ? " sel" : "")}
              onClick={() => onSelect(r.code)}
              style={{ borderLeftColor: d.color }}
            >
              <span className="cl-h pos">{r.pos === 1 ? 'P1' : r.pos}</span>
              <span className="cl-h num">{d.num ?? r.num}</span>
              <span className="cl-h drv">
                <strong>{r.code}</strong> <span className="srn">{d.name}</span>
              </span>
              <div className='teams'>
                
                <div className='logo-background' style={{ backgroundColor: d.color }}>
                  <img className='logo' src={teamLogoURL(d.team)} alt={d.team} />
                </div>
                <span className="cl-h tm" style={{ color: d.color }}>{d.team.toUpperCase()}</span>
              </div>
              
              <span className="cl-h best">{r.best}</span>
              <span className="cl-h tyre">
                {r.tyres.map((t, i) => (
                  <span key={i} className="t-dot" style={{ borderColor: TYRES[t] }} />
                ))}
              </span>
              <span className="cl-h stops">{r.stops}</span>
              <span className="cl-h gap">{r.gap}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
