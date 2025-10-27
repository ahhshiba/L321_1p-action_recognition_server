import React from 'react';
import CameraGrid from '../components/CameraGrid';
import EventList from '../components/EventList';
import Navbar from '../components/Navbar';

const Dashboard: React.FC = () => {
    return (
        <div>
            <Navbar />
            <h1>Dashboard</h1>
            <CameraGrid />
            <EventList />
        </div>
    );
};

export default Dashboard;