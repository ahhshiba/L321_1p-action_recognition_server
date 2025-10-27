import React from 'react';

interface CameraCardProps {
    cameraId: string;
    cameraName: string;
    isActive: boolean;
    onSelect: (id: string) => void;
}

const CameraCard: React.FC<CameraCardProps> = ({ cameraId, cameraName, isActive, onSelect }) => {
    return (
        <div className={`camera-card ${isActive ? 'active' : ''}`} onClick={() => onSelect(cameraId)}>
            <h3>{cameraName}</h3>
            <p>ID: {cameraId}</p>
            <button>{isActive ? 'Stop' : 'Start'} Stream</button>
        </div>
    );
};

export default CameraCard;