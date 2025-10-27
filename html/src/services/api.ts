import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api'; // Adjust the base URL as needed

export const fetchCameras = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/cameras`);
        return response.data;
    } catch (error) {
        console.error('Error fetching cameras:', error);
        throw error;
    }
};

export const fetchCameraDetails = async (cameraId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching details for camera ${cameraId}:`, error);
        throw error;
    }
};

export const updateCameraSettings = async (cameraId, settings) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/cameras/${cameraId}`, settings);
        return response.data;
    } catch (error) {
        console.error(`Error updating settings for camera ${cameraId}:`, error);
        throw error;
    }
};