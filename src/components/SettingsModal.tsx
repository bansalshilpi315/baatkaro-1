import { useEffect, useRef, useState } from 'react';
import {
  Bug,
  Check,
  Code2,
  Coins,
  Copy,
  Mail,
  Music,
  Send,
  Settings,
  User,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { FIGHTER_LIST } from '../game/characters';
import type { PlayerProfile } from '../game/playerAccount';
import {
  buildBugReportMailtoUrl,
  DEVELOPER_BUG_EMAIL,
  DEVELOPER_HOBBIES,
  DEVELOPER_NAME,
  DEVELOPER_ROLE_BADGE,
  DEVELOPER_VISION_NOTE,
} from '../utils/bugReport';
import { GameLogoBadge } from './GameLogoBadge';

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
  const [bugDescription, setBugDescription] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyEmail = async () => {
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(DEVELOPER_BUG_EMAIL);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const helper = document.createElement('textarea');
        helper.value = DEVELOPER_BUG_EMAIL;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setEmailCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setEmailCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    }
  };

  const handleSendBugReport = () => {
    const mailtoUrl = buildBugReportMailtoUrl(bugDescription, {
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
    });
    window.location.href = mailtoUrl;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
      className="safe-pad-modal fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-3 backdrop-blur-sm select-none"
    >
      <div
        data-testid="settings-modal-scroll"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto touch-pan-y border-2 border-[#facc15] bg-[#120d0a]/95 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.85),6px_6px_0_#0a0705] sm:p-5"
      >
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

        {/* Player Account & Login Card */}
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
            Preview all {FIGHTER_LIST.length} fighters&apos; full 3D Super Power cinematics &amp; custom audio live on stage.
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

        {/* REPORT A BUG Section */}
        <section
          aria-labelledby="settings-bug-report-heading"
          data-testid="settings-bug-report-section"
          className="mt-4 border border-white/15 bg-[#1a1410] p-3.5"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <Bug className="h-4 w-4 text-[#ef4444]" aria-hidden="true" />
            <h3
              id="settings-bug-report-heading"
              className="font-display text-sm font-extrabold uppercase tracking-wider text-[#facc15]"
            >
              REPORT A BUG
            </h3>
          </div>

          <p className="text-xs leading-relaxed text-[#d6d3d1]">
            Spotted a bug, visual glitch, or lag? Send a direct message to the developer:
          </p>

          {/* Direct Email Pill + Copy Email Action */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border border-[#facc15]/35 bg-[#120d0a] px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#facc15]" aria-hidden="true" />
              <span
                data-testid="bug-report-email"
                className="truncate font-mono-num text-xs font-bold text-[#fef08a] select-text"
              >
                {DEVELOPER_BUG_EMAIL}
              </span>
            </div>

            <button
              type="button"
              data-testid="copy-email-btn"
              onClick={handleCopyEmail}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 border px-2.5 py-1 font-display text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
                emailCopied
                  ? 'border-[#4ade80] bg-[#14532d]/80 text-[#bbf7d0]'
                  : 'border-[#facc15]/60 bg-[#251d17] text-[#fde047] hover:bg-[#facc15] hover:text-[#120d0a]'
              }`}
            >
              {emailCopied ? (
                <>
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span data-testid="email-copied-badge">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Copy Email</span>
                </>
              )}
            </button>
          </div>

          {/* Optional Quick Bug Note + Send Bug Report CTA */}
          <textarea
            data-testid="bug-report-textarea"
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            rows={2}
            placeholder="Briefly describe the bug (fighter, stage, or device)..."
            className="mt-2.5 w-full resize-none border border-white/20 bg-[#0f0b08] px-2.5 py-2 text-xs text-white placeholder-[#78716c] focus:border-[#facc15] focus:outline-none select-text"
          />

          <button
            type="button"
            data-testid="send-bug-report-btn"
            onClick={handleSendBugReport}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 border-2 border-[#0f0a06] bg-[#dc2626] px-3 py-2 font-display text-sm font-extrabold uppercase tracking-wider text-white shadow-[3px_3px_0_#facc15] transition hover:bg-[#ef4444] active:translate-y-0.5"
          >
            <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Send Bug Report</span>
          </button>
        </section>

        {/* ABOUT DEVELOPER Section */}
        <section
          aria-labelledby="settings-about-dev-heading"
          data-testid="settings-about-developer-section"
          className="mt-4 border-2 border-[#facc15]/65 bg-gradient-to-b from-[#21170d] via-[#17110c] to-[#110c09] p-3.5 shadow-[4px_4px_0_#0a0705]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Code2 className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
              <h3
                id="settings-about-dev-heading"
                className="font-display text-sm font-extrabold uppercase tracking-wider text-[#facc15]"
              >
                ABOUT DEVELOPER
              </h3>
            </div>
            <span className="border border-[#facc15]/60 bg-[#facc15]/15 px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-[#fde047]">
              {DEVELOPER_ROLE_BADGE}
            </span>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <GameLogoBadge
              testId="settings-dev-logo"
              shape="rounded"
              variant="developer"
              sizeClass="h-12 w-12"
            />
            <div className="min-w-0">
              <div
                data-testid="about-developer-name"
                className="font-display text-2xl font-extrabold uppercase italic leading-none tracking-wide text-white"
              >
                {DEVELOPER_NAME}
              </div>
              <div className="mt-1 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[#fde047]/90">
                DESI DANGAL · OFFICIAL STUDIO
              </div>
            </div>
          </div>

          {/* 4 Hobbies & Interests Tags */}
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Developer hobbies and interests">
            {DEVELOPER_HOBBIES.map((hobby) => (
              <span
                key={hobby}
                className="border border-[#facc15]/35 bg-[#120d0a] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#fef08a]"
              >
                {hobby}
              </span>
            ))}
          </div>

          {/* Creator Vision Note */}
          <p
            data-testid="about-developer-vision"
            className="mt-2.5 border-t border-white/10 pt-2.5 text-xs leading-relaxed text-[#e7e5e4]"
          >
            {DEVELOPER_VISION_NOTE}
          </p>
        </section>
      </div>
    </div>
  );
}
