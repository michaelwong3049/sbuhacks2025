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
        console.log("📤 Step 1: Fetching credentials from API route...");
        console.log("   Agent ID:", agentId);
        console.log("   Agent ID length:", agentId.length);

        setState("connecting");

        // Fetch API key and agent ID from server-side API route (more secure than NEXT_PUBLIC)
        // Agent ID can come from request or server env var
        const response = await fetch("/api/elevenlabs-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agentId: agentId || undefined }),
        });

        console.log("📥 Step 2: API route response received");
        console.log("   Response status:", response.status, response.statusText);
        console.log("   Response ok:", response.ok);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("❌ API route error:", errorData);
          throw new Error(errorData.error || "Failed to get session credentials");
        }

        const responseData = await response.json();
        console.log("📦 Step 3: Response data parsed");
        console.log("   Response keys:", Object.keys(responseData));
        console.log("   Has agentId:", !!responseData.agentId);
        console.log("   Has apiKey:", !!responseData.apiKey);
        console.log("   Agent ID:", responseData.agentId);
        console.log("   API key length:", responseData.apiKey?.length);

        const { apiKey: apiKeyFromServer } = responseData;

        if (!apiKeyFromServer) {
          console.error("❌ API key not returned from server");
          setError("ElevenLabs API key not configured on server");
          return;
        }

        const trimmedApiKey = apiKeyFromServer.trim();
        if (!trimmedApiKey) {
          console.error("❌ API key is empty");
          setError("Invalid API key received from server");
          return;
        }

        console.log("\n📦 Step 4: Importing ElevenLabs SDK...");
        const { Conversation } = await import("@elevenlabs/client");
        console.log("   ✅ SDK imported");

        console.log("\n🔌 Step 5: Starting ElevenLabs conversation...");
        console.log("   Agent ID:", agentId);
        console.log("   Agent ID length:", agentId.length);
        console.log("   API key length:", trimmedApiKey.length);
        console.log("   API key starts with:", trimmedApiKey.substring(0, 8) + "...");
        console.log("   API key ends with:", "..." + trimmedApiKey.substring(trimmedApiKey.length - 4));
        console.log("   Conversation class:", Conversation);
        console.log("   startSession method:", typeof Conversation.startSession);

        // Create config object first to log it
        const conversationConfig = {
          agentId: agentId,
          authorization: trimmedApiKey,
          connectionType: "websocket" as const,
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

            if (message.type === "agent_response" || message.role === "agent") {
              setState("speaking");
              if (message.text || message.content) {
                onAgentSpeakingRef.current(message.text || message.content);
              }
            }

            if (message.type === "tool_call" || message.tool_call) {
              const toolCall: ToolCallData = {
                tool_name: message.tool_call?.name || message.name,
                parameters: message.tool_call?.parameters || message.parameters,
              };
              onToolCallRef.current(toolCall);
              sendMessage("tool_call", { toolCall });
            }

            if (message.type === "listening" || message.state === "listening") {
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
   * Send performance update to the voice agent
   */
  const sendPerformanceUpdate = useCallback(
    (attempt: AttemptData) => {
      sendMessage("performance_update", { attempt });
    },
    [sendMessage]
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

    // Callbacks
    onToolCall: onToolCallRef.current,
    setOnToolCall,
    onAgentSpeaking: onAgentSpeakingRef.current,
    setOnAgentSpeaking,
    onAgentListening: onAgentListeningRef.current,
    setOnAgentListening,
  };
}
