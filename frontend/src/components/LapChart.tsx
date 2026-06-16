"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts"
import { type Driver, type Result, type LapEntry, msToLabel, msToAxisTick } from '../data';
import { ChartContainer, type ChartConfig } from "../components/ui/chart"

interface Props {
  results: Result[];
  drivers: Driver[];
  chartData: LapEntry[];
  selectedCode: string;
  totalLaps: number;
  currentLap: number;
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

export default function LapChart({ results, drivers, chartData: allLapData, selectedCode, totalLaps, currentLap }: Props) {
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  // Only show laps up to currentLap — chart grows as the race progresses
  const chartData = allLapData.slice(0, currentLap);

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
