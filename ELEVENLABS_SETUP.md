# ElevenLabs Authorization Fix Guide

## Error: "Authorization failed: Could not authorize the conversation" (Code 3000)

This error occurs when your ElevenLabs API key or agent settings don't have the correct permissions for Conversational AI.

## Fix Steps:

### 1. Enable Conversational AI Permission on API Key

1. Go to: https://elevenlabs.io/app/api-keys
2. Click on your API key → **Edit**
3. **Enable "Conversational AI" permission**
4. If there's an **"Unrestricted"** option, **enable it**
5. **Save** the changes

### 2. Configure Your Agent Settings

1. Go to your Agent settings in ElevenLabs dashboard
2. Find your agent (Agent ID: `agent_8401k9jsm6zfegqtzyzz3yeyqmes`)
3. Check the following settings:

   **❌ DISABLE these settings:**
   - **Private Agent** → Set to **DISABLED**
   - **Authentication** → Set to **DISABLED**

   **✅ ENABLE/CHECK these settings:**
   - If there's an **"Allowlist"** or **"Whitelist"** option:
     - Add `localhost` to it
     - Add `127.0.0.1` to it
   - Make sure the agent is **Public** (not Private)

### 3. Verify Your Environment Variables

Make sure your `.env.local` file has:
```env
ELEVENLABS_API_KEY=sk_ab6e8f4a16e6f22f749748031740acd49d6b2c2913935f68
ELEVENLABS_AGENT_ID=agent_8401k9jsm6zfegqtzyzz3yeyqmes
PORT=8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 4. Restart Servers

After making changes in the ElevenLabs dashboard:

1. **Stop** your WebSocket server (Ctrl+C)
2. **Restart** it: `npm run server:dev`
3. **Refresh** your browser page
4. Try clicking "Start Lesson" again

## Common Issues:

### Issue: "Private Agent" is enabled
**Fix:** Go to Agent settings → Disable "Private Agent"

### Issue: "Authentication" is enabled
**Fix:** Go to Agent settings → Disable "Authentication"

### Issue: API key doesn't have "Conversational AI" permission
**Fix:** Go to API keys → Edit your key → Enable "Conversational AI" → Enable "Unrestricted" if available

### Issue: Agent is not found
**Fix:** Double-check your `ELEVENLABS_AGENT_ID` in `.env.local` matches your agent ID in the dashboard

## Still Not Working?

1. Check the browser console for more detailed error messages
2. Check the WebSocket server terminal for errors
3. Verify your API key is valid by testing it in the ElevenLabs dashboard
4. Make sure you're using the correct agent ID (check the URL when viewing your agent in the dashboard)

## Quick Checklist:

- [ ] API key has "Conversational AI" permission enabled
- [ ] API key has "Unrestricted" enabled (if available)
- [ ] Agent has "Private Agent" DISABLED
- [ ] Agent has "Authentication" DISABLED
- [ ] Agent has `localhost` in allowlist (if allowlist exists)
- [ ] `.env.local` has correct API key and Agent ID
- [ ] WebSocket server is running on port 8000
- [ ] Next.js dev server is running on port 3000
- [ ] Both servers restarted after making changes

