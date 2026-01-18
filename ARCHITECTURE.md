# SkyGuard AI – Logic and Structure Overview

SkyGuard is an automated Air Traffic Control (ATC) simulation that uses AI to monitor airspace, detect conflicts, and broadcast voice instructions to pilots.

## 1. System Architecture

The system consists of three main components running in parallel:

1.  **Frontend (React/Vite)**: Visualizes the airspace, planes, and anomalies. Handles user interaction and simulation logic.
2.  **Backend (Node.js/Express)**: Acts as the central communication hub. Proxies requests between the Frontend and the Voice Agent.
3.  **Voice Agent (Python/LiveKit)**: A specialized "Deaf" AI agent that generates high-quality voice broadcasts using Cartesia TTS.

### Data Flow
1.  **Simulation Loop**: The Frontend calculates plane positions and detects conflicts (anomalies).
2.  **Decision Making**: When a conflict is resolved, the system generates a textual ATC instruction (e.g., "TURN RIGHT HEADING 360").
3.  **Broadcast Trigger**: The User (or Auto Mode) accepts the suggestion.
4.  **API Call**: Frontend sends `POST /api/speak` to the Node.js Backend.
5.  **Voice Generation**:
    *   Node.js Backend proxies the request to the Python Agent (`localhost:8081/speak`).
    *   Python Agent receives the text.
    *   **LiveKit (Cartesia)** synthesizes the speech and streams it to the room.
    *   The "Deaf Mode" configuration ensures the agent *only* speaks and never listens/hallucinates.

---

## 2. Component Details

### Frontend (`client/`)
*   **`App.tsx`**: Main simulation loop (`useInterval`). Manages state for planes, transcript, and anomalies.
*   **`simulation/`**: Contains core logic for flight physics (`aerodynamics.ts`), conflict detection (`separation.ts`), and pathfinding (`autopilot.ts`).
*   **`components/`**: UI components for the Radar Screen, Control Panel, and Transcript.

### Backend (`server/`)
*   **`index.js`**: Express server running on port 4000.
*   **`POST /api/speak`**: Receives text from client, forwards to Python Agent.
*   **CORS**: Configured to allow requests from the React frontend.

### Voice Agent (`voice-agent-workshop/`)
*   **`agent.py`**: A **LiveKit Agent** running on port 8081.
*   **Deaf Configuration**:
    *   **STT (Speech-to-Text)**: Disabled.
    *   **VAD (Voice Activity Detection)**: Disabled.
    *   **LLM (Language Model)**: Disabled (Dummy instructions only).
    *   **TTS (Text-to-Speech)**: Enabled (Cartesia `sonic-3` model).
*   **Role**: Acts purely as a broadcast system. It does not process incoming audio, preventing "hallucinations" or accidental responses to background noise.

---

## 3. Key Features

*   **Conflict Detection**: Real-time analysis of aircraft separation (3nm lateral, 1000ft vertical).
*   **Auto-Resolution**: System suggests vectors to resolve conflicts.
*   **Voice Broadcast**: Realistic ATC voice via Cartesia Sonic-3.
*   **Emergency Demo**: Scripted scenario demonstrating emergency handling (Engine Failure).
*   **transcript Logging**: All instructions are logged to a visible transcript panel.
