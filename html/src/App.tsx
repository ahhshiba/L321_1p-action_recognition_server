import React from 'react';
import Navbar from './components/Navbar';
import CameraGrid from './components/CameraGrid';
import EventList from './components/EventList';
import './styles/main.css';

export default function App() {
  return (
    <div className="app-root">
      <Navbar />
      <main style={{ padding: 16 }}>
        <h2>攝影機總覽</h2>
        <CameraGrid />
        <h2 style={{ marginTop: 24 }}>事件列表</h2>
        <EventList />
      </main>
    </div>
  );
}