import { type Driver, type Result } from '../data';

interface Props {
  results: Result[];
  drivers: Driver[];
  selectedCode: string;
  totalLaps: number;
  currentLap: number;
}

// Lap-by-lap chart showing position changes — SVG line chart, leader bold red.
export default function LapChart({ results, drivers, selectedCode, totalLaps, currentLap }: Props) {
  const W = 880, H = 300, PAD = { l: 40, r: 16, t: 12, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const N = totalLaps;
  const POS = 10;

  function hash(s: string, n: number): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((h ^ n * 2654435761) >>> 0) / 4294967295;
  }

  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  const lines = results.slice(0, POS).map(r => {
    const d = byCode[r.code] ?? { color: '#9ea2ac' };
    const points: [number, number][] = [];
    let pos = r.pos + (r.code === 'VER' ? 0 : Math.round(hash(r.code, 0) * 4 - 2));
    pos = Math.max(1, Math.min(POS, pos));
    for (let lap = 1; lap <= N; lap++) {
      const drift = Math.round((hash(r.code, lap) - 0.5) * 1.6);
      pos = Math.max(1, Math.min(POS, pos + drift));
      const conv = lap / N;
      const blended = Math.round(pos * (1 - conv) + r.pos * conv);
      points.push([lap, blended]);
    }
    const path = points.map(([l, p], i) => {
      const x = PAD.l + (l - 1) / (N - 1) * innerW;
      const y = PAD.t + (p - 1) / (POS - 1) * innerH;
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return { code: r.code, color: d.color, path, sel: r.code === selectedCode, lead: r.code === 'VER' };
  });

  const lapX = PAD.l + (currentLap - 1) / (N - 1) * innerW;

  return (
    <section id="lap-chart" className='panel'>
      <div className="panel-head">
        <span className="panel-eb">LAP CHART</span>
        <span className="panel-meta">POSITIONS · LAP 1 — {N}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="lap-svg">
        {/* gridlines */}
        {Array.from({ length: POS }).map((_, i) => (
          <line key={'h' + i}
            x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + i / (POS - 1) * innerH} y2={PAD.t + i / (POS - 1) * innerH}
            stroke="#1c1e23" strokeWidth="1" />
        ))}
        {[0, .25, .5, .75, 1].map((t, i) => (
          <line key={'v' + i}
            y1={PAD.t} y2={H - PAD.b}
            x1={PAD.l + t * innerW} x2={PAD.l + t * innerW}
            stroke="#1c1e23" strokeWidth="1" />
        ))}
        {/* lap labels */}
        {[1, Math.round(N * .25), Math.round(N * .5), Math.round(N * .75), N].map((l, i) => (
          <text key={'lx' + i}
            x={PAD.l + (l - 1) / (N - 1) * innerW} y={H - PAD.b + 18}
            fontSize="10" fontFamily="JetBrains Mono, monospace"
            fill="#6a6e78" textAnchor="middle">L{l}</text>
        ))}
        {/* position labels */}
        {[1, 3, 5, 7, 10].map(p => (
          <text key={'p' + p} x={PAD.l - 8} y={PAD.t + (p - 1) / (POS - 1) * innerH + 3}
            fontSize="10" fontFamily="JetBrains Mono, monospace"
            fill="#6a6e78" textAnchor="end">P{p}</text>
        ))}
        {/* current lap marker */}
        <line x1={lapX} x2={lapX} y1={PAD.t} y2={H - PAD.b}
              stroke="#e10600" strokeWidth="1.5" strokeDasharray="2,3" opacity="0.7" />
        {/* lines — non-selected first, selected last (on top) */}
        {lines.filter(l => !l.sel).map(l => (
          <path key={l.code} d={l.path}
                stroke={l.color} strokeWidth={l.lead ? 2 : 1.2}
                fill="none" opacity={l.lead ? 0.95 : 0.45}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {lines.filter(l => l.sel).map(l => (
          <path key={l.code} d={l.path}
                stroke={l.color} strokeWidth="2.5"
                fill="none" opacity="1"
                strokeLinejoin="round" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 4px ' + l.color + ')' }} />
        ))}
      </svg>
    </section>
  );
}
