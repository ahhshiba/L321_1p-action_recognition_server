export type Camera = {
    id: string;
    name: string;
    streamUrl: string;
    status: 'online' | 'offline';
};

export type Event = {
    id: string;
    cameraId: string;
    timestamp: Date;
    description: string;
};

export type UserSettings = {
    notificationsEnabled: boolean;
    theme: 'light' | 'dark';
};

export type ApiResponse<T> = {
    success: boolean;
    data: T;
    message?: string;
};