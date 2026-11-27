import { Coins, Music, Settings, User, Volume2, VolumeX, X, Zap } from 'lucide-react';
import type { PlayerProfile } from '../game/playerAccount';

interface SettingsModalProps {
  profile: PlayerProfile;
  muted: boolean;
  musicMuted: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onStartSuperPreview: () => void;
  onOpenAccount: () => void;
  onClose: () => void;
}

export function SettingsModal({
  profile,
  muted,
  musicMuted,
  onToggleMute,
  onToggleMusic,
  onStartSuperPreview,
  onOpenAccount,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
      className="safe-pad-modal fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-3 backdrop-blur-sm select-none"
    >
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto touch-pan-y border-2 border-[#facc15] bg-[#120d0a]/95 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.85),6px_6px_0_#0a0705] sm:p-5">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between border-b border-white/15 pb-2.5">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <h2
              id="settings-modal-title"
              className="font-display text-xl font-extrabold uppercase italic tracking-wider text-[#facc15] sm:text-2xl"
            >
              ARCADE SETTINGS
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="flex h-8 w-8 cursor-pointer items-center justify-center border border-white/25 bg-[#1f1915] text-white/90 transition-colors hover:border-[#facc15] hover:bg-[#dc2626] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Player Account & Login Card (shifted into Settings) */}
        <div className="mb-3.5 flex items-center justify-between gap-3 border border-[#facc15]/40 bg-[#1a1410] px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#a8a29e]">
              <User className="h-3 w-3 text-[#facc15]" aria-hidden="true" />
              <span>PLAYER ACCOUNT</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                data-testid="settings-profile-name"
                className="truncate font-display text-lg font-extrabold uppercase tracking-wide text-white"
              >
                {profile.displayName}
              </span>
              <span className="flex items-center gap-1 font-mono-num text-xs font-extrabold text-[#facc15]">
                <Coins className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{profile.coins.toLocaleString()}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="settings-account-btn"
            onClick={onOpenAccount}
            className="cursor-pointer whitespace-nowrap shrink-0 border-2 border-[#0f0a06] bg-[#dc2626] px-3.5 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-white shadow-[3px_3px_0_#facc15] transition hover:bg-[#ef4444]"
          >
            {profile.mode === 'guest' ? 'SIGN IN / UP' : 'ACCOUNT'}
          </button>
        </div>

        {/* Primary Glowing Gold Action: TEST SUPERS BEFORE FIGHTING */}
        <div className="mb-3.5">
          <button
            type="button"
            data-testid="test-supers-btn"
            onClick={onStartSuperPreview}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#fef08a] bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#d97706] px-4 py-3 font-display text-lg font-extrabold uppercase italic tracking-wider text-[#1a0f04] shadow-[0_0_24px_rgba(250,204,21,0.45),4px_4px_0_#0f0a06] transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5 sm:text-xl"
          >
            <Zap className="h-5 w-5 fill-[#1a0f04] stroke-[#1a0f04]" aria-hidden="true" />
            <span>TEST SUPERS BEFORE FIGHTING</span>
          </button>
          <p className="mt-1.5 text-center text-[11px] font-medium text-[#d6d3d1]">
            Preview all 7 fighters&apos; full 3D Super Power cinematics &amp; custom audio live on stage.
          </p>
        </div>

        {/* Quick Audio Toggles */}
        <div className="grid grid-cols-2 gap-2 border-t border-white/15 pt-3">
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={!muted}
            className={`flex cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-2 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:text-sm ${
              muted
                ? 'border-white/20 bg-[#1c1917] text-[#a8a29e] hover:border-white/50'
                : 'border-[#22c55e] bg-[#14532d]/55 text-[#bbf7d0] hover:bg-[#166534]/75'
            }`}
          >
            {muted ? (
              <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>SFX: {muted ? 'OFF' : 'ON'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            aria-pressed={!musicMuted}
            className={`flex cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-2 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:text-sm ${
              musicMuted
                ? 'border-white/20 bg-[#1c1917] text-[#a8a29e] hover:border-white/50'
                : 'border-[#38bdf8] bg-[#0c4a6e]/55 text-[#bae6fd] hover:bg-[#075985]/75'
            }`}
          >
            <Music className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>BGM: {musicMuted ? 'OFF' : 'ON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
