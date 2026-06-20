import { useEffect, useState, useMemo, useRef } from 'react';

interface TelemetrySample {
  date: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number;
}

interface Props {
  sessionKey: number;
  driverNumber: string;
  driverCode: string;
  driverColor: string;
  lap: number;
  currentTimeMs: number;
  raceStartEpoch: number;
}

const MAX_RPM = 13000;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function DriverTelemetryCard({
  sessionKey, driverNumber, driverCode, driverColor, lap, currentTimeMs, raceStartEpoch,
}: Props) {
  const base = import.meta.env.VITE_API_URL;
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef<Map<string, TelemetrySample[]>>(new Map());

  useEffect(() => {
    if (!sessionKey || !driverNumber || !lap) return;
    const key = `${sessionKey}_${driverNumber}_${lap}`;
    const cached = cache.current.get(key);
    if (cached) { setSamples(cached); setLoading(false); return; }

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`${base}/api/car-data?session_key=${sessionKey}&driver_number=${driverNumber}&lap=${lap}`)
        .then(r => r.json())
        .then(data => {
          const s = data.samples ?? [];
          cache.current.set(key, s);
          setSamples(s);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [sessionKey, driverNumber, lap]);

  useEffect(() => { cache.current = new Map(); }, [sessionKey]);

  const telem = useMemo(() => {
    if (!samples.length) return { speed: 0, rpm: 0, gear: 0, throttle: 0, brake: 0, drs: false };
    const targetEpoch = raceStartEpoch + currentTimeMs;
    let closest = samples[0];
    let minDiff = Infinity;
    for (const s of samples) {
      if (!s.date) continue;
      const diff = Math.abs(new Date(s.date).getTime() - targetEpoch);
      if (diff < minDiff) { minDiff = diff; closest = s; }
    }
    return {
      speed: closest.speed ?? 0,
      rpm: closest.rpm ?? 0,
      gear: closest.gear ?? 0,
      throttle: closest.throttle ?? 0,
      brake: closest.brake ?? 0,
      drs: closest.drs >= 10,
    };
  }, [samples, currentTimeMs, raceStartEpoch]);

  const cx = 200, cy = 200;
  const rO = 166, wO = 15;
  const rI = 126, wI = 22;

  const rpmP = clamp(telem.rpm / MAX_RPM, 0, 1);
  const rpmEnd = 135 + 270 * rpmP;
  const redStart = 135 + 270 * 0.86;
  const inRed = rpmP > 0.86;
  const rpmCol = inRed ? '#FF3B3B' : '#2D9CFF';

  const thrEnd = 135 + 132 * clamp(telem.throttle / 100, 0, 1);
  const brkEnd = 273 + 132 * clamp(telem.brake / 100, 0, 1);

  if (loading) {
    return (
      <div className="telem-card telem-card--loading" style={{ borderTopColor: driverColor }}>
        <div className="telem-card__head">
          <span className="telem-card__code" style={{ color: driverColor }}>{driverCode}</span>
          <span className="telem-card__label">TELEMETRY</span>
        </div>
        <div className="telem-card__loader">
          <div className="telem-card__spinner" style={{ borderTopColor: driverColor }} />
          <span className="telem-card__loader-text">LOADING TELEMETRY</span>
        </div>
      </div>
    );
  }

  return (
    <div className="telem-card" style={{ borderTopColor: driverColor }}>
      <div className="telem-card__head">
        <span className="telem-card__code" style={{ color: driverColor }}>{driverCode}</span>
        <span className="telem-card__label">TELEMETRY</span>
      </div>

      <div className="telem-card__gauge-wrap">
        <svg viewBox="0 0 400 400" className="telem-card__gauge-svg">
          <defs>
            <path id="tp-rpm" d={arc(cx, cy, rO, 248, 292)} />
            <path id="tp-thr" d={arc(cx, cy, rI, 152, 252)} />
            <path id="tp-brk" d={arc(cx, cy, rI, 288, 388)} />
          </defs>

          {/* Outer — RPM */}
          <path d={arc(cx, cy, rO, 135, 405)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={wO} />
          <path d={arc(cx, cy, rO, redStart, 405)} fill="none" stroke="rgba(255,59,59,0.26)" strokeWidth={wO} />
          <path d={arc(cx, cy, rO, 135, rpmEnd)} fill="none" stroke={rpmCol} strokeWidth={wO} strokeLinecap="butt" style={{ transition: 'all .12s linear' }} />

          {/* Inner — throttle / brake */}
          <path d={arc(cx, cy, rI, 135, 405)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={wI} />
          <path d={arc(cx, cy, rI, 135, thrEnd)} fill="none" stroke="#28C76F" strokeWidth={wI} strokeLinecap="butt" style={{ transition: 'all .12s linear' }} />
          <path d={arc(cx, cy, rI, 273, brkEnd)} fill="none" stroke="#FF3B3B" strokeWidth={wI} strokeLinecap="butt" style={{ transition: 'all .12s linear' }} />
          <path d={arc(cx, cy, rI, 268, 272)} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={wI} />

          {/* Curved labels */}
          <text fill="rgba(255,255,255,0.82)" fontSize="11" fontFamily="Saira, sans-serif" fontWeight="600" letterSpacing="2.5">
            <textPath href="#tp-rpm" startOffset="50%" textAnchor="middle">RPM</textPath>
          </text>
          <text fill="rgba(255,255,255,0.95)" fontSize="11" fontFamily="Saira, sans-serif" fontWeight="600" letterSpacing="2.5">
            <textPath href="#tp-thr" startOffset="50%" textAnchor="middle">THROTTLE</textPath>
          </text>
          <text fill="rgba(255,255,255,0.95)" fontSize="11" fontFamily="Saira, sans-serif" fontWeight="600" letterSpacing="2.5">
            <textPath href="#tp-brk" startOffset="50%" textAnchor="middle">BRAKE</textPath>
          </text>
        </svg>

        <div className="telem-card__center">
          <div className="telem-card__speed">{telem.speed}</div>
          <div className="telem-card__speed-unit">KMH</div>
          <div className="telem-card__rpm">{telem.rpm.toLocaleString('en-US')} <span className="telem-card__rpm-unit">RPM</span></div>
          <div className={`telem-card__drs ${telem.drs ? 'telem-card__drs--on' : ''}`}>DRS</div>
          <div className="telem-card__gear-wrap">
            <span className="telem-card__gear-label">GEAR</span>
            <span className="telem-card__gear-val">{telem.gear}</span>
          </div>
        </div>
      </div>

      
    </div>
  );
}
