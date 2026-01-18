# SkyGuard: AI-Powered Air Traffic Control

SkyGuard is an automated collision avoidance and air traffic management system. It integrates real-time physics simulation with a multimodal AI voice agent to provide human-like ATC instructions and emergency management.

## 🚀 How to Run the Demo

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.11+)
- **LiveKit Cloud Project** (or self-hosted)

### 2. Environment Setup
You must configure the LiveKit credentials for the voice agent.
1. Navigate to `voice-agent-workshop/`
2. Create a `.env` file from the example: `cp .env.example .env`
3. **IMPORTANT**: Paste your `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
4. Also include `OPENAI_API_KEY` and `DEEPGRAM_API_KEY` if required by the worker components.

### 3. Start the Components
Open three terminal windows:

**Window 1: Server (Backend API)**
```bash
cd server
npm install
node index.js
```

**Window 2: Client (Frontend Simulation)**
```bash
cd client
npm install
npm run dev
```

**Window 3: Voice Agent (AI Broadcast)**
```bash
cd voice-agent-workshop/livekit-voice-agent
# Recommended to use a virtual environment
python agent.py dev
```

### 4. Trigger the Scenario
1. Open the browser to the client URL (usually `http://localhost:5173`).
2. Click the **🚨 DEMO** button in the bottom-right **Anomalies** panel.
3. Follow the scripted emergency scenario through the **Suggested Message** panels.

---

## 🛠️ Technologies & Credits

### Frameworks & Libraries
*   **[React](https://reactjs.org/)**: UI Component architecture and state management.
*   **[Vite](https://vitejs.dev/)**: High-performance frontend build tool.
*   **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development for simulation physics.
*   **[Node.js](https://nodejs.org/)**: Backend infrastructure and simulation engine.
*   **[LiveKit Agents](https://livekit.io/agents)**: Multimodal AI agent framework for real-time radio broadcast.
*   **[Cartesia TTS](https://cartesia.ai/)**: State-of-the-art Text-to-Speech for ultra-low latency voice delivery.

### AI Tools
*   **[Trae IDE](https://www.trae.ai/)**: Adaptive AI IDE used for the end-to-end engineering and design of SkyGuard.

### Design
*   **Custom CRT/Radar Overlay**: Native CSS animations and SVG filters for a classic aviation aesthetic.
*   **Beaver County Airport (KBVI)**: Real-world airport layout used as the base simulation map.

---

## 5. "Deaf Mode" Architecture
A unique design pattern used to solve self-interruption and hallucination issues.

*   **Concept**: Standard Voice AIs listen to their own output (echo) or background noise, causing them to reply to themselves. "Deaf Mode" disables all listening capabilities.
*   **Implementation**:
    *   **No STT**: Speech-to-Text is removed from the pipeline.
    *   **No VAD**: Voice Activity Detection is disabled.
    *   **Broadcast Only**: The agent acts solely as an output device (TTS), triggered only by explicit HTTP requests from the simulation engine.
