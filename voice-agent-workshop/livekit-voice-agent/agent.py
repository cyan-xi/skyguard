import asyncio
import logging
import datetime
import aiohttp
import json

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.agents.llm import function_tool
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from aiohttp import web

logger = logging.getLogger("atc-agent")
active_session: AgentSession = None
http_server_started = False

async def http_handler(request):
    if request.path == "/speak" and request.method == "POST":
        text = await request.text()
        logger.info(f"Received speak request: {text}")
        if active_session:
            # Instruct the agent to speak this verbatim
            if text and text.strip():
                logger.info("Starting speech generation task...")
                try:
                    await active_session.say(text, allow_interruptions=False)
                    logger.info("Speech generation task completed.")
                except Exception as e:
                    logger.error(f"Failed to speak text via session: {e}")
            else:
                logger.info("Received empty speak request, skipping.")
            return web.Response(text="OK")
        else:
            return web.Response(text="No active session", status=503)
    return web.Response(text="Not Found", status=404)

async def start_http_server():
    app = web.Application()
    app.router.add_post("/speak", http_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8081)
    await site.start()
    logger.info("HTTP server started on port 8081")

from dotenv import load_dotenv

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are the SkyGuard Automated Logging System.

            # IDENTITY
            - You are a SOFTWARE PROCESS, not a human.
            - You are NOT a Pilot. You are NOT an Air Traffic Controller.
            - You NEVER roleplay or simulate conversations.

            # MISSION
            - Your sole purpose is to listen to the *Human Controller* and log their commands.
            - You DO NOT respond to questions unless explicitly asked to "Repeat last instruction".
            
            # STRICT BEHAVIOR
            - Hear command -> Call `log_atc_instruction` -> Output EMPTY STRING.
            - Hear chitchat/questions -> Output EMPTY STRING.
            - Hear "Repeat" -> Call `get_last_atc_instruction`.
            - NEVER generating text starting with "Pilot..." or "Tower...".
            """,
        )

        self.instruction_buffer = []
        self.webhook_url = "http://127.0.0.1:4000/api/transcript/log"

    async def _send_to_webhook(self, data: dict):
        """Helper to send data to the webhook asynchronously without blocking."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=data) as response:
                    if response.status != 200:
                        logger.error(f"Webhook failed with status {response.status}")
        except Exception as e:
            logger.error(f"Failed to send to webhook: {e}")

            logger.error(f"Failed to send to webhook: {e}")

    @function_tool
    async def log_atc_instruction(self, callsign: str, command: str, value: str, raw_message: str):
        """
        Log a structured ATC instruction.
        Args:
            callsign: The target aircraft (e.g., "United 123")
            command: The strictly normalized FAA Order 7110.65 action (e.g., "CLIMB AND MAINTAIN", "TURN LEFT HEADING", "CLEARED FOR TAKEOFF").
            value: The numerical value or target (e.g., "FL350", "270", "Runway 28").
            raw_message: The complete spoken phrase verbatim.
        """
        logger.info(f"Logging ATC instruction: {raw_message}")
        entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "callsign": callsign,
            "command": command,
            "value": value,
            "message": raw_message
        }
        
        # Store locally for the pilot (fast retrieval)
        self.instruction_buffer.append(entry)
        
        # Send to webhook asynchronously
        asyncio.create_task(self._send_to_webhook(entry))
        
        return "Instruction logged successfully."

    @function_tool
    async def get_last_atc_instruction(self):
        """
        Retrieve the last logged ATC instruction.
        Use this when the pilot asks to repeat the instructions.
        """
        if not self.instruction_buffer:
            return "No instructions available in buffer."
        last_entry = self.instruction_buffer[-1]
        logger.info(f"Retrieving last instruction: {last_entry}")
        return last_entry["message"]

server = AgentServer()

class BroadcastAgent(Agent):
    def __init__(self):
        super().__init__(instructions="You are a broadcast system.")

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    global active_session
    global http_server_started
    if not http_server_started:
        asyncio.create_task(start_http_server())
        http_server_started = True

    # No STT, No VAD, No LLM -> Pure Broadcast
    session = AgentSession(
        tts="deepgram/aura-2:odysseus",
    )
    
    active_session = session

    # Start the session with our dummy agent (required for loop)
    await session.start(
        room=ctx.room,
        agent=BroadcastAgent()
    )
    
    # Announce online
    logger.info("Broadcast Agent Online")
    await session.say("SkyGuard Broadcast System Online", allow_interruptions=False)

    # Keep the task alive effectively forever (or until disconnected)
    # Since we are not running an 'Agent' loop, we need to wait on something.
    # The session.run() usually handles this, but we aren't using an Agent.
    # We can just await a future that never completes, or let the room connection hold it.
    
    # Create a future to wait for shutdown
    shutdown_process = asyncio.Future()
    
    async def on_shutdown(reason):
        if not shutdown_process.done():
            shutdown_process.set_result(None)
    
    ctx.add_shutdown_callback(on_shutdown)
    
    # Wait until shutdown is triggered
    await shutdown_process


if __name__ == "__main__":
    agents.cli.run_app(server)