import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface SatireNoticeModalProps {
  onContinue: () => void;
}

export function SatireNoticeModal({ onContinue }: SatireNoticeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="satire-notice-title"
      className="safe-pad-modal fixed inset-0 z-40 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-[#090706]/88"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d] shadow-[8px_8px_0_#dc2626]">
        {/* Top Broadcast Ribbon */}
        <div className="flex items-center justify-between bg-[#dc2626] px-5 py-2.5">
          <div className="flex items-center gap-2 font-display text-xl font-extrabold tracking-wider text-white">
            <ShieldAlert className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <h1 id="satire-notice-title">SATIRE NOTICE · व्यंग्य सूचना</h1>
          </div>
          <span className="font-mono-num text-[11px] font-bold tracking-wider text-[#fef08a]">
            CH-999
          </span>
        </div>

        {/* Clean Concise English + Hindi Parody Disclaimer */}
        <div className="modal-compact-body flex flex-col space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-[#f5f5f4]">
            <strong className="text-[#facc15]">English:</strong>{' '}
            <strong>DESI DANGAL</strong> is a 100% fictional work of Indian pop-culture parody and light-hearted satire. All fighters, dialogues, and breaking-news headlines are purely comedic.
          </p>

          <p className="border-t border-white/15 pt-3 text-sm leading-relaxed text-[#fde68a]">
            <strong className="text-[#facc15]">हिन्दी:</strong> यह गेम केवल हास्य, व्यंग्य और मनोरंजन के लिए बनाया गया है। किसी भी व्यक्ति, नेता या समुदाय की भावनाओं को ठेस पहुँचाने का कोई उद्देश्य नहीं है — बस दिल खोलकर <strong className="text-white">DHISHUM-DHISHUM</strong> का आनंद लें!
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#a8a29e]">
              No real laddoos or eggs were harmed.
            </span>
            <button
              type="button"
              onClick={onContinue}
              className="cursor-pointer whitespace-nowrap shrink-0 border-2 border-[#0f0a06] bg-[#facc15] px-6 py-2.5 font-display text-xl font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[4px_4px_0_#dc2626] transition-transform hover:-translate-y-0.5 hover:bg-[#fde047] active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              I UNDERSTAND · CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
