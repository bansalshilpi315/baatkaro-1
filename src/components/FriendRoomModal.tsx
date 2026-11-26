import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  LogOut,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { FriendRoomStateSnapshot } from '../game/friendRoomPeer';
import { isValidRoomCode, sanitizeRoomCode } from '../game/friendRoomProtocol';

interface FriendRoomModalProps {
  roomState: FriendRoomStateSnapshot;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onClose: () => void;
}

type ModalTab = 'create' | 'join';

export function FriendRoomModal({
  roomState,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onClose,
}: FriendRoomModalProps) {
  const [tab, setTab] = useState<ModalTab>(
    roomState.role === 'guest' || roomState.status === 'connecting' ? 'join' : 'create',
  );
  const [joinCode, setJoinCode] = useState(
    roomState.role === 'guest' ? roomState.roomCode : '',
  );
  const [copied, setCopied] = useState(false);

  const isConnected = roomState.status === 'connected';
  const isCreatingOrWaiting =
    roomState.status === 'creating' || roomState.status === 'waiting';
  const isConnecting = roomState.status === 'connecting';

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Fallback copy via temporary input for older mobile browsers
      try {
        const el = document.createElement('input');
        el.value = code;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
      } catch {
        // Ignore clipboard failure
      }
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRoomCode(joinCode);
    setJoinCode(cleaned);
    onJoinRoom(cleaned);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-room-modal-title"
      data-testid="friend-room-modal"
      className="safe-pad-modal fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-4 py-3 backdrop-blur-sm select-none"
    >
      <div className="friend-room-card relative max-h-[94dvh] w-full max-w-md overflow-y-auto touch-pan-y border-2 border-[#facc15] bg-[#120d0a]/96 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.88),6px_6px_0_#0a0705] sm:p-5">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b border-white/15 pb-2 sm:mb-3 sm:pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#facc15] sm:h-5 sm:w-5" aria-hidden="true" />
            <h2
              id="friend-room-modal-title"
              className="font-display text-lg font-extrabold uppercase italic tracking-wider text-[#facc15] sm:text-2xl"
            >
              FRIEND ROOM · 2P ONLINE
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Friend Room"
            className="flex h-7 w-7 cursor-pointer items-center justify-center border border-white/25 bg-[#1f1915] text-white/90 transition-colors hover:border-[#facc15] hover:bg-[#dc2626] hover:text-white sm:h-8 sm:w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Connected Active Room View */}
        {isConnected ? (
          <div className="space-y-2.5 sm:space-y-3">
            <div className="border-2 border-[#22c55e] bg-[#14532d]/45 p-2.5 text-center sm:p-3.5">
              <div className="flex items-center justify-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-[#86efac]">
                <Wifi className="h-4 w-4" aria-hidden="true" />
                <span>CONNECTED · {roomState.role === 'host' ? 'HOST (1P)' : 'FRIEND (2P)'}</span>
              </div>
              <div
                data-testid="connected-room-code"
                className="mt-1 font-mono-num text-2xl font-extrabold tracking-[0.28em] text-white sm:text-3xl"
              >
                #{roomState.roomCode}
              </div>
              <p className="mt-1 text-xs text-[#dcfce7]">
                {roomState.role === 'host'
                  ? 'Pick your fighter & stage on Character Select, then tap FIGHT!'
                  : 'Pick your 2P fighter on the right panel while Host starts the fight.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopyCode(roomState.roomCode)}
                className="flex cursor-pointer items-center justify-center gap-1.5 border-2 border-[#facc15]/70 bg-[#1f1915] px-3 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#facc15] transition hover:bg-[#facc15] hover:text-[#110b08] sm:py-2"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex cursor-pointer items-center justify-center gap-1.5 border-2 border-[#facc15] bg-[#facc15] px-3 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#110b08] transition hover:bg-[#fde047] sm:py-2"
              >
                <span>BACK TO SELECT</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="leave-room-btn"
              onClick={onLeaveRoom}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-2 border-[#ef4444]/80 bg-[#2a1215] px-3 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#fda4af] transition hover:bg-[#dc2626] hover:text-white sm:py-2"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>LEAVE ROOM (RETURN TO VS CPU)</span>
            </button>
          </div>
        ) : (
          <>
            {/* Two Tabs: CREATE ROOM (Host = 1P) & JOIN ROOM (Guest = 2P) */}
            <div
              role="tablist"
              aria-label="Friend Room Mode"
              className="mb-2 grid grid-cols-2 gap-1.5 border border-white/15 bg-[#0c0806] p-1 sm:mb-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'create'}
                data-testid="tab-create-room"
                onClick={() => setTab('create')}
                className={`cursor-pointer px-3 py-1 font-display text-sm font-extrabold uppercase tracking-wider transition-colors sm:py-1.5 sm:text-base ${
                  tab === 'create'
                    ? 'bg-[#facc15] text-[#110b08]'
                    : 'bg-transparent text-[#d6d3d1] hover:text-white'
                }`}
              >
                CREATE ROOM (1P)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'join'}
                data-testid="tab-join-room"
                onClick={() => setTab('join')}
                className={`cursor-pointer px-3 py-1 font-display text-sm font-extrabold uppercase tracking-wider transition-colors sm:py-1.5 sm:text-base ${
                  tab === 'join'
                    ? 'bg-[#dc2626] text-white'
                    : 'bg-transparent text-[#d6d3d1] hover:text-white'
                }`}
              >
                JOIN ROOM (2P)
              </button>
            </div>

            {tab === 'create' ? (
              <div className="space-y-2 sm:space-y-3" role="tabpanel" aria-label="Create Room">
                {isCreatingOrWaiting && roomState.roomCode ? (
                  <>
                    <div className="border-2 border-[#facc15]/80 bg-[#1a130e] p-2.5 text-center sm:p-3">
                      <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#fde047]">
                        SHARE THIS 4-DIGIT ROOM CODE
                      </div>
                      <div
                        data-testid="host-room-code"
                        className="mt-0.5 select-text font-mono-num text-3xl font-extrabold tracking-[0.3em] text-white sm:mt-1 sm:text-5xl"
                      >
                        {roomState.roomCode}
                      </div>

                      <div className="mt-2 flex items-center justify-center gap-2 sm:mt-2.5">
                        <button
                          type="button"
                          data-testid="copy-room-code-btn"
                          onClick={() => void handleCopyCode(roomState.roomCode)}
                          className="flex cursor-pointer items-center gap-1.5 border-2 border-[#fef08a] bg-[#facc15] px-4 py-1 font-display text-sm font-extrabold uppercase tracking-wider text-[#110b08] shadow-[3px_3px_0_#0f0a06] transition hover:bg-[#fde047] sm:py-1.5"
                        >
                          {copied ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={onCreateRoom}
                          aria-label="Generate New Room Code"
                          className="flex cursor-pointer items-center gap-1 border border-white/25 bg-[#241c17] px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wider text-[#e7e5e4] transition hover:border-[#facc15] hover:text-[#facc15] sm:py-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>NEW</span>
                        </button>
                      </div>
                    </div>

                    <div
                      data-testid="host-room-status"
                      className="flex items-center justify-center gap-2 border border-[#facc15]/30 bg-black/45 px-3 py-1.5 text-xs font-bold text-[#fde68a] sm:py-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-[#facc15]" aria-hidden="true" />
                      <span>{roomState.statusMessage || 'Waiting for friend to join...'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="w-full cursor-pointer border border-white/25 bg-[#1c1714] py-1.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#d6d3d1] transition hover:border-[#ef4444] hover:text-[#fca5a5]"
                    >
                      CANCEL ROOM
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-center text-xs leading-relaxed text-[#d6d3d1]">
                      Host a live 2-Player match as <strong className="text-[#facc15]">Player 1</strong>. Share the 4-digit code with your friend on another phone or browser.
                    </p>

                    {roomState.errorMessage && (
                      <div
                        data-testid="friend-room-error"
                        className="flex items-center gap-2 border border-[#ef4444]/70 bg-[#450a0a]/70 px-3 py-2 text-xs font-semibold text-[#fecaca]"
                      >
                        <WifiOff className="h-4 w-4 shrink-0 text-[#f87171]" aria-hidden="true" />
                        <span>{roomState.errorMessage}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="create-room-submit-btn"
                      onClick={onCreateRoom}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#fef08a] bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#d97706] px-4 py-3 font-display text-xl font-extrabold uppercase italic tracking-wider text-[#1a0f04] shadow-[0_0_20px_rgba(250,204,21,0.35),4px_4px_0_#0f0a06] transition hover:brightness-110 active:translate-y-0.5"
                    >
                      <Wifi className="h-5 w-5" aria-hidden="true" />
                      <span>CREATE 4-DIGIT ROOM</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleJoinSubmit}
                className="space-y-3"
                role="tabpanel"
                aria-label="Join Room"
              >
                <p className="text-center text-xs leading-relaxed text-[#d6d3d1]">
                  Enter your friend&apos;s 4-digit room code to join as{' '}
                  <strong className="text-[#fb7185]">Player 2</strong>.
                </p>

                <div>
                  <label
                    htmlFor="join-room-code-input"
                    className="mb-1 block text-center font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#fde047]"
                  >
                    4-DIGIT ROOM CODE
                  </label>
                  <input
                    id="join-room-code-input"
                    data-testid="join-room-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="4821"
                    value={joinCode}
                    disabled={isConnecting}
                    onChange={(e) => setJoinCode(sanitizeRoomCode(e.target.value))}
                    className="w-full select-text border-2 border-[#facc15]/80 bg-[#0d0907] px-3 py-2.5 text-center font-mono-num text-3xl font-extrabold tracking-[0.35em] text-white placeholder:text-white/20 focus:border-[#fef08a] focus:outline-none disabled:opacity-60"
                  />
                </div>

                {isConnecting && (
                  <div
                    data-testid="join-room-status"
                    className="flex items-center justify-center gap-2 border border-[#facc15]/30 bg-black/45 px-3 py-2 text-xs font-bold text-[#fde68a]"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-[#facc15]" aria-hidden="true" />
                    <span>{roomState.statusMessage || 'Connecting...'}</span>
                  </div>
                )}

                {roomState.errorMessage && !isConnecting && (
                  <div
                    data-testid="friend-room-error"
                    className="flex items-center gap-2 border border-[#ef4444]/70 bg-[#450a0a]/70 px-3 py-2 text-xs font-semibold text-[#fecaca]"
                  >
                    <WifiOff className="h-4 w-4 shrink-0 text-[#f87171]" aria-hidden="true" />
                    <span>{roomState.errorMessage}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    data-testid="join-room-submit-btn"
                    disabled={isConnecting || !isValidRoomCode(joinCode)}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 border-2 border-[#0f0a06] bg-[#dc2626] px-4 py-2.5 font-display text-xl font-extrabold uppercase italic tracking-wider text-white shadow-[4px_4px_0_#facc15] transition hover:bg-[#ef4444] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span>{isConnecting ? 'CONNECTING...' : 'JOIN ROOM'}</span>
                  </button>

                  {isConnecting && (
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="cursor-pointer border border-white/30 bg-[#1f1915] px-3 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-[#e7e5e4] hover:border-[#ef4444]"
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
