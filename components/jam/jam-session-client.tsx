"use client";

import { useEffect, useRef, useState } from "react";
import { PeerManager, Instrument, PeerMessage } from "@/app/lib/webrtc/peer-manager";
import { Instrument as InstrumentType } from "@/components/practice/instruments/instrument-types";
import InstrumentSelector from "@/components/practice/instrument-selector";
import AirDrumsPlayer from "@/components/practice/instruments/air-drums-player";
import PianoPlayer from "@/components/practice/instruments/piano-player";
import TambourinePlayer from "@/components/practice/instruments/tambourine-player";
import TrianglePlayer from "@/components/practice/instruments/triangle-player";

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

  // Initialize peer manager
  useEffect(() => {
    peerManagerRef.current = new PeerManager();
    
    // Setup message handler
    peerManagerRef.current.onMessage((peerId, message) => {
      handlePeerMessage(peerId, message);
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
        // In a full implementation, we would visualize other players' hands
        // For now, we just log it
        console.log('👋 Hand data from peer:', peerId);
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

  /**
   * Connect to a specific peer by ID
   */
  const connectToPeer = async () => {
    const peerId = prompt('Enter peer ID to connect:');
    if (peerId && peerManagerRef.current) {
      await peerManagerRef.current.connectToPeer(peerId);
    }
  };

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
              
              <div className="flex gap-2">
                <button
                  onClick={connectToPeer}
                  className="flex-1 h-10 items-center justify-center rounded-md bg-secondary px-4 text-secondary-foreground transition-colors hover:bg-secondary/90 text-sm font-medium"
                >
                  Connect to Peer
                </button>
                <button
                  onClick={disconnect}
                  className="flex-1 h-10 items-center justify-center rounded-md bg-destructive px-4 text-destructive-foreground transition-colors hover:bg-destructive/90 text-sm font-medium"
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
              {peers.size > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Connected Peers ({peers.size}):</p>
                  {Array.from(peers.values()).map((peer) => (
                    <div key={peer.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div>
                        <p className="font-mono text-sm">{peer.id.substring(0, 16)}...</p>
                        <p className="text-xs text-muted-foreground">Playing: {peer.instrument}</p>
                      </div>
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
              )}
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

        {/* Instrument Player */}
        {isConnected && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {myInstrument === 'drums' && <AirDrumsPlayer />}
            {myInstrument === 'piano' && <PianoPlayer />}
            {myInstrument === 'tambourine' && <TambourinePlayer />}
            {myInstrument === 'triangle' && <TrianglePlayer />}
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-xl border border-border bg-blue-50 dark:bg-blue-900 p-6">
          <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">How to Use:</p>
          <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
            <li>Create a room or join an existing one</li>
            <li>Share your Peer ID with others (they need to connect to you)</li>
            <li>Select your instrument</li>
            <li>Start playing! Each person can play a different instrument</li>
            <li>For best results, use the "Connect to Peer" button with each other's Peer IDs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

