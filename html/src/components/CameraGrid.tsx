import React from 'react';
import CameraCard from './CameraCard';
import useCamera from '../hooks/useCamera';

type Camera = any;

export default function CameraGrid(props: { cameras?: Camera[] } = {}) {
  // 支援 hook 回傳物件或陣列，且 props 可以覆寫
  const hookResult = useCamera ? (useCamera as any)(undefined) : undefined;
  const hookCameras =
    Array.isArray(hookResult) ? hookResult : (hookResult && (hookResult.cameras ?? hookResult)) ?? undefined;

  const cameras = props.cameras ?? hookCameras ?? [];

  if (!Array.isArray(cameras) || cameras.length === 0) {
    return <div className="camera-grid-empty" style={{ padding: 16 }}>尚無攝影機資料</div>;
  }

  return (
    <div className="camera-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {cameras.map((cam: Camera, idx: number) => (
        <CameraCard
          key={cam.id ?? cam.name ?? idx}
          cameraId={cam}
          cameraName={cam.name ?? cam.id ?? `Camera ${idx + 1}`}
          isActive={false}
          onSelect={(selectedId: any) => {}}
        />
      ))}
    </div>
  );
}