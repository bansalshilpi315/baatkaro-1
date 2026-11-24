import { LogOut, Monitor, Music, Play, Volume2, VolumeX } from 'lucide-react';
import type { GraphicsQuality } from '../game/types';

interface PauseModalProps {
  muted: boolean;
  musicMuted: boolean;
  graphics: GraphicsQuality;
  onResume: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleGraphics: () => void;
  onQuitToSelect: () => void;
}

export function PauseModal({
  muted,
  musicMuted,
  graphics,
  onResume,
  onToggleMute,
  onToggleMusic,
  onToggleGraphics,
  onQuitToSelect,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      className="safe-pad-modal fixed inset-0 z-40 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-[#090706]/82"
    >
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d]/95 shadow-[8px_8px_0_#dc2626]">
        {/* Header */}
        <div className="bg-[#dc2626] px-5 py-2.5 text-center sm:py-3">
          <h2
            id="pause-title"
            className="font-display text-2xl font-extrabold uppercase italic tracking-wider text-white sm:text-3xl"
          >
            CHAI BREAK ☕
          </h2>
          <p className="mt-0.5 text-xs font-semibold italic text-[#fef08a]">
            Arena adjourned till further notice.
          </p>
        </div>

        {/* Actions */}
        <div className="modal-compact-body flex flex-col space-y-2.5 p-5">
          <button
            type="button"
            onClick={onResume}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#0f0a06] bg-[#facc15] py-2.5 font-display text-xl font-extrabold uppercase tracking-wider text-[#110b08] shadow-[4px_4px_0_#dc2626] hover:bg-[#fde047]"
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            <span>RESUME</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex w-full cursor-pointer items-center justify-between border-2 border-white/20 bg-[#201a16] px-4 py-2 text-sm font-bold text-white hover:border-[#facc15]"
          >
            <span className="flex items-center gap-2">
              {muted ? (
                <VolumeX className="h-4 w-4 text-[#fb7185]" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#4ade80]" aria-hidden="true" />
              )}
              <span>SOUND</span>
            </span>
            <span className="font-mono-num text-xs font-extrabold uppercase text-[#facc15]">
              {muted ? 'OFF' : 'ON'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            className="flex w-full cursor-pointer items-center justify-between border-2 border-white/20 bg-[#201a16] px-4 py-2 text-sm font-bold text-white hover:border-[#facc15]"
          >
            <span className="flex items-center gap-2">
              <Music
                className={`h-4 w-4 ${musicMuted ? 'text-[#fb7185]' : 'text-[#4ade80]'}`}
                aria-hidden="true"
              />
              <span>MUSIC</span>
            </span>
            <span className="font-mono-num text-xs font-extrabold uppercase text-[#facc15]">
              {musicMuted ? 'OFF' : 'ON'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleGraphics}
            className="flex w-full cursor-pointer items-center justify-between border-2 border-white/20 bg-[#201a16] px-4 py-2 text-sm font-bold text-white hover:border-[#facc15]"
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
              <span>GRAPHICS</span>
            </span>
            <span className="font-mono-num text-xs font-extrabold uppercase text-[#facc15]">
              {graphics === 'high' ? 'HIGH' : 'LOW'}
            </span>
          </button>

          <button
            type="button"
            onClick={onQuitToSelect}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#ef4444] bg-[#2a1215] py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#fda4af] hover:bg-[#dc2626] hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>QUIT TO SELECT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
