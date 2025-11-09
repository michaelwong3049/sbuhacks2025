# Manual Testing Guide for useVoiceAgent Hook

Since this hook requires WebSocket connection to a running server, automated tests are challenging. Use this manual testing guide instead.

## Prerequisites

1. ✅ Backend server running: `npm run server`
2. ✅ `.env.local` configured with ElevenLabs credentials
3. ✅ ElevenLabs agent configured with custom tools

## Test 1: Basic Connection

**Create a test component:**

```typescript
// app/test-voice-agent/page.tsx
"use client";

import { useVoiceAgent } from "@/app/hooks/use-voice-agent";

export default function TestVoiceAgent() {
  const { state, isConnected, error, connect, disconnect } = useVoiceAgent();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Voice Agent Test</h1>
      <p>
        State: <strong>{state}</strong>
      </p>
      <p>
        Connected: <strong>{isConnected ? "Yes" : "No"}</strong>
      </p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <button onClick={connect} disabled={isConnected}>
        Connect
      </button>
      <button onClick={disconnect} disabled={!isConnected}>
        Disconnect
      </button>
    </div>
  );
}
```

**Expected behavior:**

1. Click "Connect" → state changes to "connecting" → "connected"
2. Console shows: "🔌 Connecting to voice agent server..."
3. Console shows: "✅ WebSocket connected"
4. Console shows: "📥 Received message: session_started"
5. Click "Disconnect" → state changes to "disconnected"

## Test 2: Tool Call Handling

**Add tool call handler:**

```typescript
"use client";

import { useVoiceAgent } from "@/app/hooks/use-voice-agent";
import { useEffect, useState } from "react";

export default function TestVoiceAgent() {
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const { state, isConnected, connect, disconnect, setOnToolCall } = useVoiceAgent();

  useEffect(() => {
    setOnToolCall((toolCall) => {
      console.log("Tool call received!", toolCall);
      setToolCalls((prev) => [...prev, toolCall]);
    });
  }, [setOnToolCall]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Voice Agent Test</h1>
      <p>State: {state}</p>

      <button onClick={connect} disabled={isConnected}>
        Connect
      </button>
      <button onClick={disconnect} disabled={!isConnected}>
        Disconnect
      </button>

      <h2>Tool Calls:</h2>
      <ul>
        {toolCalls.map((call, i) => (
          <li key={i}>
            <strong>{call.tool_name}</strong>
            <pre>{JSON.stringify(call.parameters, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Expected behavior:**

1. Connect to agent
2. Speak to the agent (your microphone should work)
3. Agent should call tools based on conversation
4. Tool calls appear in the list

## Test 3: Performance Updates

**Add performance update sender:**

```typescript
const { sendPerformanceUpdate } = useVoiceAgent();

const testPerformanceUpdate = () => {
  sendPerformanceUpdate({
    timestamp: Date.now(),
    notePressed: "C4",
    targetNote: "C4",
    correct: true,
    velocity: 0.8,
    timingDeviation: 50,
  });
};

// In JSX:
<button onClick={testPerformanceUpdate} disabled={!isConnected}>
  Send Test Performance
</button>;
```

**Expected behavior:**

1. Connect to agent
2. Click "Send Test Performance"
3. Check server logs for: "📊 Attempt recorded: C4 (✓)"
4. Agent may respond based on performance data

## Test 4: Agent Speaking

**Add speaking handler:**

```typescript
const [transcript, setTranscript] = useState("");

useEffect(() => {
  setOnAgentSpeaking((text) => {
    console.log("Agent speaking:", text);
    setTranscript(text);
  });
}, [setOnAgentSpeaking]);

// In JSX:
<div>
  <h3>Agent Says:</h3>
  <p>{transcript || "Nothing yet..."}</p>
</div>;
```

**Expected behavior:**

1. Connect to agent
2. Agent greets you (first message)
3. Transcript appears on screen
4. Console shows: "Agent speaking: ..."

## Test 5: Auto-Reconnect

**Test reconnection:**

1. Connect to agent (state: connected)
2. Stop the server: `Ctrl+C` in server terminal
3. Wait 3 seconds
4. Check console for: "🔄 Reconnecting in 3s..."
5. Restart server: `npm run server`
6. Should auto-reconnect within 3 seconds

**Expected behavior:**

- Connection automatically restored
- State goes: connected → error → connecting → connected

## Common Issues

### "Connection error" immediately

- Server not running → Start with `npm run server`
- Wrong port → Check WEBSOCKET_URL in use-voice-agent.ts

### Tool calls not received

- ElevenLabs agent not configured properly
- Check server logs for tool execution
- Verify agent has custom tools added

### No agent audio

- Microphone not working
- Browser blocked microphone access
- ElevenLabs API key invalid

## Checklist

- [ ] Test 1: Basic connection works
- [ ] Test 2: Tool calls received
- [ ] Test 3: Performance updates sent
- [ ] Test 4: Agent speaking detected
- [ ] Test 5: Auto-reconnect works
- [ ] Cleanup on unmount (no memory leaks)
- [ ] Error handling works properly
