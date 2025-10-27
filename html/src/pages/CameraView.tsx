import React from 'react';
import { useParams } from 'react-router-dom';
import CameraPlayer from '../components/CameraPlayer';
import EventList from '../components/EventList';
import './CameraView.css';

const CameraView: React.FC = () => {
    const { cameraId } = useParams<{ cameraId: string }>();

    return (
        <div className="camera-view">
            <h1>Camera View: {cameraId}</h1>
            <CameraPlayer cameraId={cameraId} />
            <EventList cameraId={cameraId} />
        </div>
    );
};

export default CameraView;