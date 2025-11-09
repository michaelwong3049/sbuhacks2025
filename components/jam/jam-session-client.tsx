"use client";

import { useEffect, useRef, useState } from "react";
import { PeerManager, Instrument, PeerMessage } from "@/app/lib/webrtc/peer-manager";
import { Instrument as InstrumentType } from "@/components/practice/instruments/instrument-types";
import InstrumentSelector from "@/components/practice/instrument-selector";
import AirDrumsPlayer from "@/components/practice/instruments/air-drums-player";
import PianoPlayer from "@/components/practice/instruments/piano-player";
import TambourinePlayer from "@/components/practice/instruments/tambourine-player";
import TrianglePlayer from "@/components/practice/instruments/triangle-player";
import RemoteSoundPlayer, { RemoteSoundPlayerHandle } from "./remote-sound-player";

interface PeerInfo {
  id: string;
  instrument: Instrument;
  connected: boolean;
}

export default function JamSessionClient() {
  const [roomId, setRoomId] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [myInstrument, setMyInstrument] = useState<InstrumentType>('drums');
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  
  const peerManagerRef = useRef<PeerManager | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const remoteSoundPlayerRef = useRef<RemoteSoundPlayerHandle>(null);

  // Initialize peer manager
  useEffect(() => {
    peerManagerRef.current = new PeerManager();
    
    // Setup message handler - this handles all messages
    peerManagerRef.current.onMessage((peerId, message) => {
      // Handle sound events by playing them remotely
      if (message.type === 'sound-event') {
        console.log('🎵 Received sound event from peer:', peerId, message.event);
        if (remoteSoundPlayerRef.current) {
          try {
            remoteSoundPlayerRef.current.playRemoteSound(message.event);
            console.log('✅ Played remote sound:', message.event.type);
          } catch (error) {
            console.error('❌ Error playing remote sound:', error);
          }
        } else {
          console.warn('⚠️ RemoteSoundPlayer ref is null - cannot play remote sound');
        }
      } else {
        // Handle other messages (join, instrument-change, etc.)
        handlePeerMessage(peerId, message);
      }
    });

    // Setup peer connected handler
    peerManagerRef.current.onPeerConnected((peerId, instrument) => {
      setPeers((prev) => {
        const newPeers = new Map(prev);
        newPeers.set(peerId, {
          id: peerId,
          instrument: instrument as Instrument,
          connected: true,
        });
        return newPeers;
      });
      setConnectionStatus(`Connected to ${peerId.substring(0, 8)}...`);
    });

    // Setup peer disconnected handler
    peerManagerRef.current.onPeerDisconnected((peerId) => {
      setPeers((prev) => {
        const newPeers = new Map(prev);
        newPeers.delete(peerId);
        return newPeers;
      });
    });

    return () => {
      if (peerManagerRef.current) {
        peerManagerRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Handle messages from peers
   */
  const handlePeerMessage = (peerId: string, message: PeerMessage) => {
    switch (message.type) {
      case 'join':
        console.log('🎵 Peer joined:', peerId, 'with instrument:', message.instrument);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          newPeers.set(peerId, {
            id: peerId,
            instrument: message.instrument,
            connected: true,
          });
          return newPeers;
        });
        break;
      case 'instrument-change':
        console.log('🎵 Peer changed instrument:', peerId, 'to', message.instrument);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const peer = newPeers.get(peerId);
          if (peer) {
            peer.instrument = message.instrument;
            newPeers.set(peerId, peer);
          }
          return newPeers;
        });
        break;
      case 'hand-data':
        // Hand data is handled by RemoteSoundPlayer for sound playback
        // Could also be used for visualization in the future
        break;
      
      case 'sound-event':
        // Sound events are handled by RemoteSoundPlayer
        // This message type is now used for remote sound playback
        break;
    }
  };

  /**
   * Create a new room (host)
   */
  const createRoom = async () => {
    const newRoomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setRoomId(newRoomId);
    setIsHost(true);
    await connectToRoom(newRoomId);
  };

  /**
   * Join an existing room
   */
  const joinRoom = async () => {
    const room = inputRef.current?.value.trim();
    if (!room) {
      alert('Please enter a room ID');
      return;
    }
    setRoomId(room);
    setIsHost(false);
    await connectToRoom(room);
  };

  /**
   * Connect to a room
   */
  const connectToRoom = async (room: string) => {
    if (!peerManagerRef.current) return;

    try {
      setConnectionStatus('Connecting...');
      const myId = await peerManagerRef.current.initialize(myInstrument as Instrument, room);
      setIsConnected(true);
      setConnectionStatus(`Connected as ${myId?.substring(0, 8) || 'unknown'}...`);
      
      // If not host, try to connect to host (room ID format: room-{timestamp}-{random})
      // In a real implementation, you'd use a signaling server to discover peers
      // For this demo, we'll use a simple approach where peers connect to each other
      console.log('💡 For full P2P, peers need to share their IDs');
      console.log('💡 Your ID:', myId);
      console.log('💡 Share this ID with others to connect');
      
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      setConnectionStatus('Connection failed');
      alert('Failed to connect. Please try again. Make sure you are using a secure connection (HTTPS) or localhost.');
    }
  };

  // Removed connectToPeer function - now handled inline in the button

  /**
   * Handle instrument change
   */
  const handleInstrumentChange = (instrument: InstrumentType) => {
    setMyInstrument(instrument);
    if (peerManagerRef.current) {
      peerManagerRef.current.changeInstrument(instrument as Instrument);
    }
  };

  /**
   * Disconnect from room
   */
  const disconnect = () => {
    if (peerManagerRef.current) {
      peerManagerRef.current.disconnect();
    }
    setIsConnected(false);
    setRoomId("");
    setIsHost(false);
    setPeers(new Map());
    setConnectionStatus("Disconnected");
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="w-full max-w-2xl space-y-4">
        {/* Connection Panel */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-card-foreground mb-4">🎵 Jam Session</h2>
          
          {!isConnected ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={createRoom}
                  className="flex-1 h-12 items-center justify-center rounded-full bg-primary px-6 text-primary-foreground transition-colors hover:bg-primary/90 font-medium"
                >
                  Create Room
                </button>
                <button
                  onClick={joinRoom}
                  className="flex-1 h-12 items-center justify-center rounded-full bg-secondary px-6 text-secondary-foreground transition-colors hover:bg-secondary/90 font-medium"
                >
                  Join Room
                </button>
              </div>
              
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter room ID to join..."
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Room ID:</p>
                  <p className="font-mono text-lg font-bold">{roomId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status:</p>
                  <p className="text-sm font-semibold text-green-600">{connectionStatus}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="peer-id-input"
                    placeholder="Enter peer's Peer ID to connect..."
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById('peer-id-input') as HTMLInputElement;
                      const peerId = input?.value.trim();
                      if (peerId && peerManagerRef.current) {
                        console.log('🔗 Connecting to peer:', peerId);
                        try {
                          await peerManagerRef.current.connectToPeer(peerId);
                          input.value = '';
                          alert('Connection request sent! Waiting for peer to accept...');
                        } catch (error) {
                          console.error('❌ Failed to connect:', error);
                          alert('Failed to connect. Make sure the Peer ID is correct and the peer is online.');
                        }
                      } else {
                        alert('Please enter a Peer ID');
                      }
                    }}
                    className="h-10 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground transition-colors hover:bg-primary/90 text-sm font-medium"
                  >
                    Connect to Peer
                  </button>
                </div>
                <button
                  onClick={disconnect}
                  className="w-full h-10 items-center justify-center rounded-md bg-destructive px-4 text-destructive-foreground transition-colors hover:bg-destructive/90 text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>

              {/* My Peer ID */}
              {peerManagerRef.current && peerManagerRef.current.getMyId() && (
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground mb-2">Your Peer ID (share with others):</p>
                  <p className="font-mono text-sm break-all">{peerManagerRef.current.getMyId()}</p>
                  <button
                    onClick={() => {
                      const id = peerManagerRef.current?.getMyId();
                      if (id) {
                        navigator.clipboard.writeText(id);
                        alert('Peer ID copied to clipboard!');
                      }
                    }}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              )}

              {/* Connected Peers */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Connected Peers ({peers.size}):</p>
                {peers.size === 0 ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ No peers connected yet. Share your Peer ID above and have others connect to you, or connect to their Peer ID.
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      💡 <strong>Important:</strong> For sounds to work, you need to connect to each other. Both people should connect using each other's Peer IDs.
                    </p>
                  </div>
                ) : (
                  Array.from(peers.values()).map((peer) => (
                    <div key={peer.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <div>
                        <p className="font-mono text-sm font-bold text-green-800 dark:text-green-200">{peer.id.substring(0, 16)}...</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Playing: {peer.instrument}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instrument Selector */}
        {isConnected && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Select Your Instrument</h3>
            <InstrumentSelector
              selectedInstrument={myInstrument}
              onInstrumentChange={handleInstrumentChange}
            />
          </div>
        )}

        {/* Remote Sound Player - handles playing sounds from other peers */}
        {/* Always render when connected so ref is available */}
        {isConnected && <RemoteSoundPlayer ref={remoteSoundPlayerRef} />}

        {/* Instrument Player */}
        {isConnected && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {myInstrument === 'drums' && <AirDrumsPlayer peerManager={peerManagerRef.current} />}
            {myInstrument === 'piano' && <PianoPlayer peerManager={peerManagerRef.current} />}
            {myInstrument === 'tambourine' && <TambourinePlayer peerManager={peerManagerRef.current} />}
            {myInstrument === 'triangle' && <TrianglePlayer peerManager={peerManagerRef.current} />}
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-xl border border-border bg-blue-50 dark:bg-blue-900 p-6">
          <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">🎵 How Jam Session Works:</p>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p><strong>What You'll Hear:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>✅ <strong>Your own sounds</strong> - Play locally on your computer</li>
              <li>✅ <strong>Other players' sounds</strong> - When connected, you'll hear their instrument sounds on your computer</li>
              <li>❌ <strong>Video/Cameras</strong> - Not currently streamed (you only see your own camera)</li>
            </ul>
            <p className="mt-3"><strong>How to Connect:</strong></p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>One person clicks "Create Room"</li>
              <li>Share your Peer ID with others (copy button)</li>
              <li>Others click "Join Room" and enter the room ID</li>
              <li>Others click "Connect to Peer" and enter your Peer ID</li>
              <li>Select your instruments and start playing!</li>
            </ol>
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              💡 <strong>Note:</strong> Each player hears all sounds. When someone plays drums, everyone hears the drums. 
              This creates a shared musical experience where everyone plays together!
            </p>
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
              <p className="text-xs font-bold text-red-800 dark:text-red-200 mb-1">⚠️ IMPORTANT: Connection Steps</p>
              <ol className="text-xs text-red-700 dark:text-red-300 list-decimal list-inside space-y-1">
                <li>Person A: Create room and copy your Peer ID</li>
                <li>Person B: Join room with the room ID</li>
                <li>Person B: Paste Person A's Peer ID and click "Connect to Peer"</li>
                <li>Person A: Copy Person B's Peer ID and connect to them too</li>
                <li>Both: You should see each other in "Connected Peers" (green box)</li>
                <li>Now play! Sounds will be heard by everyone connected.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

