// Tiny stand-in dataset for the F1 Analyzer UI kit demo.
// Real app pulls from /races, /drivers, /laps, /position via the FastAPI backend
// (see reference/ for endpoint definitions). This is shaped the same way.
export const F1_DATA = {
  season: 2023,
  races: [
    { round: 1,  name: 'Bahrain GP',     date: '05 MAR', country: 'BH', laps: 57 },
    { round: 4,  name: 'Azerbaijan GP',  date: '30 APR', country: 'AZ', laps: 51 },
    { round: 5,  name: 'Miami GP',       date: '07 MAY', country: 'US', laps: 57 },
    { round: 6,  name: 'Monaco GP',      date: '28 MAY', country: 'MC', laps: 78, featured: true },
    { round: 7,  name: 'Spanish GP',     date: '04 JUN', country: 'ES', laps: 66 },
    { round: 9,  name: 'Austrian GP',    date: '02 JUL', country: 'AT', laps: 71 },
    { round: 10, name: 'British GP',     date: '09 JUL', country: 'GB', laps: 52 },
    { round: 14, name: 'Dutch GP',       date: '27 AUG', country: 'NL', laps: 72 },
    { round: 15, name: 'Italian GP',     date: '03 SEP', country: 'IT', laps: 53 },
  ],
  drivers: [
    { num: '01', code: 'VER', name: 'Verstappen',  team: 'Red Bull',     color: '#3671c6' },
    { num: '11', code: 'PER', name: 'Pérez',       team: 'Red Bull',     color: '#3671c6' },
    { num: '16', code: 'LEC', name: 'Leclerc',     team: 'Ferrari',      color: '#dc0000' },
    { num: '55', code: 'SAI', name: 'Sainz',       team: 'Ferrari',      color: '#dc0000' },
    { num: '44', code: 'HAM', name: 'Hamilton',    team: 'Mercedes',     color: '#27f4d2' },
    { num: '63', code: 'RUS', name: 'Russell',     team: 'Mercedes',     color: '#27f4d2' },
    { num: '04', code: 'NOR', name: 'Norris',      team: 'McLaren',      color: '#ff8000' },
    { num: '81', code: 'PIA', name: 'Piastri',     team: 'McLaren',      color: '#ff8000' },
    { num: '14', code: 'ALO', name: 'Alonso',      team: 'Aston Martin', color: '#229971' },
    { num: '23', code: 'ALB', name: 'Albon',       team: 'Williams',     color: '#64c4ff' },
  ],
  // Monaco GP 2023 — synthetic but plausible classification
  results: [
    { pos: 1,  num: '01', code: 'VER', best: '1:14.260', gap: 'LEADER',   tyres: ['M','M'],     stops: 1 },
    { pos: 2,  num: '14', code: 'ALO', best: '1:14.586', gap: '+27.921',  tyres: ['M','M'],     stops: 1 },
    { pos: 3,  num: '44', code: 'HAM', best: '1:14.771', gap: '+33.531',  tyres: ['M','I','M'], stops: 2 },
    { pos: 4,  num: '63', code: 'RUS', best: '1:14.882', gap: '+34.668',  tyres: ['M','I','M'], stops: 2 },
    { pos: 5,  name: 'OCO', num: '31', code: 'OCO', best: '1:14.998', gap: '+38.211', tyres: ['M','I','M'], stops: 2 },
    { pos: 6,  num: '16', code: 'LEC', best: '1:14.412', gap: '+39.426',  tyres: ['M','I','M'], stops: 2 },
    { pos: 7,  num: '55', code: 'SAI', best: '1:15.001', gap: '+45.995',  tyres: ['M','I','M'], stops: 2 },
    { pos: 8,  num: '04', code: 'NOR', best: '1:15.115', gap: '+47.021',  tyres: ['M','I','M'], stops: 2 },
    { pos: 9,  num: '11', code: 'PER', best: '1:14.890', gap: '+1 LAP',   tyres: ['H','M','I'], stops: 2 },
    { pos: 10, num: '23', code: 'ALB', best: '1:15.488', gap: '+1 LAP',   tyres: ['M','I'],     stops: 1 },
  ],
};
