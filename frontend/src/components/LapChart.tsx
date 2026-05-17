"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts"
import { type Driver, type Result } from '../data';
import { ChartContainer, type ChartConfig } from "../components/ui/chart"

interface Props {
  results: Result[];
  drivers: Driver[];
  selectedCode: string;
  totalLaps: number;
  currentLap: number;
}

function msToLabel(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

function msToAxisTick(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Generates per-driver, per-lap data.
// Each driver gets a `{code}` key (numeric ms lap time) used as the Y value.
// Pit stop laps are stored as null so recharts renders a gap instead of a spike.
// Position is stored as `{code}_pos` for the tooltip.
function generateLapData(results: Result[], totalLaps: number) {
  const n = results.length;
  const BASE_MS = 74200;

  const gridOffset: Record<string, number> = {
    VER: 0, LEC: 1, NOR: -1, HAM: 2, SAI: -2,
    RUS: 1, ALO: -3, PER: 3, OCO: -1, ALB: 0,
  };

  const startPos: Record<string, number> = {};
  results.forEach(r => {
    const raw = r.pos + (gridOffset[r.code] ?? 0);
    startPos[r.code] = Math.max(1, Math.min(n, raw));
  });

  const data: Record<string, number | null>[] = [];

  for (let lap = 1; lap <= totalLaps; lap++) {
    const t = (lap - 1) / Math.max(totalLaps - 1, 1);
    const entry: Record<string, number | null> = { lap };

    results.forEach(r => {
      const pit1 = Math.floor(totalLaps * 0.35);
      const pit2 = Math.floor(totalLaps * 0.65);
      const pitWindow = Math.floor(totalLaps * 0.06);

      // --- Position (for tooltip only) ---
      let pos = startPos[r.code] + (r.pos - startPos[r.code]) * t;
      if (r.stops >= 1 && lap >= pit1 && lap < pit1 + pitWindow) {
        const wave = Math.sin((Math.PI * (lap - pit1)) / pitWindow);
        pos += wave * (2 + r.pos * 0.3);
      }
      if (r.stops >= 2 && lap >= pit2 && lap < pit2 + pitWindow) {
        const wave = Math.sin((Math.PI * (lap - pit2)) / pitWindow);
        pos += wave * (1.5 + r.pos * 0.2);
      }
      entry[`${r.code}_pos`] = Math.max(1, Math.min(n, pos));

      // --- Lap time (Y axis value) ---
      const isPit1 = r.stops >= 1 && lap === pit1;
      const isPit2 = r.stops >= 2 && lap === pit2;

      // Pit stop laps: base time + ~26s in pit lane → sharp spike downward
      if (isPit1 || isPit2) {
        entry[r.code] = BASE_MS + 26000 + (r.pos - 1) * 200;
        return;
      }

      // Lap 1: formation + cold tyres
      if (lap === 1) {
        entry[r.code] = BASE_MS + 9000 + (r.pos - 1) * 300;
        return;
      }

      // Which stint lap are we on? → drives tire degradation
      let stintLap: number;
      if (r.stops === 0 || lap < pit1)         stintLap = lap - 1;
      else if (r.stops === 1 || lap < pit2)     stintLap = lap - pit1;
      else                                       stintLap = lap - pit2;

      let ms = BASE_MS;

      // Tire degradation: gradual fall-off within each stint
      ms += stintLap * 55;

      // Backmarkers run slightly slower
      ms += (r.pos - 1) * 110;

      // High-frequency noise: makes lines look like real telemetry
      const noise =
        Math.sin(lap * 7.31 + r.pos * 13.7) * 320 +
        Math.sin(lap * 3.17 + r.pos * 5.3)  * 180 +
        Math.sin(lap * 19.1 + r.pos * 2.9)  * 90;
      ms += noise;

      // Traffic / safety car effect mid-race for lower runners
      if (r.pos >= 6 && lap > Math.floor(totalLaps * 0.45) && lap < Math.floor(totalLaps * 0.50)) {
        ms += 600;
      }

      entry[r.code] = Math.max(70000, ms);
    });

    data.push(entry);
  }

  return data;
}

// Tooltip: selected driver only — shows lap, position, and lap time
function LapTooltip({ active, payload, label, drivers, selectedCode }: any) {
  if (!active || !payload?.length) return null;

  const selected = payload.find((p: any) => p.dataKey === selectedCode);
  if (!selected || selected.value == null) return null;

  const d = (drivers as Driver[]).find(d => d.code === selectedCode);
  const pos  = Math.round(selected.payload[`${selectedCode}_pos`] ?? 0);
  const time = msToLabel(selected.value);

  return (
    <div className="lap-tooltip">
      <div className="lap-tooltip-header">LAP {label}</div>
      <div className="lap-tooltip-row" style={{ color: d?.color ?? '#fff' }}>
        <span className="ltt-pos">P{pos}</span>
        <span className="ltt-code">{selectedCode}</span>
        <span className="ltt-time">{time}</span>
      </div>
    </div>
  );
}

export default function LapChart({ results, drivers, selectedCode, totalLaps, currentLap }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  const chartData = useMemo(
    () => generateLapData(results, totalLaps),
    [results, totalLaps]
  );

  const chartConfig: ChartConfig = useMemo(() => (
    Object.fromEntries(
      results.map(r => [r.code, { label: r.code, color: byCode[r.code]?.color ?? '#888' }])
    )
  ), [results, drivers]);

  // X axis: ticks every 5 laps for short races (≤20 laps), every 10 laps for typical
  const tickEvery = totalLaps <= 20 ? 5 : totalLaps <= 60 ? 10 : 15;
  const xTicks = Array.from(
    { length: Math.floor(totalLaps / tickEvery) + 1 },
    (_, i) => i * tickEvery
  ).filter(t => t > 0 && t <= totalLaps);

  // Y axis: reversed so fast laps sit at top, pit spikes go downward
  // Domain covers normal racing (72–81s) + pit stop laps (~100s)
  const yMin = 71000;
  const yMax = 102000;
  const yTicks = [72000, 74000, 76000, 78000, 80000, 84000, 90000, 96000, 102000];

  return (
    <div id="lap-chart" className="panel">
      <header className="lc-head">
        <span className="lc-title">LAP CHART</span>
        <span className="lc-sub">Lap time by lap</span>
      </header>

      <ChartContainer config={chartConfig} className="lc-container" tabIndex={-1}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 24, bottom: 4, left: 8 }}
        >
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />

          <XAxis
            dataKey="lap"
            ticks={xTicks}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            label={{ value: 'LAP', position: 'insideBottomRight', offset: -4, fill: '#6b7280', fontSize: 10 }}
          />

          <YAxis
            domain={[yMin, yMax]}
            ticks={yTicks}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={msToAxisTick}
            width={42}
          />

          <Tooltip
            content={<LapTooltip drivers={drivers} selectedCode={selectedCode} />}
            cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
          />

          <ReferenceLine
            x={currentLap}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />

          {results.map(r => {
            const isSelected = r.code === selectedCode;
            const color = byCode[r.code]?.color ?? '#888';
            return (
              <Line
                key={r.code}
                dataKey={r.code}
                type="monotone"
                stroke={color}
                strokeWidth={isSelected ? 2.5 : 1}
                strokeOpacity={isSelected ? 1 : 0.28}
                dot={false}
                activeDot={isSelected ? { r: 4, fill: color, strokeWidth: 0 } : false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
