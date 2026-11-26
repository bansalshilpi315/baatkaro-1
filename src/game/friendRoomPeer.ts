import Peer, { type DataConnection } from 'peerjs';
import {
  generateRoomCode,
  isFriendRoomPacket,
  isValidRoomCode,
  PEER_ICE_SERVERS,
  roomCodeToPeerId,
  sanitizeRoomCode,
  type FriendRoomPacket,
  type FriendRoomStatus,
  type OnlineRole,
} from './friendRoomProtocol';

export interface FriendRoomStateSnapshot {
  role: OnlineRole;
  status: FriendRoomStatus;
  roomCode: string;
  statusMessage: string;
  errorMessage: string | null;
}

export interface FriendRoomCallbacks {
  onStateChange: (snapshot: FriendRoomStateSnapshot) => void;
  onPacket: (packet: FriendRoomPacket) => void;
  onPeerConnected: (role: 'host' | 'guest', roomCode: string) => void;
  onPeerDisconnected: (reason: string) => void;
}

const JOIN_TIMEOUT_MS = 10000;
const HOST_OPEN_TIMEOUT_MS = 10000;

/**
 * Lightweight zero-backend PeerJS (WebRTC DataChannel) manager for 2-Player Online Friend Rooms.
 * Uses Google public STUN servers and `desishowdown-room-XXXX` prefixed 4-digit room codes.
 */
