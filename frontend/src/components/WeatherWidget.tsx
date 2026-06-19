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
      <div className="dial-label">{label}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isIndicator ? '#fff' : t.isFilled ? color : 'rgba(255,255,255,0.12)'}
            strokeWidth={t.isIndicator ? 2 : 1.2}
            strokeLinecap="round"
            style={t.isIndicator
              ? { filter: 'drop-shadow(0 0 2px #fff)' }
              : t.isFilled
                ? { filter: `drop-shadow(0 0 1px ${color}70)` }
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

interface WeatherData {
  air_temperature?: number | null;
  track_temperature?: number | null;
  humidity?: number | null;
  wind_speed?: number | null;
  rainfall?: number | null;
}

interface Props {
  weather?: WeatherData;
}

export default function WeatherWidget({ weather = {} }: Props) {
  const stats = [
    { label: 'AIR',   value: weather.air_temperature   ?? 26.4, min: 0,  max: 50,  color: '#f97316', unit: '°C',   fmt: (v: number) => v.toFixed(1) },
    { label: 'TRACK', value: weather.track_temperature ?? 41.8, min: 0,  max: 70,  color: '#ef4444', unit: '°C',   fmt: (v: number) => v.toFixed(1) },
    { label: 'HUM',   value: weather.humidity          ?? 68,   min: 0,  max: 100, color: '#38bdf8', unit: '%',    fmt: (v: number) => Math.round(v).toString() },
    { label: 'WIND',  value: weather.wind_speed        ?? 12,   min: 0,  max: 50,  color: '#22d3ee', unit: 'km/h', fmt: (v: number) => Math.round(v).toString() },
    { label: 'RAIN',  value: (weather.rainfall         ?? 0) > 0 ? 1 : 0, min: 0, max: 1, color: '#a855f7', unit: weather.rainfall ?? 0 > 0 ? 'YES' : 'NO', fmt: () => weather.rainfall ?? 0 > 0 ? 'YES' : 'NO' },
  ];

  return (
    <div className="weather-widget">
      {stats.map(s => (
        <DialGauge
          key={s.label}
          label={s.label}
          value={s.value}
          min={s.min}
          max={s.max}
          color={s.color}
          unit={s.unit}
          display={s.fmt(s.value)}
        />
      ))}
    </div>
  );
}
