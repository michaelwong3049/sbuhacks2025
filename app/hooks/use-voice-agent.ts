/**
 * React Hook for Voice Agent Integration
 * Manages WebSocket connection to the voice agent server and ElevenLabs connection
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type VoiceAgentState = "disconnected" | "connecting" | "connected" | "speaking" | "listening" | "error";

export interface AttemptData {
  timestamp: number;
  notePressed: string;
  targetNote: string;
  correct: boolean;
  velocity: number;
  timingDeviation: number;
}

export interface ToolCallData {
  tool_name: string;
  parameters: any;
  result?: any;
}

export interface VoiceAgentHookReturn {
  // State
  state: VoiceAgentState;
  isConnected: boolean;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendPerformanceUpdate: (attempt: AttemptData) => void;
  sendContextualUpdate: (message: string) => void;

  // Callbacks (set by consumer)
  onToolCall: (toolCall: ToolCallData) => void;
  setOnToolCall: (callback: (toolCall: ToolCallData) => void) => void;
  onAgentSpeaking: (text: string) => void;
  setOnAgentSpeaking: (callback: (text: string) => void) => void;
  onAgentListening: () => void;
  setOnAgentListening: (callback: () => void) => void;
}

// Use environment variable or default to 8000 (matches server default)
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const RECONNECT_DELAY = 3000; // 3 seconds

export function useVoiceAgent(): VoiceAgentHookReturn {
  const [state, setState] = useState<VoiceAgentState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef<boolean>(false);
  const elevenLabsConversationRef = useRef<any>(null);
  const agentIdRef = useRef<string | null>(null);
  const connectToElevenLabsRef = useRef<((agentId: string) => Promise<void>) | null>(null);

  // Callback refs
  const onToolCallRef = useRef<(toolCall: ToolCallData) => void>(() => {});
  const onAgentSpeakingRef = useRef<(text: string) => void>(() => {});
  const onAgentListeningRef = useRef<() => void>(() => {});

  /**
   * Send a message to the WebSocket server
   */
  const sendMessage = useCallback((type: string, data: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
        })
      );
      console.log(`📤 Sent message: ${type}`, data);
    } else {
      console.warn("⚠️ WebSocket not open, cannot send message");
    }
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      console.log("📥 Raw WebSocket message:", event.data);
      const message = JSON.parse(event.data);
      console.log("📥 Parsed message:", { type: message.type, data: message.data });

      switch (message.type) {
        case "connected":
          console.log("✅ Connected to voice agent server");
          break;

        case "session_started":
          setState("connected");
          setError(null);
          // Connect to ElevenLabs if agentId is provided
          if (message.data?.agentId && connectToElevenLabsRef.current) {
            agentIdRef.current = message.data.agentId;
            connectToElevenLabsRef.current(message.data.agentId);
          }
          break;

        case "session_ended":
          setState("connected"); // Still connected to server, but session ended
          break;

        case "agent_speaking":
          setState("speaking");
          if (message.data?.text) {
            onAgentSpeakingRef.current(message.data.text);
          }
          break;

        case "agent_listening":
          setState("listening");
          onAgentListeningRef.current();
          break;

        case "tool_call":
          if (message.data) {
            onToolCallRef.current(message.data);
          }
          break;

        case "error":
          console.error("❌ Server error:", message.data?.message);
          setError(message.data?.message || "Unknown error");
          setState("error");
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (err) {
      console.error("❌ Error parsing message:", err);
    }
  }, []);

  /**
   * Connect to the WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected");
      return;
    }

    try {
      console.log("🔌 Connecting to voice agent server...");
      setState("connecting");
      setError(null);
      shouldReconnectRef.current = true;

      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setState("connected");
        setError(null);

        // Start the voice agent session
        sendMessage("start_session");
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error("❌ WebSocket error:", event);
        setError("Connection error");
        setState("error");
      };

      ws.onclose = () => {
        console.log("👋 WebSocket closed");
        setState("disconnected");
        wsRef.current = null;

        // Attempt to reconnect if we should
        if (shouldReconnectRef.current) {
          console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error("❌ Failed to connect:", err);
      setError("Failed to connect to voice agent server");
      setState("error");
    }
  }, [sendMessage, handleMessage]);

  /**
   * Disconnect from the WebSocket server and ElevenLabs
   */
  const disconnect = useCallback(async () => {
    console.log("🔌 Disconnecting from voice agent server...");
    shouldReconnectRef.current = false;

    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Disconnect from ElevenLabs
    if (elevenLabsConversationRef.current) {
      try {
        await elevenLabsConversationRef.current.endSession();
        elevenLabsConversationRef.current = null;
        console.log("✅ Disconnected from ElevenLabs");
      } catch (err) {
        console.error("❌ Error disconnecting from ElevenLabs:", err);
      }
    }

    // Send end session message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendMessage("end_session");

      // Close WebSocket after a short delay to allow message to send
      setTimeout(() => {
        wsRef.current?.close();
        wsRef.current = null;
      }, 100);
    } else {
      wsRef.current?.close();
      wsRef.current = null;
    }

    setState("disconnected");
  }, [sendMessage]);

  /**
   * Connect to ElevenLabs from the browser
   *
   * SECURITY: Fetches API key from server-side API route instead of using NEXT_PUBLIC
   * This is still not ideal, but better than exposing it in the client bundle.
   */
  const connectToElevenLabs = useCallback(
    async (agentId: string) => {
      try {
        // Dynamically import ElevenLabs client (only in browser)
        if (typeof window === "undefined") {
          console.warn("⚠️ ElevenLabs client can only be used in browser");
          return;
        }

        console.log("\n" + "=".repeat(60));
        console.log("🎤 CONNECTING TO ELEVENLABS");
        console.log("=".repeat(60));
        console.log("📤 Step 1: Using PUBLIC agent (no API key needed)");
        console.log("   Agent ID:", agentId);
        console.log("   Agent ID length:", agentId.length);

        setState("connecting");

        if (!agentId) {
          console.error("❌ Agent ID is required");
          setError("Agent ID is required");
          return;
        }

        console.log("\n📦 Step 2: Importing ElevenLabs SDK...");
        const { Conversation } = await import("@elevenlabs/client");
        console.log("   ✅ SDK imported");

        console.log("\n🔌 Step 3: Starting ElevenLabs conversation...");
        console.log("   Agent ID:", agentId);
        console.log("   Agent ID length:", agentId.length);
        console.log("   Connection type: websocket");
        console.log("   NOTE: Using PUBLIC agent - no authorization parameter needed!");
        console.log("   According to ElevenLabs docs, public agents only need agentId");

        // For PUBLIC agents, we only need agentId and connectionType
        // NO authorization parameter! The SDK documentation clearly states:
        // "For public agents, you can use the ID directly" - no API key needed
        // For private agents, we would need a signedUrl (obtained from server with API key)
        const conversationConfig = {
          agentId: agentId,
          connectionType: "websocket" as const,
          
          // Client tools allow the agent to control the lesson UI
          // NOTE: These tool names must match exactly what's configured in ElevenLabs dashboard
          clientTools: {
            start_lesson_exercise: async (parameters: { exerciseName: string; targetNotes: string[]; tempo?: number }) => {
              console.log("🔧 Client tool called: start_lesson_exercise", parameters);
              // This will trigger the tool call callback in the frontend via onMessage
              return "Exercise started";
            },
            update_lesson_phase: async (parameters: { phase: string }) => {
              console.log("🔧 Client tool called: update_lesson_phase", parameters);
              return "Phase updated";
            },
            play_demonstration: async (parameters: { notes: string[] }) => {
              console.log("🔧 Client tool called: play_demonstration", parameters);
              return "Demonstration played";
            },
            get_performance_metrics: async () => {
              console.log("🔧 Client tool called: get_performance_metrics");
              return "Metrics retrieved";
            },
            move_to_next_lesson: async () => {
              console.log("🔧 Client tool called: move_to_next_lesson");
              // This will trigger the tool call callback in the frontend via onMessage
              return "Moving to next lesson";
            },
          },
          
          onConnect: () => {
            console.log("\n" + "=".repeat(60));
            console.log("✅ CONNECTED TO ELEVENLABS AGENT");
            console.log("=".repeat(60));
            setState("connected");
          },
          onDisconnect: (event?: CloseEvent | { code?: number; reason?: string }) => {
            console.log("\n" + "=".repeat(60));
            console.log("❌ DISCONNECTED FROM ELEVENLABS");
            console.log("=".repeat(60));
            console.log("📋 Disconnect event:", event);
            console.log("📋 Event type:", typeof event);
            console.log("📋 Event keys:", event ? Object.keys(event) : "no event");

            if (event && "code" in event) {
              const code = event.code;
              const reason = event.reason || "Unknown reason";

              console.log("   Code:", code);
              console.log("   Reason:", reason);
              if ("wasClean" in event) {
                console.log("   Was clean:", event.wasClean);
              }

              if (code === 3000) {
                console.error("\n" + "=".repeat(60));
                console.error("❌ AUTHORIZATION FAILED (CODE 3000)");
                console.error("=".repeat(60));
                console.error("   Reason:", reason);
                console.error("\n🔧 FIX THIS IN ELEVENLABS DASHBOARD:");
                console.error("   1. Go to: https://elevenlabs.io/app/api-keys");
                console.error("   2. Click on your API key → Edit");
                console.error("   3. Enable 'Conversational AI' permission");
                console.error("   4. If there's 'Unrestricted' option, enable it");
                console.error("\n   5. Go to your Agent settings");
                console.error("   6. Check if 'Private Agent' is enabled → DISABLE IT");
                console.error("   7. Check if 'Authentication' is enabled → DISABLE IT");
                console.error("   8. If there's an 'Allowlist' → Add 'localhost' to it");
                console.error("=".repeat(60) + "\n");
                setError(`Authorization failed: ${reason}. Check console for fix steps.`);
              } else {
                console.error(`❌ Connection error (code ${code}): ${reason}`);
                setError(`Connection error (code ${code}): ${reason}`);
              }
              setState("error");
            } else {
              console.log("   Normal disconnect (no error code)");
              setState("disconnected");
            }
          },
          onMessage: (message: any) => {
            console.log("📩 Agent message:", message);
            console.log("📩 Message type:", message?.type);
            console.log("📩 Message keys:", message ? Object.keys(message) : "no message");

            // Handle agent responses (speaking)
            if (message.type === "agent_response" || message.role === "agent" || (message.type === "message" && message.role === "assistant")) {
              setState("speaking");
              const text = message.text || message.content || message.message?.text || message.message?.content;
              if (text) {
                console.log("🗣️ Agent speaking:", text);
                onAgentSpeakingRef.current(text);
              }
            }

            // Handle tool calls
            if (message.type === "tool_call" || message.tool_call || (message.type === "message" && message.tool_calls)) {
              const toolCallData = message.tool_call || message.tool_calls?.[0] || message;
              const toolCall: ToolCallData = {
                tool_name: toolCallData.name || toolCallData.function?.name || message.name,
                parameters: toolCallData.parameters || toolCallData.function?.arguments || (typeof toolCallData.function?.arguments === "string" ? JSON.parse(toolCallData.function.arguments) : toolCallData.parameters) || message.parameters,
              };
              console.log("🔧 Processing tool call:", toolCall);
              onToolCallRef.current(toolCall);
              sendMessage("tool_call", { toolCall });
            }

            // Handle listening state
            if (message.type === "listening" || message.state === "listening" || (message.type === "message" && message.role === "user")) {
              setState("listening");
              onAgentListeningRef.current();
            }
          },
          onError: (error: unknown) => {
            console.error("\n" + "=".repeat(60));
            console.error("❌ ELEVENLABS ERROR CALLBACK");
            console.error("=".repeat(60));
            console.error("   Error:", error);
            console.error("   Error type:", typeof error);
            console.error("   Error instanceof Error:", error instanceof Error);
            if (error instanceof Error) {
              console.error("   Error message:", error.message);
              console.error("   Error stack:", error.stack);
            }
            console.error("=".repeat(60) + "\n");
            setError(error instanceof Error ? error.message : "ElevenLabs connection error");
            setState("error");
          },
        };

        console.log("   Config object created");
        console.log("   Config keys:", Object.keys(conversationConfig));
        console.log("   Calling Conversation.startSession...");

        let conversation;
        try {
          conversation = await Conversation.startSession(conversationConfig);
          console.log("   ✅ startSession returned successfully");
        } catch (startError) {
          console.error("\n" + "=".repeat(60));
          console.error("❌ startSession THREW AN ERROR");
          console.error("=".repeat(60));
          console.error("   Error:", startError);
          console.error("   Error type:", typeof startError);
          console.error("   Error instanceof Error:", startError instanceof Error);
          console.error("   Error instanceof CloseEvent:", startError instanceof CloseEvent);

          // Handle CloseEvent (authorization failure)
          if (
            startError instanceof CloseEvent ||
            (startError && typeof startError === "object" && "code" in startError)
          ) {
            const code = (startError as any).code;
            const reason = (startError as any).reason || "Unknown reason";

            console.error("   This is a CloseEvent (WebSocket closed)");
            console.error("   Code:", code);
            console.error("   Reason:", reason);

            if (code === 3000) {
              console.error("\n" + "=".repeat(60));
              console.error("❌ AUTHORIZATION FAILED (CODE 3000)");
              console.error("=".repeat(60));
              console.error("   Reason:", reason);
              console.error("\n🔧 FIX THIS IN ELEVENLABS DASHBOARD:");
              console.error("   1. Go to: https://elevenlabs.io/app/api-keys");
              console.error("   2. Click on your API key → Edit");
              console.error("   3. Enable 'Conversational AI' permission");
              console.error("   4. If there's 'Unrestricted' option, enable it");
              console.error("\n   5. Go to your Agent settings");
              console.error("   6. Check if 'Private Agent' is enabled → DISABLE IT");
              console.error("   7. Check if 'Authentication' is enabled → DISABLE IT");
              console.error("   8. If there's an 'Allowlist' → Add 'localhost' to it");
              console.error("=".repeat(60) + "\n");
              setError(`Authorization failed: ${reason}. Check console for fix steps.`);
              setState("error");
              return; // Don't throw, we've handled it
            }
          }

          if (startError instanceof Error) {
            console.error("   Error message:", startError.message);
            console.error("   Error stack:", startError.stack);
          }
          console.error("=".repeat(60) + "\n");
          throw startError;
        }

        elevenLabsConversationRef.current = conversation;
        console.log("\n✅ Step 6: Conversation object created");
        console.log("   Conversation object:", conversation);
        console.log("   Conversation type:", typeof conversation);
        console.log("   Conversation keys:", conversation ? Object.keys(conversation) : "no conversation");
        console.log("   Waiting for connection...");
        console.log("=".repeat(60) + "\n");
      } catch (err) {
        console.error("❌ Failed to connect to ElevenLabs:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to ElevenLabs");
        setState("error");
      }
    },
    [sendMessage]
  );

  // Store the function in a ref so it can be called from handleMessage
  useEffect(() => {
    connectToElevenLabsRef.current = connectToElevenLabs;
  }, [connectToElevenLabs]);

  /**
   * Send contextual update to the voice agent
   */
  const sendContextualUpdate = useCallback(
    (message: string) => {
      if (elevenLabsConversationRef.current) {
        try {
          // Check if sendContextualUpdate method exists
          if (typeof elevenLabsConversationRef.current.sendContextualUpdate === "function") {
            elevenLabsConversationRef.current.sendContextualUpdate(message);
            console.log("📤 ✅ Sent contextual update to ElevenLabs:", message);
          } else {
            console.warn("⚠️ sendContextualUpdate method not found on conversation object");
            console.log("📤 Available methods:", Object.keys(elevenLabsConversationRef.current));
            // Try alternative method names
            if (typeof (elevenLabsConversationRef.current as any).sendContext === "function") {
              (elevenLabsConversationRef.current as any).sendContext(message);
            } else {
              // Fallback: send via WebSocket
              sendMessage("contextual_update", { message });
            }
          }
        } catch (error) {
          console.error("❌ Failed to send contextual update:", error);
          // Fallback: send via WebSocket
          sendMessage("contextual_update", { message });
        }
      } else {
        console.warn("⚠️ ElevenLabs conversation not active, cannot send contextual update.");
        console.warn("   Message that would have been sent:", message);
      }
    },
    [sendMessage]
  );

  /**
   * Send performance update to the voice agent
   */
  const sendPerformanceUpdate = useCallback(
    (attempt: AttemptData) => {
      // Send as contextual update so agent can respond in real-time
      const message = `Student just played note ${attempt.notePressed}. Target was ${attempt.targetNote}. ${attempt.correct ? "Correct!" : "Incorrect."}`;
      
      // Use sendContextualUpdate which is now defined above
      sendContextualUpdate(message);
      
      // Also send via WebSocket as backup
      sendMessage("performance_update", { attempt });
    },
    [sendMessage, sendContextualUpdate]
  );

  /**
   * Set callback for tool calls
   */
  const setOnToolCall = useCallback((callback: (toolCall: ToolCallData) => void) => {
    onToolCallRef.current = callback;
  }, []);

  /**
   * Set callback for agent speaking
   */
  const setOnAgentSpeaking = useCallback((callback: (text: string) => void) => {
    onAgentSpeakingRef.current = callback;
  }, []);

  /**
   * Set callback for agent listening
   */
  const setOnAgentListening = useCallback((callback: () => void) => {
    onAgentListeningRef.current = callback;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (elevenLabsConversationRef.current) {
        elevenLabsConversationRef.current.endSession().catch(console.error);
      }
    };
  }, []);

  return {
    // State
    state,
    isConnected: state === "connected" || state === "speaking" || state === "listening",
    error,

    // Actions
    connect,
    disconnect,
    sendPerformanceUpdate,
    sendContextualUpdate,

    // Callbacks
    onToolCall: onToolCallRef.current,
    setOnToolCall,
    onAgentSpeaking: onAgentSpeakingRef.current,
    setOnAgentSpeaking,
    onAgentListening: onAgentListeningRef.current,
    setOnAgentListening,
  };
}
