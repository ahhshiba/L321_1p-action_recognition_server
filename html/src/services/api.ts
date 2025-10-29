import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : 'http://localhost:8000/api'); // docker compose 預設會傳入

export const fetchCameras = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/cameras`);
        return response.data;
    } catch (error) {
        console.error('Error fetching cameras:', error);
        throw error;
    }
};

export const fetchCameraDetails = async (cameraId: string): Promise<any> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching details for camera ${cameraId}:`, error);
        throw error;
    }
};

export const updateCameraSettings = async (cameraId: string, settings: any): Promise<any> => {
    try {
        const response = await axios.put(`${API_BASE_URL}/cameras/${cameraId}`, settings);
        return response.data;
    } catch (error) {
        console.error(`Error updating settings for camera ${cameraId}:`, error);
        throw error;
    }
};

export async function safeFetch(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed ${res.status} ${res.statusText}: ${text}`);
  }

  if (!ct.includes('application/json')) {
    throw new Error(`Expected JSON response but got "${ct}". Body: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${(err as Error).message}`);
  }
}

// 示例：替換現有的 fetch 呼叫
// const data = await safeFetch('/api/cameras');
