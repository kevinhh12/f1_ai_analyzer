import { useEffect, useState, useMemo } from 'react';

interface Sample { date: string; x: number; y: number; }
interface Bounds { x_min: number; x_max: number; y_min: number; y_max: number; }

interface Props {
  sessionKey: number;
  lap: number;
  currentTimeMs: number;
  raceStartEpoch: number;
  drivers: { num: string; code: string; color: string }[];
}

export default function TrackMap({ sessionKey, lap, currentTimeMs, raceStartEpoch, drivers }: Props) {
  const base = import.meta.env.VITE_API_URL;

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [outlineSamples, setOutlineSamples] = useState<Sample[]>([]);
  const [lapSamples, setLapSamples] = useState<Record<string, Sample[]>>({});

  useEffect(() => {
    if (!sessionKey) return;
    setBounds(null);
    setOutlineSamples([]);

    Promise.all([
      fetch(`${base}/api/location-bounds?session_key=${sessionKey}`).then(r => r.json()),
      fetch(`${base}/api/location?session_key=${sessionKey}&lap=1`).then(r => r.json()),
    ])
      .then(([boundsData, lap1Data]) => {
        if (boundsData.x_min == null) return;
        setBounds({ x_min: boundsData.x_min, x_max: boundsData.x_max, y_min: boundsData.y_min, y_max: boundsData.y_max });

        const driverSamples = Object.values(lap1Data.drivers ?? {}) as Sample[][];
        if (!driverSamples.length) return;

        const best = driverSamples.reduce((a, b) => a.length >= b.length ? a : b);
        setOutlineSamples([...best].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch(() => {});
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey || !lap) return;
    fetch(`${base}/api/location?session_key=${sessionKey}&lap=${lap}`)
      .then(r => r.json())
      .then(data => setLapSamples(data.drivers ?? {}))
      .catch(() => {});
  }, [sessionKey, lap]);

  const viewBox = useMemo(() => {
    if (!bounds) return '0 0 1000 1000';
    const w = bounds.x_max - bounds.x_min;
    const h = bounds.y_max - bounds.y_min;
    const pad = Math.min(w, h) * 0.04;
    return `${bounds.x_min - pad} ${-bounds.y_max - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [bounds]);

  const outlinePoints = useMemo(() => {
    if (!outlineSamples.length) return '';
    const pts = outlineSamples.map(s => `${s.x},${-s.y}`);
    pts.push(pts[0]);
    return pts.join(' ');
  }, [outlineSamples]);

  const dots = useMemo(() => {
    if (!bounds) return [];
    const byNum = Object.fromEntries(drivers.map(d => [d.num, d]));
    const result: { code: string; color: string; x: number; y: number }[] = [];
    const targetEpoch = raceStartEpoch + currentTimeMs;

    for (const [num, samples] of Object.entries(lapSamples)) {

      const driver = byNum[num];
      if (!driver || !samples.length) continue;

      let closest = samples[0];
      let minDiff = Infinity;
      for (const s of samples) {
        if (!s.date) continue;
        const diff = Math.abs(new Date(s.date).getTime() - targetEpoch);
        if (diff < minDiff) { minDiff = diff; closest = s; }
      }

      result.push({ code: driver.code, color: driver.color, x: closest.x, y: -closest.y });
    }
    return result;
  }, [lapSamples, bounds, drivers, currentTimeMs, raceStartEpoch]);

  const dotR = useMemo(() => {
    if (!bounds) return 50;
    return Math.min(bounds.x_max - bounds.x_min, bounds.y_max - bounds.y_min) * 0.018;
  }, [bounds]);

  return (
    <section id="trackmap" className="panel">
      <div className="tm-canvas">
        {!outlinePoints && (
          <div className="tm-loading">LOADING TRACK…</div>
        )}
        {bounds && (
          <svg
            viewBox={viewBox}
            className="tm-svg p-8"
            preserveAspectRatio="xMidYMid meet"
          >
            <polyline
              points={outlinePoints}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={dotR * 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={outlinePoints}
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={dotR * 0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {dots.map(d => (
              <g
                key={d.code}
                style={{
                  transform: `translate(${d.x}px, ${d.y}px)`,
                  transition: 'transform 0.25s linear',
                }}
              >
                <circle r={dotR} fill={d.color} opacity={0.95} />
                <text
                  y={dotR * 0.08}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={dotR * 0.85}
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {d.code}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}
