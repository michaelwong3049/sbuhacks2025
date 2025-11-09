/**
 * WebRTC Peer-to-Peer Connection Manager
 * Handles peer connections for multiplayer jam sessions
 */

export type Instrument = 'drums' | 'piano' | 'tambourine' | 'triangle';

// Sound event types for different instruments
export type SoundEvent = 
  | { type: 'drums'; sound: 'snare' | 'kick' | 'hihat' | 'crash' }
  | { type: 'piano'; noteIndex: number; velocity?: number }
  | { type: 'tambourine'; }
  | { type: 'triangle'; };

export type PeerMessage = 
  | { type: 'sound-event'; event: SoundEvent; instrument: Instrument }
  | { type: 'hand-data'; data: any; instrument: Instrument }
  | { type: 'instrument-change'; instrument: Instrument }
  | { type: 'join'; instrument: Instrument }
  | { type: 'leave' }
  | { type: 'ping' };

export interface PeerInfo {
  id: string;
  instrument: Instrument;
  connected: boolean;
}

export class PeerManager {
  private peer: any = null;
  private connections: Map<string, any> = new Map();
  private onMessageCallback?: (peerId: string, message: PeerMessage) => void;
  private onPeerConnectedCallback?: (peerId: string, instrument: Instrument) => void;
  private onPeerDisconnectedCallback?: (peerId: string) => void;
  private myInstrument: Instrument = 'drums';
  private myId: string | null = null;
  private roomId: string | null = null;

  constructor() {
    // PeerJS will be loaded dynamically
  }

