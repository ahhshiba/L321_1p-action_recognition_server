import React, { useState } from 'react';
import { safeFetch } from '../services/api';

export default function Settings() {
  const [serverUrl, setServerUrl] = useState<string>('');
  const [mqttHost, setMqttHost] = useState<string>('');
  const [cameraPolling, setCameraPolling] = useState<number>(5);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cfg = { serverUrl, mqttHost, cameraPolling };

    try {
      // 本地儲存（立即生效）
      localStorage.setItem('ars:settings', JSON.stringify(cfg));

      // 若你有後端 API，示範呼叫（非必要）
      // await safeFetch('/api/settings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(cfg),
      // });

      console.log('Save settings:', cfg);
      alert('設定已儲存');
    } catch (err) {
      console.error('Save failed:', err);
      alert('儲存失敗：' + ((err as Error).message || err));
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>設定</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 720 }}>
        <label style={{ display: 'block', marginTop: 12 }}>
          伺服器 URL
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
            placeholder="http://localhost:8000"
          />
        </label>

        <label style={{ display: 'block', marginTop: 12 }}>
          MQTT 主機
          <input
            type="text"
            value={mqttHost}
            onChange={(e) => setMqttHost(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
            placeholder="mqtt://localhost:1883"
          />
        </label>

        <label style={{ display: 'block', marginTop: 12 }}>
          攝影機輪詢間隔（秒）
          <input
            type="number"
            value={cameraPolling}
            onChange={(e) => setCameraPolling(Number(e.target.value))}
            style={{ width: 120, padding: 8, marginTop: 6 }}
            min={1}
          />
        </label>

        <div style={{ marginTop: 20 }}>
          <button type="submit" style={{ padding: '8px 16px' }}>儲存設定</button>
        </div>
      </form>
    </div>
  );
}