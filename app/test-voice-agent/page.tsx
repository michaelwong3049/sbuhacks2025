"use client";

import { useVoiceAgent } from "@/app/hooks/use-voice-agent";
import { useEffect, useState } from "react";
import type { ToolCallData, AttemptData } from "@/app/hooks/use-voice-agent";

export default function TestVoiceAgent() {
  const [toolCalls, setToolCalls] = useState<ToolCallData[]>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [listeningIndicator, setListeningIndicator] = useState<boolean>(false);
  const [performanceLog, setPerformanceLog] = useState<string[]>([]);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);

  const {
    state,
    isConnected,
    error,
    connect,
    disconnect,
    sendPerformanceUpdate,
    setOnToolCall,
    setOnAgentSpeaking,
    setOnAgentListening,
  } = useVoiceAgent();

  // Set up tool call handler
  useEffect(() => {
    setOnToolCall((toolCall) => {
      console.log("🔧 Tool call received!", toolCall);
      setToolCalls((prev) => [...prev, { ...toolCall, timestamp: Date.now() }]);
    });
  }, [setOnToolCall]);

  // Set up agent speaking handler
  useEffect(() => {
    setOnAgentSpeaking((text) => {
      console.log("🗣️ Agent speaking:", text);
      setTranscript(text);
    });
  }, [setOnAgentSpeaking]);

  // Set up agent listening handler
  useEffect(() => {
    setOnAgentListening(() => {
      console.log("👂 Agent is now listening...");
      setListeningIndicator(true);
      setTranscript("");

      // Reset listening indicator after 2 seconds
      setTimeout(() => setListeningIndicator(false), 2000);
    });
  }, [setOnAgentListening]);

  // Test performance update functions
  const sendCorrectNote = () => {
    const attempt: AttemptData = {
      timestamp: Date.now(),
      notePressed: "C4",
      targetNote: "C4",
      correct: true,
      velocity: 0.8,
      timingDeviation: 25,
    };
    sendPerformanceUpdate(attempt);
    setPerformanceLog((prev) => [...prev, `✅ C4 (correct, +25ms)`]);
  };

  const sendIncorrectNote = () => {
    const attempt: AttemptData = {
      timestamp: Date.now(),
      notePressed: "D4",
      targetNote: "C4",
      correct: false,
      velocity: 0.6,
      timingDeviation: 150,
    };
    sendPerformanceUpdate(attempt);
    setPerformanceLog((prev) => [...prev, `❌ D4 instead of C4 (+150ms)`]);
  };

  const sendMultipleAttempts = () => {
    const notes = ["C4", "D4", "E4", "F4", "G4"];
    notes.forEach((note, index) => {
      setTimeout(() => {
        const correct = Math.random() > 0.3; // 70% success rate
        const attempt: AttemptData = {
          timestamp: Date.now(),
          notePressed: note,
          targetNote: note,
          correct,
          velocity: 0.5 + Math.random() * 0.5,
          timingDeviation: Math.floor(Math.random() * 200),
        };
        sendPerformanceUpdate(attempt);
        setPerformanceLog((prev) => [...prev, `${correct ? "✅" : "❌"} ${note} (${attempt.timingDeviation}ms)`]);
      }, index * 500);
    });
  };

  const clearLogs = () => {
    setToolCalls([]);
    setPerformanceLog([]);
    setTranscript("");
    setConnectionLog([]);
  };

  // Log connection state changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLog((prev) => [...prev, `[${timestamp}] State: ${state}`]);
    console.log(`🔄 Voice agent state changed to: ${state}`);
  }, [state]);

  // Log connection status
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLog((prev) => [...prev, `[${timestamp}] Connected: ${isConnected}`]);
    console.log(`🔌 Connection status: ${isConnected}`);
  }, [isConnected]);

  // Log errors
  useEffect(() => {
    if (error) {
      const timestamp = new Date().toLocaleTimeString();
      setConnectionLog((prev) => [...prev, `[${timestamp}] ❌ ERROR: ${error}`]);
      console.error(`❌ Voice agent error:`, error);
    }
  }, [error]);

  // Get state color
  const getStateColor = () => {
    switch (state) {
      case "connected":
        return "text-green-600 dark:text-green-400";
      case "connecting":
        return "text-yellow-600 dark:text-yellow-400";
      case "speaking":
        return "text-blue-600 dark:text-blue-400";
      case "listening":
        return "text-purple-600 dark:text-purple-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Voice Agent Test Console</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Test WebSocket connection and ElevenLabs voice agent integration
        </p>

        {/* Connection Status Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Connection Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">State</div>
              <div className={`text-2xl font-bold ${getStateColor()}`}>{state}</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Connected</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{isConnected ? "✅ Yes" : "❌ No"}</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Server</div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300">ws://localhost:8080</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <div className="text-red-800 dark:text-red-200 font-semibold mb-2">❌ Error</div>
              <div className="text-red-600 dark:text-red-400 whitespace-pre-wrap wrap-break-word">{error}</div>
              <div className="mt-3 text-sm space-y-2">
                <div className="text-red-500 dark:text-red-400">
                  💡 <strong>Troubleshooting steps:</strong>
                </div>
                <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-1 ml-4">
                  <li>
                    Check if the server is running:{" "}
                    <code className="bg-red-100 dark:bg-red-900 px-1 py-0.5 rounded">npm run server</code>
                  </li>
                  <li>
                    Verify <code className="bg-red-100 dark:bg-red-900 px-1 py-0.5 rounded">.env.local</code> has valid
                    ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID
                  </li>
                  <li>Check server terminal for detailed error logs</li>
                  <li>Make sure port 8080 is not being used by another app</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={connect}
              disabled={isConnected}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Connect
            </button>
            <button
              onClick={disconnect}
              disabled={!isConnected}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={clearLogs}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Agent Activity Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Transcript */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span>🗣️</span> Agent Speech
              {listeningIndicator && (
                <span className="text-purple-600 dark:text-purple-400 animate-pulse">(Listening...)</span>
              )}
            </h2>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[120px]">
              {transcript ? (
                <p className="text-gray-900 dark:text-white">{transcript}</p>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">Waiting for agent to speak...</p>
              )}
            </div>
          </div>

          {/* Performance Log */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">📊 Performance Updates</h2>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[120px] max-h-[200px] overflow-y-auto">
              {performanceLog.length > 0 ? (
                <div className="space-y-1 font-mono text-sm">
                  {performanceLog.slice(-10).map((log, i) => (
                    <div key={i} className="text-gray-900 dark:text-white">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">No performance updates sent yet...</p>
              )}
            </div>
          </div>
        </div>

        {/* Test Actions Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">🧪 Test Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={sendCorrectNote}
              disabled={!isConnected}
              className="px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ✅ Send Correct Note
            </button>
            <button
              onClick={sendIncorrectNote}
              disabled={!isConnected}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ❌ Send Incorrect Note
            </button>
            <button
              onClick={sendMultipleAttempts}
              disabled={!isConnected}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🎵 Send Multiple (C-G)
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            💡 These buttons simulate piano notes being played. The agent may respond with feedback based on performance
            data.
          </p>
        </div>

        {/* Tool Calls Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">🔧 Tool Calls from Agent</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            When the agent wants to perform actions (like starting an exercise or playing a demo), it will call these
            tools.
          </p>

          {toolCalls.length > 0 ? (
            <div className="space-y-4">
              {toolCalls.map((call, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-lg text-gray-900 dark:text-white">{call.tool_name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">#{toolCalls.length - i}</span>
                  </div>
                  <div className="bg-black rounded p-3 overflow-x-auto">
                    <pre className="text-green-400 text-xs">{JSON.stringify(call.parameters, null, 2)}</pre>
                  </div>
                  {call.result && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Result:</div>
                      <div className="bg-black rounded p-3 overflow-x-auto">
                        <pre className="text-blue-400 text-xs">{JSON.stringify(call.result, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 italic">
                No tool calls received yet. Connect and talk to the agent to trigger tool calls.
              </p>
            </div>
          )}
        </div>

        {/* Connection Log */}
        <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">📝 Connection Log</h2>
          <div className="bg-black rounded-lg p-4 min-h-[150px] max-h-[200px] overflow-y-auto font-mono text-xs">
            {connectionLog.length > 0 ? (
              <div className="space-y-1">
                {connectionLog.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.includes("ERROR")
                        ? "text-red-400"
                        : log.includes("Connected: true") || log.includes("connected")
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">Connection log will appear here...</p>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            This log shows the connection lifecycle. Watch for state changes and errors.
          </p>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 How to Test</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-200">
            <li>
              Make sure the backend server is running:{" "}
              <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">npm run server</code>
            </li>
            <li>Click "Connect" to establish WebSocket connection</li>
            <li>Your microphone will activate - speak to the agent</li>
            <li>Try: "Can you start a lesson?" or "Play the C major scale"</li>
            <li>Use test buttons to simulate playing notes</li>
            <li>Watch for tool calls and agent responses</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
