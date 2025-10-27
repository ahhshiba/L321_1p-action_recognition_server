import React from 'react';

const EventList: React.FC = () => {
    const events = [
        // Sample event data
        { id: 1, timestamp: '2023-10-01T12:00:00Z', description: 'Camera 1 detected motion' },
        { id: 2, timestamp: '2023-10-01T12:05:00Z', description: 'Camera 2 detected motion' },
        { id: 3, timestamp: '2023-10-01T12:10:00Z', description: 'Camera 1 detected motion' },
    ];

    return (
        <div className="event-list">
            <h2>Event List</h2>
            <ul>
                {events.map(event => (
                    <li key={event.id}>
                        <strong>{new Date(event.timestamp).toLocaleString()}</strong>: {event.description}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default EventList;