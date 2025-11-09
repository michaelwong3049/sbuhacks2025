# Voice Agent Test Console

Interactive test page for the ElevenLabs voice agent integration.

## Access

Navigate to: **http://localhost:3000/test-voice-agent**

## Prerequisites

Before using the test console:

1. ✅ **Backend server running:**

   ```bash
   npm run server
   ```

2. ✅ **Frontend dev server running:**

   ```bash
   npm run dev
   ```

3. ✅ **Environment configured:**

   - `.env.local` has `ELEVENLABS_API_KEY`
   - `.env.local` has `ELEVENLABS_AGENT_ID`

4. ✅ **ElevenLabs agent configured:**
   - Agent created in ElevenLabs dashboard
   - 4 custom client tools added (see main README)

## Features

### 1. Connection Status Panel

- **Real-time state display** (disconnected, connecting, connected, speaking, listening, error)
- **Connection controls** (Connect/Disconnect buttons)
- **Error messages** if connection fails
- **Server address** display

### 2. Agent Activity

- **Speech Transcript:** See what the agent is saying in real-time
- **Listening Indicator:** Shows when agent is listening for your voice
- **Performance Log:** Track simulated note performances sent to agent

### 3. Test Actions

Three test buttons to simulate piano playing:

- **✅ Send Correct Note:** Simulates playing C4 correctly
- **❌ Send Incorrect Note:** Simulates playing D4 when C4 was expected
- **🎵 Send Multiple (C-G):** Simulates playing 5 notes in sequence with random accuracy

Use these to trigger agent responses based on performance data.

### 4. Tool Calls Display

Shows all tool calls made by the agent:

- **Tool name** (start_lesson_exercise, play_demonstration, etc.)
- **Parameters** sent by the agent
- **Results** returned from execution
- **Color-coded JSON** for easy reading

## How to Use

### Step 1: Start Both Servers

**Terminal 1 - Backend:**

```bash
npm run server
```

You should see:

```
✅ WebSocket server running
   Listening on ws://localhost:8080
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

You should see:

```
▲ Next.js 16.0.1
- Local: http://localhost:3000
```

### Step 2: Open Test Page

Navigate to: http://localhost:3000/test-voice-agent

### Step 3: Connect

Click the **"Connect"** button. You should see:

- State changes: `disconnected` → `connecting` → `connected`
- Browser asks for microphone permission (allow it)
- Console logs: "✅ WebSocket connected"

### Step 4: Talk to the Agent

The agent will greet you with its first message. Try saying:

**Example prompts:**

- "Hello, can you help me learn piano?"
- "Start a lesson on the C major scale"
- "Show me how to play middle C"
- "What should I practice?"

Watch the **Agent Speech** panel for responses.

### Step 5: Test Performance Updates

Click the test buttons to simulate playing notes:

- The agent will receive performance data
- After ~10 attempts, the agent may call `get_performance_metrics`
- Agent will provide feedback based on your "performance"

### Step 6: Observe Tool Calls

When the agent wants to perform actions, you'll see tool calls appear:

**Example tool calls:**

- `start_lesson_exercise` - Agent starts a new exercise
- `play_demonstration` - Agent plays example notes
- `update_lesson_phase` - Agent changes lesson phase
- `get_performance_metrics` - Agent requests your stats

## Expected Behavior

### On Connect

1. WebSocket connects to backend
2. Backend connects to ElevenLabs
3. Agent greets you with first message
4. State becomes "connected"

### During Conversation

1. When you speak → state becomes "listening"
2. When agent responds → state becomes "speaking"
3. Transcript updates with agent's words
4. Tool calls appear as agent makes them

### On Performance Updates

1. Click test button → performance log updates
2. After multiple attempts → agent may request metrics
3. Agent provides feedback: "Great job!" or "Let's work on timing"

### On Disconnect

1. Session ends on ElevenLabs
2. WebSocket closes
3. State becomes "disconnected"
4. Auto-reconnect is disabled

## Troubleshooting

### "Connection error" immediately

**Problem:** Server not reachable

**Solutions:**

- Check backend server is running: `npm run server`
- Verify port 8080 is free
- Check firewall settings

### No agent response

**Problem:** ElevenLabs not configured

**Solutions:**

- Verify `.env.local` has correct API key and agent ID
- Check ElevenLabs dashboard - agent should be active
- Look at server terminal for error messages

### Microphone not working

**Problem:** Browser can't access mic

**Solutions:**

- Grant microphone permission when browser asks
- Check browser settings → Site permissions
- Try a different browser (Chrome recommended)
- Check system microphone settings

### Tool calls not appearing

**Problem:** Agent tools not configured

**Solutions:**

- Verify agent has 4 custom client tools in ElevenLabs dashboard
- Check tool names match exactly (case-sensitive)
- Review server logs for tool execution errors

### Performance updates not registering

**Problem:** Connection or data format issue

**Solutions:**

- Ensure you're connected (isConnected = true)
- Check server logs for: "📊 Attempt recorded: ..."
- Verify AttemptData structure is correct

## Console Logs

Useful console messages to watch for:

**Connection:**

```
🔌 Connecting to voice agent server...
✅ WebSocket connected
📥 Received message: session_started
```

**Tool Calls:**

```
🔧 Tool call received! {tool_name: 'start_lesson_exercise', ...}
```

**Performance:**

```
📤 Sent message: performance_update
```

**Agent Activity:**

```
🗣️ Agent speaking: Let's start with middle C...
👂 Agent is now listening...
```

## Development Tips

### Modify the Test Page

The test component is at: `app/test-voice-agent/page.tsx`

You can:

- Add more test buttons
- Customize performance data
- Add new tool call handlers
- Style differently

### Add More Test Scenarios

Example - test different note velocities:

```typescript
const sendSoftNote = () => {
  sendPerformanceUpdate({
    timestamp: Date.now(),
    notePressed: "C4",
    targetNote: "C4",
    correct: true,
    velocity: 0.3, // Soft
    timingDeviation: 10,
  });
};

const sendLoudNote = () => {
  sendPerformanceUpdate({
    timestamp: Date.now(),
    notePressed: "C4",
    targetNote: "C4",
    correct: true,
    velocity: 0.95, // Loud
    timingDeviation: 10,
  });
};
```

### Monitor Backend Server

Watch the server terminal for useful logs:

- `📊 Attempt recorded: C4 (✓)`
- `🔧 Tool call: start_lesson_exercise`
- `📊 Sending performance metrics to agent`

## Next Steps

Once testing is successful:

1. ✅ Connection works
2. ✅ Tool calls received
3. ✅ Performance updates sent
4. ✅ Agent responds appropriately

You're ready to integrate into the actual Learn page!

The real implementation will:

- Replace test buttons with actual piano component
- Track real note playing instead of simulated
- Display exercises visually
- Implement audio ducking
- Add lesson progress tracking
