import React from 'react';

interface CameraPlayerProps {
    streamUrl: string;
    onClose: () => void;
}

const CameraPlayer: React.FC<CameraPlayerProps> = ({ streamUrl, onClose }) => {
    return (
        <div className="camera-player">
            <button onClick={onClose}>Close</button>
            <video autoPlay controls>
                <source src={streamUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};

export default CameraPlayer;