export class FriendRoomManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private callbacks: FriendRoomCallbacks;
  private connectTimer: number | null = null;
  private sessionSeq = 0;
  private intentionalClose = false;

  private state: FriendRoomStateSnapshot = {
    role: 'offline',
    status: 'idle',
    roomCode: '',
    statusMessage: '',
    errorMessage: null,
  };

  constructor(callbacks: FriendRoomCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): FriendRoomStateSnapshot {
    return { ...this.state };
  }

  private emitState(patch: Partial<FriendRoomStateSnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.callbacks.onStateChange({ ...this.state });
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private teardownPeer(): void {
    this.clearConnectTimer();
    const oldConn = this.conn;
    const oldPeer = this.peer;
    this.conn = null;
    this.peer = null;
    try {
      oldConn?.close();
    } catch {
      // Ignore close errors on already-closed channels
    }
    try {
      oldPeer?.destroy();
    } catch {
      // Ignore destroy errors
    }
  }

  /**
   * Host creates a 4-digit Friend Room (`desishowdown-room-XXXX`) and waits for Guest.
   */
  public createRoom(retryCount = 0): void {
    this.intentionalClose = false;
    this.teardownPeer();
    const mySeq = ++this.sessionSeq;
    const code = generateRoomCode();
    const peerId = roomCodeToPeerId(code);

    this.emitState({
      role: 'host',
      status: 'creating',
      roomCode: code,
      statusMessage: 'Opening room...',
      errorMessage: null,
    });

    let peer: Peer;
    try {
      peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: PEER_ICE_SERVERS,
        },
      });
    } catch {
      this.emitState({
        role: 'offline',
        status: 'error',
        statusMessage: '',
        errorMessage: 'Unable to initialize WebRTC peer. Please retry.',
      });
      return;
    }

    this.peer = peer;
    this.connectTimer = window.setTimeout(() => {
      if (this.sessionSeq !== mySeq || this.state.status !== 'creating') return;
      this.teardownPeer();
      this.emitState({
        role: 'offline',
        status: 'error',
        statusMessage: '',
        errorMessage: 'Room server took too long to respond — Retry.',
      });
    }, HOST_OPEN_TIMEOUT_MS);

    peer.on('open', () => {
      if (this.sessionSeq !== mySeq) return;
      this.clearConnectTimer();
      this.emitState({
        role: 'host',
        status: 'waiting',
        roomCode: code,
        statusMessage: 'Waiting for friend to join...',
        errorMessage: null,
      });
    });

    peer.on('connection', (incoming) => {
      if (this.sessionSeq !== mySeq) {
        try {
          incoming.close();
        } catch {
          // ignore
        }
        return;
      }
      // Single opponent per room: reject extra connections once connected
      if (this.conn && this.conn.open) {
        try {
          incoming.close();
        } catch {
          // ignore
        }
        return;
      }
      this.bindDataConnection(incoming, 'host', code, mySeq);
    });

    peer.on('error', (err) => {
      if (this.sessionSeq !== mySeq || this.intentionalClose) return;
      const errType = (err as { type?: string })?.type ?? '';
      // If randomly generated 4-digit code collided on public PeerJS broker, regenerate once
      if (errType === 'unavailable-id' && retryCount < 3) {
        this.createRoom(retryCount + 1);
        return;
      }
      this.clearConnectTimer();
      const wasConnected = this.state.status === 'connected';
      this.teardownPeer();
      if (wasConnected) {
        this.emitState({
          role: 'offline',
          status: 'disconnected',
          statusMessage: 'Friend Disconnected',
          errorMessage: 'Connection lost.',
        });
        this.callbacks.onPeerDisconnected('Connection lost.');
      } else {
        this.emitState({
          role: 'offline',
          status: 'error',
          statusMessage: '',
          errorMessage: 'Could not open room — check internet & Retry.',
        });
      }
    });
  }

  /**
   * Guest joins an existing 4-digit Friend Room hosted by a friend.
   */
  public joinRoom(rawCode: string): void {
    const code = sanitizeRoomCode(rawCode);
    if (!isValidRoomCode(code)) {
      this.emitState({
        role: 'offline',
        status: 'error',
        roomCode: code,
        statusMessage: '',
        errorMessage: 'Enter a valid 4-digit room code.',
      });
      return;
    }

    this.intentionalClose = false;
    this.teardownPeer();
    const mySeq = ++this.sessionSeq;
    const hostPeerId = roomCodeToPeerId(code);

    this.emitState({
      role: 'guest',
      status: 'connecting',
      roomCode: code,
      statusMessage: 'Connecting...',
      errorMessage: null,
    });

    let peer: Peer;
    try {
      peer = new Peer({
        debug: 0,
        config: {
          iceServers: PEER_ICE_SERVERS,
        },
      });
    } catch {
      this.emitState({
        role: 'offline',
        status: 'error',
        statusMessage: '',
        errorMessage: 'Room not found / Connection failed — Retry',
      });
      return;
    }

    this.peer = peer;
    this.connectTimer = window.setTimeout(() => {
      if (this.sessionSeq !== mySeq || this.state.status === 'connected') return;
      this.teardownPeer();
      this.emitState({
        role: 'offline',
        status: 'error',
        roomCode: code,
        statusMessage: '',
        errorMessage: 'Room not found / Connection failed — Retry',
      });
    }, JOIN_TIMEOUT_MS);

    peer.on('open', () => {
      if (this.sessionSeq !== mySeq) return;
      try {
        const conn = peer.connect(hostPeerId, { reliable: true });
        this.bindDataConnection(conn, 'guest', code, mySeq);
      } catch {
        this.clearConnectTimer();
        this.teardownPeer();
        this.emitState({
          role: 'offline',
          status: 'error',
          roomCode: code,
          statusMessage: '',
          errorMessage: 'Room not found / Connection failed — Retry',
        });
      }
    });

    peer.on('error', () => {
      if (this.sessionSeq !== mySeq || this.intentionalClose) return;
      this.clearConnectTimer();
      const wasConnected = this.state.status === 'connected';
      this.teardownPeer();
      if (wasConnected) {
        this.emitState({
          role: 'offline',
          status: 'disconnected',
          statusMessage: 'Friend Disconnected',
          errorMessage: 'Host disconnected.',
        });
        this.callbacks.onPeerDisconnected('Host disconnected.');
      } else {
        this.emitState({
          role: 'offline',
          status: 'error',
          roomCode: code,
          statusMessage: '',
          errorMessage: 'Room not found / Connection failed — Retry',
        });
      }
    });
  }

  private bindDataConnection(
    conn: DataConnection,
    role: 'host' | 'guest',
    code: string,
    mySeq: number,
  ): void {
    this.conn = conn;

    conn.on('open', () => {
      if (this.sessionSeq !== mySeq) return;
      this.clearConnectTimer();
      this.emitState({
        role,
        status: 'connected',
        roomCode: code,
        statusMessage: 'Connected!',
        errorMessage: null,
      });
      this.callbacks.onPeerConnected(role, code);
    });

    conn.on('data', (raw: unknown) => {
      if (this.sessionSeq !== mySeq) return;
      if (!isFriendRoomPacket(raw)) return;
      if (raw.type === 'LEAVE_ROOM') {
        this.teardownPeer();
        this.emitState({
          role: 'offline',
          status: 'disconnected',
          statusMessage: 'Friend Disconnected',
          errorMessage: 'Your friend left the room.',
        });
        this.callbacks.onPeerDisconnected('Your friend left the room.');
        return;
      }
      this.callbacks.onPacket(raw);
    });

    conn.on('close', () => {
      if (this.sessionSeq !== mySeq || this.intentionalClose) return;
      const wasConnected = this.state.status === 'connected';
      this.teardownPeer();
      if (wasConnected) {
        this.emitState({
          role: 'offline',
          status: 'disconnected',
          statusMessage: 'Friend Disconnected',
          errorMessage: 'Your friend disconnected.',
        });
        this.callbacks.onPeerDisconnected('Your friend disconnected.');
      }
    });

    conn.on('error', () => {
      if (this.sessionSeq !== mySeq || this.intentionalClose) return;
      const wasConnected = this.state.status === 'connected';
      this.teardownPeer();
      if (wasConnected) {
        this.emitState({
          role: 'offline',
          status: 'disconnected',
          statusMessage: 'Friend Disconnected',
          errorMessage: 'Connection interrupted.',
        });
        this.callbacks.onPeerDisconnected('Connection interrupted.');
      } else {
        this.emitState({
          role: 'offline',
          status: 'error',
          roomCode: code,
          statusMessage: '',
          errorMessage: 'Room not found / Connection failed — Retry',
        });
      }
    });
  }

  public send(packet: FriendRoomPacket): boolean {
    if (!this.conn || !this.conn.open) return false;
    try {
      this.conn.send(packet);
      return true;
    } catch {
      return false;
    }
  }

  public leaveRoom(): void {
    this.intentionalClose = true;
    this.sessionSeq++;
    if (this.conn && this.conn.open) {
      try {
        this.conn.send({ type: 'LEAVE_ROOM' } satisfies FriendRoomPacket);
      } catch {
        // ignore
      }
    }
    this.teardownPeer();
    this.emitState({
      role: 'offline',
      status: 'idle',
      roomCode: '',
      statusMessage: '',
      errorMessage: null,
    });
  }

  public dispose(): void {
    this.intentionalClose = true;
    this.sessionSeq++;
    this.teardownPeer();
  }
}
