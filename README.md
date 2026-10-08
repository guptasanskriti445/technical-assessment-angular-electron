# Technical Assessment – Angular + Electron Desktop Monitor

A Windows desktop-style monitoring dashboard built with Angular and Electron.

It visualizes real-time telemetry for:
- Velocity
- Pressure
- Temperature

Open in StackBlitz:
https://stackblitz.com/github/guptasanskriti445/technical-assessment-angular-electron

Features
- Live telemetry updates every second
- Circular gauges and live trend graphs
- Runtime unit conversion without backend requests
- Dark/light theme switching
- CSV and Excel export
- Loading/error/connection states
- Modern responsive dashboard UI
- Electron desktop wrapper for local Windows-style app usage

Project Architecture
- Angular 20 frontend for the dashboard and telemetry UI
- Express backend to simulate embedded-controller data
- Electron shell to run the dashboard as a desktop application
- Chart.js for live line charts
- xlsx + file-saver for export files

Run the app locally
1. Install dependencies:
   npm install

2. Start the backend and Angular app:
   npm start

3. Open the app in the browser:
   http://localhost:4200

4. Run as a desktop app:
   npm run electron

Notes
- The Angular dashboard runs on http://localhost:4200
- The telemetry API runs on http://localhost:3000/api/dashboard
- The dashboard fetches live data automatically every second
- When you change units, the values update immediately on the client without another API request

Assumptions
- This project is intended for local development and demonstration
- Telemetry is simulated on the backend to match the assessment requirements
- The dashboard is designed for a desktop-style monitoring experience but still runs in the browser as a local app
- Each metric retains the most recent 100 samples for trend visualization

Repository and submission note
- Do not include node_modules or build output in the final submission
- Keep the source code clean and focused on the required assessment goals
