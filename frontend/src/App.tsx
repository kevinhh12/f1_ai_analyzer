import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RacePage from './pages/RacePage';
import DriversPage from './pages/DriversPage';
import TeamsPage from './pages/TeamsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/race" replace />} />
        <Route path="/race" element={<RacePage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/teams" element={<TeamsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
