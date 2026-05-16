export type TyreCompound = 'S' | 'M' | 'H' | 'I' | 'W';

export interface Race {
  year: number;
  round: number;
  name: string;
  track:string;
  date: string; 
  country: string;
  laps: number;
  featured?: boolean;
}

export interface Driver {
  num: string;
  code: string;
  name: string;
  team: string;
  color: string;
}

export interface Result {
  pos: number;
  num: string;
  code: string;
  name?: string;
  best: string;
  gap: string;
  tyres: TyreCompound[];
  stops: number;
}

export interface F1Data {
  season: number;
  races: Race[];
  drivers: Driver[];
  results: Result[];
}

export const F1_DATA: F1Data = {
  season: 2024,
races: [
  // 2025
  { year: 2025, round: 1,  track: 'sakhir',      name: 'Bahrain GP',        date: '05 MAR', country: 'BH', laps: 57 },
  { year: 2025, round: 2,  track: 'jeddah',       name: 'Saudi Arabian GP',  date: '19 MAR', country: 'SA', laps: 50 },
  { year: 2025, round: 3,  track: 'melbourne',    name: 'Australian GP',     date: '02 APR', country: 'AU', laps: 58 },
  { year: 2025, round: 4,  track: 'baku',         name: 'Azerbaijan GP',     date: '30 APR', country: 'AZ', laps: 51 },
  { year: 2025, round: 5,  track: 'miami',        name: 'Miami GP',          date: '07 MAY', country: 'US', laps: 57 },
  { year: 2025, round: 6,  track: 'montecarlo',       name: 'Monaco GP',         date: '28 MAY', country: 'MC', laps: 78, featured: true },
  { year: 2025, round: 7,  track: 'catalunya',        name: 'Spanish GP',        date: '04 JUN', country: 'ES', laps: 66 },
  { year: 2025, round: 8,  track: 'montreal',       name: 'Canadian GP',     date: '18 JUN', country: 'CA', laps: 70 },
  { year: 2025, round: 9,  track: 'spielberg',      name: 'Austrian GP',       date: '02 JUL', country: 'AT', laps: 71 },
  { year: 2025, round: 10, track: 'silverstone',  name: 'British GP',        date: '09 JUL', country: 'GB', laps: 52 },
  { year: 2025, round: 11, track: 'hungaroring',      name: 'Hungarian GP',      date: '23 JUL', country: 'HU', laps: 70 },
  { year: 2025, round: 12, track: 'spafrancorchamps',          name: 'Belgian GP',        date: '30 JUL', country: 'BE', laps: 44 },
  { year: 2025, round: 13, track: 'zandvoort',    name: 'Dutch GP',          date: '27 AUG', country: 'NL', laps: 72 },
  { year: 2025, round: 14, track: 'monza',        name: 'Italian GP',        date: '03 SEP', country: 'IT', laps: 53 },
  { year: 2025, round: 15, track: 'singapore',    name: 'Singapore GP',      date: '17 SEP', country: 'SG', laps: 62 },
  { year: 2025, round: 16, track: 'suzuka',       name: 'Japanese GP',       date: '24 SEP', country: 'JP', laps: 53 },
  { year: 2025, round: 17, track: 'lusail',        name: 'Qatar GP',          date: '08 OCT', country: 'QA', laps: 57 },
  { year: 2025, round: 18, track: 'austin',         name: 'United States GP',  date: '22 OCT', country: 'US', laps: 56 },
  { year: 2025, round: 19, track: 'mexicocity',       name: 'Mexico City GP',    date: '29 OCT', country: 'MX', laps: 71 },
  { year: 2025, round: 20, track: 'interlagos',   name: 'São Paulo GP',      date: '05 NOV', country: 'BR', laps: 71 },
  { year: 2025, round: 21, track: 'lasvegas',    name: 'Las Vegas GP',      date: '18 NOV', country: 'US', laps: 50 },
  { year: 2025, round: 22, track: 'yasmarina',    name: 'Abu Dhabi GP',      date: '26 NOV', country: 'AE', laps: 58 },

  // 2024
  { year: 2024, round: 1,  track: 'sakhir',      name: 'Bahrain GP',        date: '05 MAR', country: 'BH', laps: 57 },
  { year: 2024, round: 2,  track: 'jeddah',       name: 'Saudi Arabian GP',  date: '19 MAR', country: 'SA', laps: 50 },
  { year: 2024, round: 3,  track: 'melbourne',    name: 'Australian GP',     date: '02 APR', country: 'AU', laps: 58 },
  { year: 2024, round: 4,  track: 'baku',         name: 'Azerbaijan GP',     date: '30 APR', country: 'AZ', laps: 51 },
  { year: 2024, round: 5,  track: 'miami',        name: 'Miami GP',          date: '07 MAY', country: 'US', laps: 57 },
  { year: 2024, round: 6,  track: 'montecarlo',       name: 'Monaco GP',         date: '28 MAY', country: 'MC', laps: 78, featured: true },
  { year: 2024, round: 7,  track: 'catalunya',        name: 'Spanish GP',        date: '04 JUN', country: 'ES', laps: 66 },
  { year: 2024, round: 8,  track: 'montreal',       name: 'Canadian GP',     date: '18 JUN', country: 'CA', laps: 70 },
  { year: 2024, round: 9,  track: 'spielberg',      name: 'Austrian GP',       date: '02 JUL', country: 'AT', laps: 71 },
  { year: 2024, round: 10, track: 'silverstone',  name: 'British GP',        date: '09 JUL', country: 'GB', laps: 52 },
  { year: 2024, round: 11, track: 'hungaroring',      name: 'Hungarian GP',      date: '23 JUL', country: 'HU', laps: 70 },
  { year: 2024, round: 12, track: 'spafrancorchamps',          name: 'Belgian GP',        date: '30 JUL', country: 'BE', laps: 44 },
  { year: 2024, round: 13, track: 'zandvoort',    name: 'Dutch GP',          date: '27 AUG', country: 'NL', laps: 72 },
  { year: 2024, round: 14, track: 'monza',        name: 'Italian GP',        date: '03 SEP', country: 'IT', laps: 53 },
  { year: 2024, round: 15, track: 'singapore',    name: 'Singapore GP',      date: '17 SEP', country: 'SG', laps: 62 },
  { year: 2024, round: 16, track: 'suzuka',       name: 'Japanese GP',       date: '24 SEP', country: 'JP', laps: 53 },
  { year: 2024, round: 17, track: 'lusail',        name: 'Qatar GP',          date: '08 OCT', country: 'QA', laps: 57 },
  { year: 2024, round: 18, track: 'austin',         name: 'United States GP',  date: '22 OCT', country: 'US', laps: 56 },
  { year: 2024, round: 19, track: 'mexicocity',       name: 'Mexico City GP',    date: '29 OCT', country: 'MX', laps: 71 },
  { year: 2024, round: 20, track: 'interlagos',   name: 'São Paulo GP',      date: '05 NOV', country: 'BR', laps: 71 },
  { year: 2024, round: 21, track: 'lasvegas',    name: 'Las Vegas GP',      date: '18 NOV', country: 'US', laps: 50 },
  { year: 2024, round: 22, track: 'yasmarina',    name: 'Abu Dhabi GP',      date: '26 NOV', country: 'AE', laps: 58 },
],
  drivers: [
    { num: '01', code: 'VER', name: 'Verstappen',  team: 'Red Bull Racing',     color: '#3671c6' },
    { num: '11', code: 'PER', name: 'Pérez',       team: 'Red Bull Racing',     color: '#3671c6' },
    { num: '16', code: 'LEC', name: 'Leclerc',     team: 'Ferrari',      color: '#dc0000' },
    { num: '55', code: 'SAI', name: 'Sainz',       team: 'Ferrari',      color: '#dc0000' },
    { num: '44', code: 'HAM', name: 'Hamilton',    team: 'Mercedes',     color: '#27f4d2' },
    { num: '63', code: 'RUS', name: 'Russell',     team: 'Mercedes',     color: '#27f4d2' },
    { num: '04', code: 'NOR', name: 'Norris',      team: 'McLaren',      color: '#ff8000' },
    { num: '81', code: 'PIA', name: 'Piastri',     team: 'McLaren',      color: '#ff8000' },
    { num: '14', code: 'ALO', name: 'Alonso',      team: 'Aston Martin', color: '#229971' },
    { num: '23', code: 'ALB', name: 'Albon',       team: 'Williams',     color: '#64c4ff' },
    { num: '31', code: 'OCO', name: 'Ocon',        team: 'Alpine',       color: '#0090ff' },
  ],
  results: [
    { pos: 1,  num: '01', code: 'VER', best: '1:14.260', gap: 'LEADER',  tyres: ['M','M'],     stops: 1 },
    { pos: 2,  num: '14', code: 'ALO', best: '1:14.586', gap: '+27.921', tyres: ['M','M'],     stops: 1 },
    { pos: 3,  num: '44', code: 'HAM', best: '1:14.771', gap: '+33.531', tyres: ['M','I','M'], stops: 2 },
    { pos: 4,  num: '63', code: 'RUS', best: '1:14.882', gap: '+34.668', tyres: ['M','I','M'], stops: 2 },
    { pos: 5,  num: '31', code: 'OCO', best: '1:14.998', gap: '+38.211', tyres: ['M','I','M'], stops: 2 },
    { pos: 6,  num: '16', code: 'LEC', best: '1:14.412', gap: '+39.426', tyres: ['M','I','M'], stops: 2 },
    { pos: 7,  num: '55', code: 'SAI', best: '1:15.001', gap: '+45.995', tyres: ['M','I','M'], stops: 2 },
    { pos: 8,  num: '04', code: 'NOR', best: '1:15.115', gap: '+47.021', tyres: ['M','I','M'], stops: 2 },
    { pos: 9,  num: '11', code: 'PER', best: '1:14.890', gap: '+1 LAP',  tyres: ['H','M','I'], stops: 2 },
    { pos: 10, num: '23', code: 'ALB', best: '1:15.488', gap: '+1 LAP',  tyres: ['M','I'],     stops: 1 },
  ],
};