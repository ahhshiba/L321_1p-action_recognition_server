import React from 'react';

interface CameraPlayerProps {
  streamUrl?: string;
  onClose?: () => void;
}

const CameraPlayer: React.FC<CameraPlayerProps> = ({ streamUrl, onClose }) => {
  // 從 Vite env 讀取預設的 stream URL（docker-compose 以 VITE_STREAM_URL 傳入）
  const env = (import.meta as any).env || {};
  const fallbackHost =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : '';
  const defaultStream = env.VITE_STREAM_URL || (fallbackHost ? `${fallbackHost}/stream.mjpg` : '');
  const src = streamUrl || defaultStream;

  const isMjpeg = !!src && (src.includes('.mjpg') || src.includes('multipart/x-mixed-replace'));

  return (
    <div className="camera-player">
      {isMjpeg ? (
        <img src={src} alt="camera stream" style={{ width: '100%' }} />
      ) : (
        <video src={src} controls autoPlay style={{ width: '100%' }} />
      )}
      {onClose && <button onClick={onClose}>Close</button>}
    </div>
  );
};

export default CameraPlayer;
