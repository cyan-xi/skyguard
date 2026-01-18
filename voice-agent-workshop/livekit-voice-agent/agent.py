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

logger = logging.getLogger("atc-agent")

from dotenv import load_dotenv

load_dotenv(".env.local")

# follow instructions here:
# https://docs.livekit.io/agents/start/voice-ai-quickstart/

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are an AI assistant to air traffic controllers.
            
            Rules:
            1. When the ATC broadcasts a message or gives an instruction, you MUST log it into the buffer using the 'log_atc_instruction' tool.
            2. When the pilot asks to repeat instructions, use the 'get_last_atc_instruction' tool to retrieve the exact command and repeat it to them.
            3. If you are asked to broadcast a message (via system event), just state the message verbatim.
            """,
        )

        self.instruction_buffer = []
        self.webhook_url = "http://localhost:4000/webhook/atc-logs" 

    async def _send_to_webhook(self, data: dict):
        """Helper to send data to the webhook asynchronously without blocking."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=data) as response:
                    if response.status != 200:
                        logger.error(f"Webhook failed with status {response.status}")
        except Exception as e:
            logger.error(f"Failed to send to webhook: {e}")

    @function_tool
    async def log_atc_instruction(self, callsign: str, command: str, value: str, raw_message: str):
        """
        Log a structured ATC instruction.
        Args:
            callsign: The target aircraft (e.g., "United 123")
            command: The action type (e.g., "CLIMB", "TURN LEFT", "CONTACT")
            value: The numerical value or target (e.g., "FL350", "heading 270", "119.5")
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

    @function_tool
    async def report_safety_alert(self, callsign: str, issue: str, severity: str):
        """
        Report a safety alert or anomaly derived from pilot communication.
        Args:
           callsign: The aircraft involved.
           issue: Description of the issue (e.g. "Wrong runway readback", "Distress call").
           severity: "high" or "critical".
        """
        logger.warning(f"Reporting safety alert: {issue}")
        entry = {
            "type": "AGENT_ALERT",
            "severity": severity,
            "description": issue,
            "aircraftIds": [callsign]
        }
        try:
             async with aiohttp.ClientSession() as session:
                 async with session.post("http://localhost:4000/webhook/anomalies", json=entry) as response:
                     if response.status != 200:
                         logger.error(f"Alert webhook failed: {response.status}")
        except Exception as e:
             logger.error(f"Failed to send alert: {e}")
        return "Safety alert reported to console."

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4.1-mini", 
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    @ctx.room.on("data_received")
    def on_data_received(dp: rtc.DataPacket):
        # Handle "broadcast" click from the operator
        payload = dp.data.decode()
        logger.info(f"Received broadcast request: {payload}")
        if payload:
            asyncio.create_task(session.generate_reply(
                instructions=f"The operator wants you to broadcast this instruction immediately: '{payload}'"
            ))

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions="State that the ATC Agent is online."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)