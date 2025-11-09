/**
 * WebSocket Server for Voice Agent Integration
 * Bridges frontend client with ElevenLabs Conversational AI
 */

import WebSocket, { WebSocketServer } from "ws";
import * as dotenv from "dotenv";
import { VoiceAgentService } from "./services/voice-agent-service";
import { LessonManager } from "./services/lesson-manager";
import { ClientMessage } from "./types/voice-agent";

// Load environment variables
dotenv.config({ path: ".env.local" });

const PORT = process.env.PORT || 8080;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Validate environment variables
if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
  console.error("❌ Missing required environment variables:");
  if (!ELEVENLABS_API_KEY) console.error("  - ELEVENLABS_API_KEY");
  if (!ELEVENLABS_AGENT_ID) console.error("  - ELEVENLABS_AGENT_ID");
  console.error("\nPlease create a .env.local file with your ElevenLabs credentials.");
  process.exit(1);
}

// Create WebSocket server
const wss = new WebSocketServer({ port: Number(PORT) || 8000 });

console.log(`🚀 WebSocket server starting on port ${PORT}...`);

// Handle new client connections
wss.on("connection", async (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`✅ Client connected from ${clientIp}`);

  // Create lesson manager for this session
  const lessonManager = new LessonManager();

  // Create voice agent service
  const voiceAgent = new VoiceAgentService(ELEVENLABS_AGENT_ID!, ELEVENLABS_API_KEY!, lessonManager);

  // Set the client WebSocket for the voice agent
  voiceAgent.setClientWebSocket(ws);

  // Handle messages from the client
  ws.on("message", async (data: WebSocket.Data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log(`📨 Received from client: ${message.type}`);

      switch (message.type) {
        case "start_session":
          // Start lesson session and connect to ElevenLabs
          console.log("🎯 Starting session...");
          lessonManager.startSession();
          console.log("📞 Attempting to connect to ElevenLabs...");
          await voiceAgent.startConversation();
          console.log("✅ ElevenLabs connection successful");
          break;

        case "end_session":
          // End the voice agent conversation
          await voiceAgent.endConversation();
          break;

        case "performance_update":
          // Update performance metrics from frontend
          if (message.data?.attempt) {
            voiceAgent.updatePerformanceMetrics(message.data.attempt);
          }
          break;

        case "user_message":
          // Forward user text message to agent
          if (message.data?.text) {
            await voiceAgent.sendUserMessage(message.data.text);
          }
          break;

        case "tool_response":
          // Handle tool response from frontend (if needed)
          console.log("📦 Tool response received:", message.data);
          break;

        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("❌ Error processing message:", error);

      // Get detailed error message
      let errorMessage = "Failed to process message";
      let errorDetails = "";

      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || "";
        console.error("❌ Error stack:", errorDetails);
      } else {
        errorDetails = String(error);
      }

      ws.send(
        JSON.stringify({
          type: "error",
          data: {
            message: errorMessage,
            details: errorDetails,
            hint: "Check server console for full error details",
          },
          timestamp: Date.now(),
        })
      );
    }
  });

  // Handle client disconnect
  ws.on("close", async () => {
    console.log(`👋 Client disconnected from ${clientIp}`);
    try {
      await voiceAgent.endConversation();
    } catch (error) {
      console.error("❌ Error cleaning up on disconnect:", error);
    }
  });

  // Handle WebSocket errors
  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      data: { message: "Connected to voice agent server" },
      timestamp: Date.now(),
    })
  );
});

// Handle server errors
wss.on("error", (error) => {
  console.error("❌ WebSocket server error:", error);
});

console.log("✅ WebSocket server running");
console.log(`   Listening on ws://localhost:${PORT}`);
console.log("   Waiting for client connections...\n");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  wss.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down server...");
  wss.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
