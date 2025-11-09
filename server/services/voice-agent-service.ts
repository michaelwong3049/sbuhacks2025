/**
 * Voice Agent Service
 * Handles ElevenLabs Conversational AI integration
 */

import { LessonManager } from "./lesson-manager";
import { ServerMessage, ToolCall } from "../types/voice-agent";
import WebSocket from "ws";

export class VoiceAgentService {
  private elevenLabsWs: WebSocket | null = null;
  private lessonManager: LessonManager;
  private clientWs: WebSocket | null = null;
  private agentId: string;
  private apiKey: string;

  constructor(agentId: string, apiKey: string, lessonManager: LessonManager) {
    this.agentId = agentId;
    this.apiKey = apiKey;
    this.lessonManager = lessonManager;
  }

  /**
   * Set the client WebSocket connection
   */
  setClientWebSocket(ws: WebSocket): void {
    this.clientWs = ws;
  }

  /**
   * Start a conversation with the ElevenLabs agent
   * Note: The ElevenLabs client library requires browser APIs, so we need to
   * use a different approach. For now, we'll just notify the client that the
   * session is ready, and the client should connect directly to ElevenLabs.
   */
  async startConversation(): Promise<void> {
    try {
      process.stdout.write("\n🎤 Starting ElevenLabs conversation...\n");
      console.log("🎤 Starting ElevenLabs conversation...");
      const agentIdDisplay = this.agentId ? this.agentId.substring(0, 10) + "..." : "MISSING";
      const apiKeyDisplay = this.apiKey ? "Set (" + this.apiKey.substring(0, 10) + "...)" : "MISSING";
      process.stdout.write(`   Agent ID: ${agentIdDisplay}\n`);
      process.stdout.write(`   API Key: ${apiKeyDisplay}\n`);
      console.log(`   Agent ID: ${agentIdDisplay}`);
      console.log(`   API Key: ${apiKeyDisplay}`);

      if (!this.agentId || !this.apiKey) {
        throw new Error("Missing ElevenLabs credentials. Check .env.local file.");
      }

      // The ElevenLabs client library requires browser APIs (getUserMedia)
      // which are not available in Node.js. The client must connect to ElevenLabs
      // directly from the browser. The server will handle tool calls and lesson management.
      console.log("📡 Session ready - client should connect to ElevenLabs directly");

      // Notify client that session is ready
      // Note: The client needs to connect to ElevenLabs using the @elevenlabs/client
      // library in the browser, and forward tool calls to this server
      this.sendToClient({
        type: "session_started",
        data: {
          message: "Voice agent session ready - connect to ElevenLabs from browser",
          agentId: this.agentId,
          // Note: API key should be provided via environment variable on client side
          // or through a secure token exchange mechanism
        },
        timestamp: Date.now(),
      });

      console.log("✅ Session started - waiting for client to connect to ElevenLabs");
    } catch (error) {
      process.stdout.write("\n❌❌❌ FAILED TO START CONVERSATION ❌❌❌\n");
      console.error("❌ Failed to start conversation:", error);
      if (error instanceof Error) {
        process.stdout.write(`   Error message: ${error.message}\n`);
        process.stdout.write(`   Error stack: ${error.stack}\n`);
        console.error("   Error message:", error.message);
        console.error("   Error stack:", error.stack);
      } else {
        process.stdout.write(`   Error (not Error instance): ${String(error)}\n`);
        console.error("   Error (not Error instance):", error);
      }
      throw error;
    }
  }

