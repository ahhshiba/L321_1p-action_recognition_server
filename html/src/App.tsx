import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import CameraGrid from './components/CameraGrid';
import EventList from './components/EventList';
import CameraView from './pages/CameraView';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import './styles/main.css';

export default function App() {
  return (
    <div className="app-root">
      <Navbar />
      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/camera" element={<CameraView />} />
          <Route path="/settings" element={<Settings />} />
          {/* 如果需要可新增更多 route */}
        </Routes>
      </main>
    </div>
  );
}