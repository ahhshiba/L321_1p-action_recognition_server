import { useEffect, useState } from 'react';

const useCamera = (cameraId) => {
    const [cameraStream, setCameraStream] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCameraStream = async () => {
            try {
                const response = await fetch(`/api/cameras/${cameraId}/stream`);
                if (!response.ok) {
                    throw new Error('Failed to fetch camera stream');
                }
                const streamUrl = await response.json();
                setCameraStream(streamUrl);
            } catch (err) {
                setError(err.message);
            }
        };

        fetchCameraStream();

        return () => {
            // Cleanup logic if necessary
        };
    }, [cameraId]);

    return { cameraStream, error };
};

export default useCamera;