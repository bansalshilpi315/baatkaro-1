import { useEffect } from 'react';
import { Gamepad2, Info, Sparkles, X } from 'lucide-react';
import { FIGHTER_LIST } from '../game/characters';

interface ModalProps {
  onClose: () => void;
}

export function HowToPlayModal({ onClose }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      className="safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black/82"
    >
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d] shadow-[8px_8px_0_#dc2626]">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#dc2626] px-5 py-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <h2
              id="how-to-play-title"
              className="font-display text-2xl font-extrabold uppercase italic tracking-wider text-white"
            >
              HOW TO PLAY · CONTROLS
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Play"
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-2 border-white/50 bg-[#0f0a06] text-white hover:border-[#facc15] hover:text-[#facc15]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm text-[#e7e5e4]">
          {/* Keyboard & Touch Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border border-white/15 bg-[#1d1713] p-3.5">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[#facc15]">
                PC Keyboard Controls
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Move Left / Right</span>
                  <span className="font-mono-num font-bold text-white">A / D or ← / →</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Jump / Crouch</span>
                  <span className="font-mono-num font-bold text-white">W / S or ↑ / ↓</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Block Attack</span>
                  <span className="font-mono-num font-bold text-white">Hold Back</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Punch / Kick / Grab</span>
                  <span className="font-mono-num font-bold text-[#facc15]">J / K / I</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Signature Move</span>
                  <span className="font-mono-num font-bold text-[#fde047]">E / B</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Super Power (100%)</span>
                  <span className="font-mono-num font-bold text-[#fb923c]">L</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Pause Match</span>
                  <span className="font-mono-num font-bold text-white">ESC / P</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#d6d3d1]">Mute All Audio</span>
                  <span className="font-mono-num font-bold text-white">M</span>
                </li>
              </ul>
            </div>

            <div className="border border-white/15 bg-[#1d1713] p-3.5">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[#facc15]">
                Mobile &amp; Touch Controls
              </h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#d6d3d1]">
                <li>
                  <strong className="text-white">Left Virtual Stick:</strong> Slide left/right to walk, pull back away from your opponent to block, push up to jump, or down to crouch.
                </li>
                <li>
                  <strong className="text-white">Right Arcade Buttons:</strong> Tap the circular <strong className="text-[#facc15]">PUNCH</strong>, <strong className="text-[#38bdf8]">KICK</strong>, <strong className="text-[#34d399]">GRAB</strong>, and <strong className="text-[#fb923c]">SUPER</strong> buttons.
                </li>
                <li>
                  <strong className="text-white">Signature Move Ring:</strong> Tap the glowing character signature button whenever its radial cooldown ring fills up.
                </li>
              </ul>
            </div>
          </div>

          {/* Character Signature Moves Reference */}
          <div className="border border-white/15 bg-[#1d1713] p-3.5">
            <h3 className="flex items-center gap-1.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#facc15]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Unique Signature Moves (Keys: E / B)</span>
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FIGHTER_LIST.map((f) => (
                <div key={f.id} className="border border-white/10 bg-[#14100d] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-extrabold uppercase text-white">
                      {f.name}
                    </span>
                    <span className="font-mono-num text-[11px] font-bold text-[#fde047]">
                      {f.special.name} ({f.special.cooldown.toFixed(1)}s)
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#a8a29e]">
                    {f.special.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border-2 border-[#0f0a06] bg-[#facc15] px-6 py-2 font-display text-lg font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[3px_3px_0_#dc2626] hover:bg-[#fde047]"
            >
              GOT IT · BACK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AboutModal({ onClose }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-game-title"
      className="safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black/82"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d] shadow-[8px_8px_0_#dc2626]">
        <div className="flex items-center justify-between bg-[#dc2626] px-5 py-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <h2
              id="about-game-title"
              className="font-display text-2xl font-extrabold uppercase italic tracking-wider text-white"
            >
              ABOUT DESI DANGAL
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close About"
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-2 border-white/50 bg-[#0f0a06] text-white hover:border-[#facc15] hover:text-[#facc15]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 p-5 text-sm leading-relaxed text-[#e7e5e4]">
          <p>
            <strong className="text-[#facc15]">DESI DANGAL: The Great Multiverse Fight</strong> is a 2.5D Indian satire arcade fighter celebrating over-the-top prime-time TV news drama, iconic desi archetypes, and fast 60 FPS arcade action.
          </p>
          <p className="text-xs text-[#d6d3d1]">
            Built with articulated 3D fighters, custom 3D head models, living Desi stages with cheering spectators, signature voice lines with English subtitles, and synthesized Web Audio dhol-funk music — 100% self-contained with zero external CDNs.
          </p>
          <div className="border-t border-white/15 pt-3 text-xs text-[#fde68a]">
            <strong>Full Arcade Edition:</strong> 7 Playable Fighters · 6 Living 3D Stages · 5-Stage Progressive CPU AI · 2-Player Online Friend Room · Super Power Test Lab.
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border-2 border-[#0f0a06] bg-[#facc15] px-6 py-2 font-display text-lg font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[3px_3px_0_#dc2626] hover:bg-[#fde047]"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
