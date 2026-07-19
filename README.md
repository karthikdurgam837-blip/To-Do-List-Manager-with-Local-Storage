# Interactive Map Chatbot

An elegant, conversational map assistant that integrates real-time Google Maps features with Gemini AI. It allows users to search for places, calculate directions, and focus on locations dynamically using interactive map controls, combined with Google Search Grounding for real-time information retrieval.

## Features

- **Interactive Google Map Integration**: Dynamically centers the map, renders markers for points of interest, and displays precise routes.
- **Natural Language Tool Execution**: Translate conversational prompts directly into map interactions:
  - `focus_on_location`: Fly/center the map on a specific landmark, city, or coordinate.
  - `show_places_on_map`: Search for restaurants, hotels, parks, and place custom category-coded markers.
  - `get_directions`: Automatically compute and render travel paths for driving, walking, bicycling, or transit.
  - `clear_map_markers`: Clear the active elements on the map.
- **Search Grounding**: Utilizes Gemini 3.5 Flash powered Google Search to fetch up-to-date real-time reviews, operating hours, and events for any location.
- **Sleek Dark Theme UI**: A refined dashboard styled with Tailwind CSS, offering smooth layout transitions and responsive split views for desktop and mobile.

## Technology Stack

- **Frontend**: React (v19), TypeScript, Vite, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Node.js, Express, `@google/genai` SDK, `dotenv`.
- **Map Library**: `@vis.gl/react-google-maps` with Google Maps Platform API.

## Installation & Setup

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your API Keys:
   ```env
   # Gemini API Key (Secret key, never exposed to client)
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

   # Google Maps Platform Key (Used by react-google-maps)
   GOOGLE_MAPS_PLATFORM_KEY="YOUR_GOOGLE_MAPS_PLATFORM_KEY"
   ```

3. **Run the Application**:
   Start the development server with Hot Module Replacement and live backend reloading:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

4. **Production Build**:
   ```bash
   npm run build
   npm run start
   ```

## Folder Structure

```
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx     # Handles messaging streams, preset prompts, and search grounding UI
│   │   └── MapContainer.tsx  # Houses Google Maps instance, markers, info windows, and routing polylines
│   ├── types.ts              # Data models and structures
│   ├── App.tsx               # Main layout and application state coordination
│   ├── main.tsx              # React application mount entrypoint
│   └── index.css             # Tailwind CSS imports and variable custom styling
├── server.ts                 # Express server with server-side Gemini API endpoints and tools declarations
├── package.json              # Applet configuration and dependencies
└── tsconfig.json             # TypeScript configuration
```
