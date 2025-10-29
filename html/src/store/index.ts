import { createStore, AnyAction } from 'redux';

interface Camera {
    id: string;
    [key: string]: any;
}

interface EventItem {
    [key: string]: any;
}

type RootState = {
    cameras: Camera[];
    events: EventItem[];
    settings: Record<string, any>;
};

// Initial state
const initialState: RootState = {
    cameras: [],
    events: [],
    settings: {}
};

// Reducer function
const rootReducer = (state: RootState = initialState, action: AnyAction): RootState => {
    switch (action.type) {
        case 'ADD_CAMERA':
            return {
                ...state,
                cameras: [...state.cameras, action.payload]
            };
        case 'REMOVE_CAMERA':
            return {
                ...state,
                cameras: state.cameras.filter(camera => camera.id !== action.payload.id)
            };
        case 'ADD_EVENT':
            return {
                ...state,
                events: [...state.events, action.payload]
            };
        case 'UPDATE_SETTINGS':
            return {
                ...state,
                settings: { ...state.settings, ...action.payload }
            };
        default:
            return state;
    }
};

// Create store
const store = createStore(rootReducer);

export default store;