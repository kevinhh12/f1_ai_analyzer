interface DialProps {
  value: number;
  min: number;
  max: number;
  color: string;
  label: string;
  unit: string;
  display: string;
}

function DialGauge({ value, min, max, color, label, unit, display }: DialProps) {
  const size = 48;
  const cx = size / 2;
  const cy = size / 2;
  const totalTicks = 36;
  // Start at bottom-left (225° from 12 o'clock), sweep 270° clockwise to bottom-right
  const startAngle = 225;
  const sweepAngle = 270;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const filledTicks = Math.round(pct * totalTicks);

  const ticks = Array.from({ length: totalTicks }, (_, i) => {
    const angle = startAngle + (sweepAngle / (totalTicks - 1)) * i;
    const rad = (angle - 90) * (Math.PI / 180);
    const isIndicator = i === filledTicks - 1 && filledTicks > 0;
    const isFilled = i < filledTicks;
    const outerR = 19;
    const innerR = isIndicator ? 13 : isFilled ? 15 : 16;
    return {
      x1: cx + outerR * Math.cos(rad),
      y1: cy + outerR * Math.sin(rad),
      x2: cx + innerR * Math.cos(rad),
      y2: cy + innerR * Math.sin(rad),
      isFilled,
      isIndicator,
    };
  });

  return (
    <div className="dial-card">
      <div className="dial-label ">{label}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isIndicator ? '#fff' : t.isFilled ? color : 'rgba(255,255,255,0.12)'}
            strokeWidth={t.isIndicator ? 2.5 : 1.5}
            strokeLinecap="round"
            style={t.isIndicator
              ? { filter: 'drop-shadow(0 0 3px #fff)' }
              : t.isFilled
                ? { filter: `drop-shadow(0 0 2px ${color}70)` }
                : undefined}
          />
        ))}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize="7" fontWeight="700" fontFamily="var(--font-mono)">
          {display}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle"
          fill="rgba(255,255,255,0.4)" fontSize="5" fontFamily="var(--font-mono)">
          {unit}
        </text>
      </svg>
      <div className="dial-lowhigh">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

const FAKE_WEATHER = [
  { label: 'AIR TEMP',  value: 26.4, min: 0,  max: 50,  color: '#f97316', unit: '°C',   display: '26.4' },
  { label: 'TRACK',     value: 41.8, min: 0,  max: 70,  color: '#ef4444', unit: '°C',   display: '41.8' },
  { label: 'HUMIDITY',  value: 68,   min: 0,  max: 100, color: '#38bdf8', unit: '%',    display: '68'   },
  { label: 'WIND',      value: 12,   min: 0,  max: 50,  color: '#22d3ee', unit: 'km/h', display: '12'   },
  { label: 'RAIN',      value: 15,   min: 0,  max: 100, color: '#a855f7', unit: '%',    display: '15'   },
];

export default function WeatherWidget() {
  return (
    <div className="weather-widget">
      {FAKE_WEATHER.map(stat => (
        <DialGauge key={stat.label} {...stat} />
      ))}
    </div>
  );
}
