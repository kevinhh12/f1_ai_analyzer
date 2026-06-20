import { useEffect, useState, useMemo, useRef } from 'react';

interface Sample { date: string; x: number; y: number; }
interface Bounds { x_min: number; x_max: number; y_min: number; y_max: number; }

interface Props {
  sessionKey: number;
  lap: number;
  totalLaps: number;
  currentTimeMs: number;
  raceStartEpoch: number;
  drivers: { num: string; code: string; color: string }[];
  lastLapByNum?: Record<string, number>;
}

export default function TrackMap({ sessionKey, lap, totalLaps, currentTimeMs, raceStartEpoch, drivers, lastLapByNum }: Props) {
  const base = import.meta.env.VITE_API_URL;

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [outlineSamples, setOutlineSamples] = useState<Sample[]>([]);
  const [lapSamples, setLapSamples] = useState<Record<string, Sample[]>>({});

  // Per-session lap cache: avoids re-fetching a lap already loaded this session
  const lapCache = useRef<Map<number, Record<string, Sample[]>>>(new Map());

  useEffect(() => {
    if (!sessionKey) return;
    setBounds(null);
    setOutlineSamples([]);
    lapCache.current = new Map(); // clear on session change

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

        // Seed lap 1 into cache so it doesn't get re-fetched
        if (lap1Data.drivers) lapCache.current.set(1, lap1Data.drivers);
      })
      .catch(() => {});
  }, [sessionKey]);

  // Background prefetch: warm the cache sequentially with a delay to avoid rate-limiting OpenF1
  useEffect(() => {
    if (!sessionKey || !totalLaps) return;
    let cancelled = false;

    async function prefetchAll() {
      for (let l = 1; l <= totalLaps && !cancelled; l++) {
        if (lapCache.current.has(l)) continue;
        try {
          const data = await fetch(`${base}/api/location?session_key=${sessionKey}&lap=${l}`).then(r => r.json());
          if (!cancelled && data.drivers) lapCache.current.set(l, data.drivers);
        } catch {}
        // 300ms gap between requests to stay under OpenF1 rate limits
        await new Promise(res => setTimeout(res, 300));
      }
    }

    prefetchAll();
    return () => { cancelled = true; };
  }, [sessionKey, totalLaps]);

  // Debounced lap fetch — 250ms delay prevents flooding during fast scrubbing
  useEffect(() => {
    if (!sessionKey || !lap) return;

    // Serve from cache immediately if available
    const cached = lapCache.current.get(lap);
    if (cached) {
      setLapSamples(cached);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${base}/api/location?session_key=${sessionKey}&lap=${lap}`)
        .then(r => r.json())
        .then(data => {
          const drivers = data.drivers ?? {};
          lapCache.current.set(lap, drivers);
          setLapSamples(drivers);
        })
        .catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
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
      // +1 tolerance: lapped finishers (1 lap behind leader) stay visible; genuine DNFs don't
      if (lastLapByNum && lastLapByNum[num] != null && lap > lastLapByNum[num] + 1) continue;

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
  }, [lapSamples, bounds, drivers, currentTimeMs, raceStartEpoch, lap, lastLapByNum]);

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
