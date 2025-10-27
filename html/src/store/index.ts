import { createStore } from 'redux';

// Initial state
const initialState = {
    cameras: [],
    events: [],
    settings: {}
};

// Reducer function
const rootReducer = (state = initialState, action) => {
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