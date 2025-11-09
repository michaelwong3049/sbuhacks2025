# 🎵 Jam Session - Peer-to-Peer Multiplayer

## Overview
The Jam Session feature allows multiple users to play different instruments together in real-time using WebRTC peer-to-peer connections. Each user can select their own instrument and play simultaneously!

## How It Works

### 1. **Peer-to-Peer Connection**
- Uses WebRTC via PeerJS for direct browser-to-browser connections
- No server required for audio/gesture data (peer-to-peer)
- Uses PeerJS cloud service for signaling (peer discovery)

### 2. **Room System**
- **Create Room**: Host creates a new jam session room
- **Join Room**: Other users can join using the room ID
- Each user gets a unique Peer ID that can be shared with others

### 3. **Instrument Selection**
- Each user can select their own instrument:
  - 🥁 Drums
  - 🎹 Piano
  - 🎵 Tambourine
  - 🔺 Triangle
- Multiple users can play the same or different instruments

### 4. **Real-Time Communication**
- Hand tracking data is shared between peers
- Instrument changes are synchronized
- Each user plays their instrument locally and others can see/hear

## Usage Instructions

### For Hackathon Demo:

1. **First User (Host)**:
   - Go to "Jam Session" in the sidebar
   - Click "Create Room"
   - Copy your Peer ID
   - Share the Peer ID with other users

2. **Other Users**:
   - Go to "Jam Session" in the sidebar
   - Click "Join Room" (or enter room ID if provided)
   - Click "Connect to Peer"
   - Enter the Host's Peer ID
   - Select your instrument
   - Start playing!

3. **Playing Together**:
   - Each user selects their instrument
   - All users can see who's connected
   - Each user plays on their own device
   - Perfect for a live demo with multiple laptops!

## Technical Details

### PeerJS Integration
- Uses PeerJS cloud service (0.peerjs.com) for signaling
- Falls back to local mode if cloud service is unavailable
- Handles peer discovery and connection establishment

### Data Flow
```
User 1 (Drums)  ←→  PeerJS Server  ←→  User 2 (Piano)
     ↓                                        ↓
  Hand Data                              Hand Data
     ↓                                        ↓
  Local Audio                          Local Audio
```

### Message Types
- `join`: User joins with instrument
- `instrument-change`: User changes instrument
- `hand-data`: Hand tracking data (for visualization)
- `leave`: User disconnects

## Limitations & Future Improvements

### Current Limitations:
- Manual peer connection (users must share Peer IDs)
- No automatic peer discovery
- Each user plays locally (no shared audio mixing)
- Requires HTTPS or localhost for WebRTC

### Future Enhancements:
- Automatic peer discovery via signaling server
- Shared audio mixing (all instruments together)
- Visual representation of other players' hands
- Room-based discovery (find rooms by name)
- Better error handling and reconnection logic

## Demo Tips

1. **For Best Results**:
   - Use HTTPS or localhost
   - Test with 2-4 users maximum
   - Each user on a different device
   - Share Peer IDs via chat/messaging

2. **Troubleshooting**:
   - If connection fails, check browser console
   - Make sure all users are on HTTPS or localhost
   - Try refreshing and reconnecting
   - Check that PeerJS cloud service is accessible

3. **Presentation**:
   - Have one laptop per instrument
   - Show the connected peers list
   - Demonstrate switching instruments
   - Play a song together!

## Files

- `jam-session-client.tsx`: Main jam session UI component
- `peer-manager.ts`: WebRTC peer connection manager
- `/jam/page.tsx`: Jam session page route

## Dependencies

- `peerjs`: WebRTC peer-to-peer library
- `@types/peerjs`: TypeScript types for PeerJS

