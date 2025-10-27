# Action Recognition Server

This project is a web application for monitoring and managing camera feeds, inspired by Frigate. It provides a user-friendly interface to view live camera streams, manage settings, and monitor events.

## Project Structure

- **package.json**: Configuration file for npm, listing dependencies and scripts.
- **tsconfig.json**: TypeScript configuration file specifying compiler options.
- **vite.config.ts**: Configuration for Vite, the build tool used in this project.
- **public/index.html**: Main HTML file serving as the entry point for the application.
- **src/**: Contains all the source code for the application.
  - **main.tsx**: Entry point for the React application.
  - **App.tsx**: Main application component that sets up routing and layout.
  - **components/**: Contains reusable components for the application.
    - **CameraGrid.tsx**: Displays a grid of camera feeds.
    - **CameraCard.tsx**: Represents an individual camera feed with controls.
    - **CameraPlayer.tsx**: Plays the video stream from a selected camera.
    - **EventList.tsx**: Displays a list of events related to the cameras.
    - **Navbar.tsx**: Navigation bar component for the application.
  - **pages/**: Contains page components for different views.
    - **Dashboard.tsx**: Represents the dashboard page.
    - **CameraView.tsx**: Displays detailed view of a selected camera.
    - **Settings.tsx**: Allows users to configure application settings.
  - **services/**: Contains functions for API and WebSocket interactions.
    - **api.ts**: Functions for making API calls to the backend.
    - **websocket.ts**: Functions for handling WebSocket connections.
  - **hooks/**: Custom hooks for managing state and interactions.
    - **useCamera.ts**: Custom hook for managing camera state.
  - **store/**: State management setup, likely using Redux or Context API.
    - **index.ts**: State management configuration.
  - **styles/**: Contains CSS styles for the application.
    - **main.css**: Main CSS styles.
  - **types/**: TypeScript types and interfaces used throughout the application.
    - **index.ts**: Type definitions.

- **docker/Dockerfile**: Instructions for building a Docker image for the application.
- **README.md**: Documentation for the project, including setup instructions and usage.

## Getting Started

1. Clone the repository:
   ```
   git clone <repository-url>
   cd action_recognition_server/html
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` to view the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.