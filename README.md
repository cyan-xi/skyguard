# SkyGuard: Project Tools & Technologies

This document provides a comprehensive overview of the tools, technologies, and libraries used to build SkyGuard, along with an explanation of how each is utilized in the architecture.

## 1. Frontend: Visual Simulation
The user interface and simulation logic are built using a modern React stack.

*   **React (v18)**: Component-based UI framework. Used for rendering the Radar Screen, Control Panels, and managing application state (`useState`, `useEffect`).
*   **Vite**: Next-generation frontend build tool. Provides instant dev server start and fast Hot Module Replacement (HMR).
*   **TypeScript**: Adds static typing to JavaScript. Used extensively (`types.ts`) to ensure safety in simulation physics and plane objects.
*   **HTML5 Canvas / CSS3**:
    *   **CSS Grid/Flexbox**: Used for the layout (Top Bar, Sidebar, Main Map).
    *   **CSS Animations**: Used for the scanning radar line (`@keyframes scan`).

## 2. Backend: Proxy & API
A lightweight Node.js server acts as the bridge between the browser and the Voice AI.

*   **Node.js**: Runtime environment for the backend server.
*   **Express**: Web framework for Node.js. Handles HTTP routes.
    *   `POST /api/speak`: Receives text from the frontend and forwards it to the Python agent.
    *   `CORS`: Middleware used to allow cross-origin requests from the React app (port 5173) to the API (port 4000).
*   **node-fetch**: Used to make HTTP requests from the Node server to the Python agent's internal server.

## 3. Voice AI: Broadcast Agent
The core innovation of SkyGuard is the "Human-Like" voice broadcast system, powered by LiveKit.

*   **Python (v3.11+)**: The language used for the AI agent.
*   **LiveKit Agents Framework**: A framework for building real-time multimodal AI agents.
    *   **Worker**: The main process that connects to the real-time room.
    *   **AgentSession**: Manages the connection to the media server.
*   **Cartesia (TTS)**: A hyper-realistic Text-to-Speech engine.
    *   **Model**: `sonic-3` (specifically tuned for high-speed, authoritative delivery).
    *   **Voice ID**: `9626c31c-bec5...` (British-accented male, "The Newsreader").
*   **aiohttp**: Asynchronous HTTP client/server for Python.
    *   runs an internal API server on port `8081` within the agent to accept broadcast triggers from the Node.js backend.
*   **uv**: A fast Python package installer and virtual environment manager (replacement for pip/venv).

## 4. Development & Productivity
*   **Git**: Version control system.
*   **npm**: Package manager for JavaScript dependencies.
*   **dotenv**: Manages environment variables (API keys, URLs).

## 5. "Deaf Mode" Architecture
A unique design pattern used to solve self-interruption and hallucination issues.

*   **Concept**: Standard Voice AIs listen to their own output (echo) or background noise, causing them to reply to themselves. "Deaf Mode" disables all listening capabilities.
*   **Implementation**:
    *   **No STT**: Speech-to-Text is removed from the pipeline.
    *   **No VAD**: Voice Activity Detection is disabled.
    *   **Broadcast Only**: The agent acts solely as an output device (TTS), triggered only by explicit HTTP requests.