  /**
   * Initialize PeerJS and create peer connection
   */
  async initialize(instrument: Instrument, roomId: string): Promise<string> {
    this.myInstrument = instrument;
    this.roomId = roomId;

    try {
      // Dynamically import PeerJS (for Next.js SSR compatibility)
      let Peer: any;
      if (typeof window !== 'undefined') {
        const PeerModule = await import('peerjs');
        Peer = PeerModule.default || PeerModule;
      } else {
        throw new Error('PeerJS can only be initialized in browser');
      }
      
      // Create peer with room ID as part of the ID
      const peerId = `${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.peer = new Peer(peerId, {
        host: '0.peerjs.com', // Free PeerJS cloud server
        port: 443,
        path: '/',
        secure: true,
        debug: 2,
      });

      return new Promise((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Failed to create peer'));
          return;
        }

        this.peer.on('open', (id: string) => {
          console.log('🎵 Peer connected with ID:', id);
          this.myId = id;
          this.setupPeerHandlers();
          resolve(id);
        });

        this.peer.on('error', (error: any) => {
          console.error('❌ Peer error:', error);
          // If cloud server fails, try to use localhost (for development)
          if (error.type === 'server-error') {
            console.log('⚠️ Trying alternative connection method...');
            this.initializeFallback(instrument, roomId).then(resolve).catch(reject);
          } else {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to initialize PeerJS:', error);
      throw error;
    }
  }

  /**
   * Fallback initialization (for development without PeerJS server)
   */
  private async initializeFallback(instrument: Instrument, roomId: string): Promise<string> {
    // Generate a local ID
    const peerId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.myId = peerId;
    this.myInstrument = instrument;
    this.roomId = roomId;
    
    console.log('🔧 Using fallback mode (local connections only)');
    console.log('💡 For full P2P, set up a PeerJS server or use the cloud service');
    
    return peerId;
  }

  /**
   * Setup peer event handlers
   */
  private setupPeerHandlers() {
    if (!this.peer) return;

    // Handle incoming connections
    this.peer.on('connection', (conn: any) => {
      console.log('🔗 New peer connected:', conn.peer);
      this.setupConnection(conn);
    });

    // Handle disconnection
    this.peer.on('disconnected', () => {
      console.log('⚠️ Disconnected from PeerJS server, reconnecting...');
      if (!this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    // Handle close
    this.peer.on('close', () => {
      console.log('🔌 Peer connection closed');
    });
  }

  /**
   * Connect to another peer in the room
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (!this.peer || this.peer.destroyed) {
      throw new Error('Peer not initialized');
    }

    // Don't connect to ourselves
    if (peerId === this.myId) {
      return;
    }

    // Don't connect if already connected
    if (this.connections.has(peerId)) {
      return;
    }

    try {
      const conn = this.peer.connect(peerId, {
        reliable: true,
      });

      this.setupConnection(conn);
    } catch (error) {
      console.error('❌ Failed to connect to peer:', error);
    }
  }

  /**
   * Setup connection handlers
   */
  private setupConnection(conn: any) {
    conn.on('open', () => {
      console.log('✅ Connection opened with:', conn.peer);
      this.connections.set(conn.peer, conn);
      
      // Send join message with instrument
      this.sendToPeer(conn.peer, {
        type: 'join',
        instrument: this.myInstrument,
      });

      if (this.onPeerConnectedCallback) {
        this.onPeerConnectedCallback(conn.peer, this.myInstrument);
      }
    });

    conn.on('data', (data: PeerMessage) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(conn.peer, data);
      }
    });

    conn.on('close', () => {
      console.log('🔌 Connection closed with:', conn.peer);
      this.connections.delete(conn.peer);
      
      if (this.onPeerDisconnectedCallback) {
        this.onPeerDisconnectedCallback(conn.peer);
      }
    });

    conn.on('error', (error: any) => {
      console.error('❌ Connection error:', error);
    });
  }

  /**
   * Send message to a specific peer
   */
  sendToPeer(peerId: string, message: PeerMessage): void {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.warn('⚠️ Cannot send to peer (not connected):', peerId);
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  broadcast(message: PeerMessage): void {
    if (this.connections.size === 0) {
      console.warn('⚠️ No connected peers to broadcast to');
      return;
    }
    
    let sentCount = 0;
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        try {
          conn.send(message);
          sentCount++;
          console.log('✅ Sent message to peer:', peerId.substring(0, 8) + '...');
        } catch (error) {
          console.error('❌ Failed to send message to peer', peerId, ':', error);
        }
      } else {
        console.warn('⚠️ Connection to peer', peerId, 'is not open');
      }
    });
    console.log(`📡 Broadcasted to ${sentCount}/${this.connections.size} peers`);
  }

  /**
   * Set callbacks
   */
  onMessage(callback: (peerId: string, message: PeerMessage) => void) {
    this.onMessageCallback = callback;
  }

  onPeerConnected(callback: (peerId: string, instrument: Instrument) => void) {
    this.onPeerConnectedCallback = callback;
  }

  onPeerDisconnected(callback: (peerId: string) => void) {
    this.onPeerDisconnectedCallback = callback;
  }

  /**
   * Change instrument and notify peers
   */
  changeInstrument(instrument: Instrument) {
    this.myInstrument = instrument;
    this.broadcast({
      type: 'instrument-change',
      instrument,
    });
  }

  /**
   * Send hand tracking data to peers
   */
  sendHandData(handData: any) {
    this.broadcast({
      type: 'hand-data',
      data: handData,
      instrument: this.myInstrument,
    });
  }

  /**
   * Send sound event to peers (when you play a sound)
   */
  sendSoundEvent(event: SoundEvent) {
    const message = {
      type: 'sound-event' as const,
      event,
      instrument: this.myInstrument,
    };
    console.log('📡 Broadcasting sound event to', this.connections.size, 'peers:', message);
    this.broadcast(message);
  }

  /**
   * Get my peer ID
   */
  getMyId(): string | null {
    return this.myId;
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if connected to a peer
   */
  isConnected(peerId: string): boolean {
    return this.connections.has(peerId) && this.connections.get(peerId).open;
  }

  /**
   * Disconnect from all peers and cleanup
   */
  disconnect() {
    this.connections.forEach((conn) => {
      conn.close();
    });
    this.connections.clear();

    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }

    this.peer = null;
    this.myId = null;
  }
}