  /**
   * Handle messages from the ElevenLabs agent
   */
  private handleAgentMessage(message: any): void {
    // Handle tool calls from the agent
    if (message.type === "tool_call" || message.tool_call) {
      const toolCall: ToolCall = {
        tool_name: message.tool_call?.name || message.name,
        parameters: message.tool_call?.parameters || message.parameters,
      };
      this.handleToolCall(toolCall, message.tool_call_id || message.id);
      return;
    }

    // Handle agent state changes (speaking, listening, etc.)
    if (message.type === "agent_response" || message.role === "agent") {
      this.sendToClient({
        type: "agent_speaking",
        data: { text: message.text || message.content },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle tool calls from the agent
   */
  private async handleToolCall(toolCall: ToolCall, toolCallId?: string): Promise<void> {
    console.log(`🔧 Tool call: ${toolCall.tool_name}`, toolCall.parameters);

    let result: any = null;

    try {
      switch (toolCall.tool_name) {
        case "get_performance_metrics":
          result = this.handleGetPerformanceMetrics();
          break;

        case "start_lesson_exercise":
          result = this.handleStartLessonExercise(toolCall.parameters);
          break;

        case "play_demonstration":
          result = this.handlePlayDemonstration(toolCall.parameters);
          break;

        case "update_lesson_phase":
          result = this.handleUpdateLessonPhase(toolCall.parameters);
          break;

        default:
          console.warn(`⚠️ Unknown tool: ${toolCall.tool_name}`);
          result = { error: "Unknown tool" };
      }

      // Forward tool call to frontend client
      // Note: We're using "client" type tools, so they're executed on the client side
      // The agent doesn't expect a response back
      this.sendToClient({
        type: "tool_call",
        data: { tool_name: toolCall.tool_name, parameters: toolCall.parameters, result },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`❌ Error executing tool ${toolCall.tool_name}:`, error);
    }
  }

  /**
   * Tool: Get performance metrics
   */
  private handleGetPerformanceMetrics(): any {
    const metrics = this.lessonManager.getMetrics();
    const summary = this.lessonManager.getMetricsSummary();

    console.log("📊 Sending performance metrics to agent");
    return {
      metrics,
      summary,
      timestamp: Date.now(),
    };
  }

  /**
   * Tool: Start lesson exercise
   */
  private handleStartLessonExercise(params: any): any {
    const { exerciseName, targetNotes, tempo } = params;

    // Parse targetNotes if it's a comma-separated string
    const notesArray =
      typeof targetNotes === "string" ? targetNotes.split(",").map((n: string) => n.trim()) : targetNotes;

    const exercise = {
      name: exerciseName,
      targetNotes: notesArray,
      tempo: tempo || 80,
    };

    this.lessonManager.startExercise(exercise);
    this.lessonManager.updatePhase("demonstration");

    return {
      success: true,
      exercise,
    };
  }

  /**
   * Tool: Play demonstration
   */
  private handlePlayDemonstration(params: any): any {
    const { notes } = params;

    // Parse notes if it's a comma-separated string
    const notesArray = typeof notes === "string" ? notes.split(",").map((n: string) => n.trim()) : notes;

    console.log("🎹 Playing demonstration:", notesArray);

    return {
      success: true,
      notes: notesArray,
    };
  }

  /**
   * Tool: Update lesson phase
   */
  private handleUpdateLessonPhase(params: any): any {
    const { phase } = params;
    this.lessonManager.updatePhase(phase);

    return {
      success: true,
      phase,
    };
  }

  /**
   * Send a message to the frontend client
   */
  private sendToClient(message: ServerMessage): void {
    if (this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
      this.clientWs.send(JSON.stringify(message));
    }
  }

  /**
   * Send user text input to the agent
   * Note: This method is a placeholder for future implementation
   * The ElevenLabs SDK handles audio input automatically
   */
  async sendUserMessage(text: string): Promise<void> {
    console.log("💬 User message (text input not directly supported in voice mode):", text);
    // Text input is not supported in the current SDK for voice conversations
    // The agent listens to audio input directly
  }

  /**
   * Update performance metrics from frontend
   */
  updatePerformanceMetrics(attemptData: any): void {
    this.lessonManager.recordAttempt(attemptData);
  }

  /**
   * End the conversation
   */
  async endConversation(): Promise<void> {
    if (this.elevenLabsWs) {
      this.elevenLabsWs.close();
      this.elevenLabsWs = null;
    }
    this.lessonManager.endSession();
  }
}
