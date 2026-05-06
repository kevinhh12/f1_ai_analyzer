# F1 Analyzer — UI kit

Click-through prototype of the F1 Race Strategy Analyzer web app. Demonstrates the broadcast-grade dark layout with sidebar nav, sticky timing top bar, classification table, lap chart, and tyre-strategy gantt.

## Files

- `index.html` — runnable demo. Open this directly.
- `data.js` — synthetic dataset shaped after the FastAPI backend's responses.
- `TopBar.jsx` — sticky header with brand mark, race button, live pill, lap counter.
- `Sidebar.jsx` — left rail with season's races + view switcher.
- `StatGrid.jsx` — fastest-lap / pit-stops / overtakes / safety-car tiles.
- `Classification.jsx` — driver classification table with team color bar, tyre stints.
- `LapChart.jsx` — SVG lap-by-lap position chart.
- `TyreStrategy.jsx` — horizontal stint bars (gantt) per driver.
- `styles.css` — UI kit specific styles. Pulls tokens from `../../colors_and_type.css`.

## Interactions

- Click any race in the sidebar → switches the active session.
- Click the race button in the top bar → opens a modal race picker.
- Drag the lap scrubber or hit play → animates the current-lap marker on the lap chart.
- Click any driver row in classification or tyre strategy → selects that driver (line on the lap chart highlights).

## Caveats

- All telemetry is **synthetic but plausible** — real app pulls from `/races`, `/drivers`, `/laps`, `/position` (see `reference/` for the FastAPI routes).
- Lap-chart position-by-lap is a deterministic pseudo-random walk that converges to the real classification — placeholder until lap-data is wired up.
- Team logos are intentionally **not** included (trademarks); team colors stand in.
