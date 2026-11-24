import { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  ChevronRight,
  Flame,
  Hammer,
  Pause,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { FIGHTER_CONFIGS, getFighterPortraitDataUrl, STAGE_CONFIGS } from '../game/characters';
import type { FighterId, FloatingCallout, HudSnapshot, StageId } from '../game/types';
import { FullscreenButton } from './FullscreenButton';

interface FightHudProps {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  hud: HudSnapshot;
  callouts: FloatingCallout[];
  headlines: string[];
  muted: boolean;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSkipIntro: () => void;
  onTouchDirection: (dir: { left: boolean; right: boolean; up: boolean; down: boolean }) => void;
  onTouchAction: (action: 'punch' | 'kick' | 'grab' | 'special' | 'superMove') => void;
}

function SpecialIcon({ iconKey }: { iconKey: string }) {
  switch (iconKey) {
    case 'notes':
      return <Banknote className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
    case 'swatter':
      return <Zap className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
    case 'shield':
      return <Shield className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
    case 'drop':
      return <Flame className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
    case 'belan':
      return <Hammer className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
    default:
      return <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />;
  }
}

export function FightHud({
  p1Id,
  p2Id,
  stageId,
  hud,
  callouts,
  headlines,
  muted,
  isFullscreen,
  fullscreenSupported,
  onPause,
  onToggleMute,
  onToggleFullscreen,
  onSkipIntro,
  onTouchDirection,
  onTouchAction,
}: FightHudProps) {
  const p1Cfg = FIGHTER_CONFIGS[p1Id];
  const p2Cfg = FIGHTER_CONFIGS[p2Id];
  const stageCfg = STAGE_CONFIGS[stageId];

  const p1Pct = Math.max(0, Math.min(100, (hud.p1Hp / hud.p1MaxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (hud.p2Hp / hud.p2MaxHp) * 100));

  // Delayed trailing white/yellow ghost damage bars
  const [p1Ghost, setP1Ghost] = useState(100);
  const [p2Ghost, setP2Ghost] = useState(100);
  useEffect(() => {
    const t = window.setTimeout(() => setP1Ghost(p1Pct), 240);
    return () => clearTimeout(t);
  }, [p1Pct]);
  useEffect(() => {
    const t = window.setTimeout(() => setP2Ghost(p2Pct), 240);
    return () => clearTimeout(t);
  }, [p2Pct]);

  // Virtual Joystick State
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobPos({ x: dx, y: dy });
    const dead = maxR * 0.26;
    onTouchDirection({
      left: dx < -dead,
      right: dx > dead,
      up: dy < -dead * 1.15,
      down: dy > dead * 1.15,
    });
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobPos({ x: 0, y: 0 });
    onTouchDirection({ left: false, right: false, up: false, down: false });
  };

  // Cooldown progress for Specialised Move radial ring
  const cdRatio =
    hud.p1SpecialMaxCd > 0 ? Math.max(0, Math.min(1, hud.p1SpecialCd / hud.p1SpecialMaxCd)) : 0;
  const cdReady = hud.p1SpecialCd <= 0.01;
  const ringCircumference = 2 * Math.PI * 28;
  const ringOffset = ringCircumference * (1 - cdRatio);

  const superReady = hud.p1Shakti >= 100;
  const tickerText = headlines.join('   ★   ');

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none">
      {/* TOP TV NEWS BROADCAST ARENA HUD */}
      <header className="safe-pad-hud-top w-full shrink-0 sm:px-5 sm:pt-3">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2 sm:gap-3">
          {/* P1 Skewed Health + Glowing SHAKTI */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <div className="hud-portrait relative h-12 w-12 shrink-0 border-2 border-[#facc15] bg-[#16110e] shadow-[3px_3px_0_#0f0a06] sm:h-14 sm:w-14">
              <img
                src={getFighterPortraitDataUrl(p1Id)}
                alt={p1Cfg.name}
                className="h-full w-full object-cover"
              />
              <span className="absolute -bottom-1 -left-1 bg-[#facc15] px-1 font-display text-[10px] font-extrabold text-[#110b08]">
                1P
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="hud-fighter-name truncate pr-1 font-display text-lg font-extrabold uppercase italic tracking-wide text-white news-stroke sm:text-xl">
                  {p1Cfg.name}
                </span>
                <span
                  className="hud-hp-num shrink-0 bg-[#120d0a]/88 px-1.5 py-0.5 font-mono-num text-xs font-bold text-[#facc15]"
                  data-testid="p1-hp"
                >
                  {hud.p1Hp}/{hud.p1MaxHp}
                </span>
              </div>

              {/* Skewed P1 Health Bar with White/Yellow Trailing Ghost */}
              <div className="hud-hp-bar relative h-4 w-full -skew-x-12 overflow-hidden border-2 border-[#0f0a06] bg-[#1c1917] shadow-[3px_3px_0_#0f0a06] sm:h-5">
                <div
                  className="absolute inset-y-0 left-0 bg-[#fef08a] transition-[width] duration-350"
                  style={{ width: `${p1Ghost}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                    p1Pct <= 25
                      ? 'bg-[#ef4444]'
                      : 'bg-gradient-to-r from-[#16a34a] to-[#4ade80]'
                  }`}
                  style={{ width: `${p1Pct}%` }}
                />
              </div>

              {/* Glowing SHAKTI Meter */}
              <div className="hud-shakti-row mt-1 flex items-center gap-1.5 bg-[#120d0a]/88 px-2 py-0.5">
                <span className="font-display text-[10px] font-extrabold tracking-wider text-[#facc15] sm:text-[11px]">
                  SHAKTI
                </span>
                <div className="hud-shakti-bar relative h-2 flex-1 -skew-x-12 overflow-hidden border border-[#0f0a06] bg-[#292524]">
                  <div
                    className={`h-full transition-[width] duration-100 ${
                      superReady
                        ? 'bg-[#fde047] shadow-[0_0_10px_#fde047]'
                        : 'bg-gradient-to-r from-[#f59e0b] to-[#fde047]'
                    }`}
                    style={{ width: `${hud.p1Shakti}%` }}
                  />
                </div>
                <span className="font-mono-num text-[10px] font-bold text-[#fef08a]">
                  {hud.p1Shakti}%
                </span>
              </div>
            </div>
          </div>

          {/* CENTER STATIC ● LIVE BADGE & 60 TIMER */}
          <div className="flex shrink-0 flex-col items-center">
            <div className="hud-live-badge flex items-center gap-1.5 bg-[#dc2626] px-2.5 py-0.5 text-[11px] font-extrabold tracking-widest text-white shadow-[2px_2px_0_#0f0a06]">
              <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
              <span>LIVE</span>
            </div>
            <div
              data-testid="round-timer"
              className="hud-timer-box mt-0.5 flex h-11 w-16 items-center justify-center border-2 border-[#facc15] bg-[#120d0a] font-mono-num text-2xl font-bold text-[#facc15] shadow-[3px_3px_0_#0f0a06] sm:h-12 sm:w-20 sm:text-3xl"
            >
              {String(hud.roundTime).padStart(2, '0')}
            </div>
            <span className="hud-stage-label mt-0.5 hidden max-w-[120px] truncate bg-[#120d0a]/88 px-1.5 text-[10px] font-bold uppercase tracking-wider text-[#e7e5e4] sm:block">
              {stageCfg.name}
            </span>
          </div>

          {/* CPU Skewed Health + SHAKTI + Top-Right Pause, Mute & Fullscreen */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-1.5">
                <span
                  className="hud-hp-num shrink-0 bg-[#120d0a]/88 px-1.5 py-0.5 font-mono-num text-xs font-bold text-[#fda4af]"
                  data-testid="p2-hp"
                >
                  {hud.p2Hp}/{hud.p2MaxHp}
                </span>
                <span className="hud-fighter-name truncate pr-1 font-display text-lg font-extrabold uppercase italic tracking-wide text-white news-stroke sm:text-xl">
                  {p2Cfg.name}
                </span>
              </div>

              {/* Skewed Mirrored CPU Health Bar */}
              <div className="hud-hp-bar relative h-4 w-full skew-x-12 overflow-hidden border-2 border-[#0f0a06] bg-[#1c1917] shadow-[3px_3px_0_#0f0a06] sm:h-5">
                <div
                  className="absolute inset-y-0 right-0 bg-[#fef08a] transition-[width] duration-350"
                  style={{ width: `${p2Ghost}%` }}
                />
                <div
                  className={`absolute inset-y-0 right-0 transition-[width] duration-75 ${
                    p2Pct <= 25
                      ? 'bg-[#ef4444]'
                      : 'bg-gradient-to-l from-[#e11d48] to-[#fb7185]'
                  }`}
                  style={{ width: `${p2Pct}%` }}
                />
              </div>

              {/* CPU SHAKTI Meter */}
              <div className="hud-shakti-row mt-1 flex items-center gap-1.5 bg-[#120d0a]/88 px-2 py-0.5">
                <span className="font-mono-num text-[10px] font-bold text-[#fda4af]">
                  {hud.p2Shakti}%
                </span>
                <div className="hud-shakti-bar relative h-2 flex-1 skew-x-12 overflow-hidden border border-[#0f0a06] bg-[#292524]">
                  <div
                    className="ml-auto h-full bg-gradient-to-l from-[#e11d48] to-[#fda4af] transition-[width] duration-100"
                    style={{ width: `${hud.p2Shakti}%` }}
                  />
                </div>
                <span className="font-display text-[10px] font-extrabold tracking-wider text-[#fda4af] sm:text-[11px]">
                  SHAKTI
                </span>
              </div>
            </div>

            <div className="hud-portrait relative h-12 w-12 shrink-0 border-2 border-[#ef4444] bg-[#16110e] shadow-[3px_3px_0_#0f0a06] sm:h-14 sm:w-14">
              <img
                src={getFighterPortraitDataUrl(p2Id)}
                alt={p2Cfg.name}
                className="h-full w-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 bg-[#dc2626] px-1 font-display text-[10px] font-extrabold text-white">
                CPU
              </span>
            </div>

            {/* Sleek Top-Right Utility Cluster: Pause (II), Mute & Fullscreen */}
            <div className="pointer-events-auto flex shrink-0 items-center gap-1 self-start">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause game (Chai Break)"
                title="Pause"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                className="hud-util-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-[#facc15] bg-[#14100d]/90 text-[#facc15] hover:bg-[#facc15] hover:text-[#110b08]"
              >
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                title={muted ? 'Unmute' : 'Mute'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="hud-util-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white/40 bg-[#14100d]/90 text-white hover:border-[#facc15] hover:text-[#facc15]"
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
              <FullscreenButton
                isFullscreen={isFullscreen}
                isSupported={fullscreenSupported}
                onToggle={onToggleFullscreen}
                variant="hud"
              />
            </div>
          </div>
        </div>

        {/* Live Combo Counter */}
        <div className="hud-combo-row mx-auto mt-1 flex max-w-6xl justify-between px-14">
          <div className="hud-combo-slot h-6">
            {hud.p1Combo >= 2 && (
              <span className="hud-combo-text font-display text-2xl font-extrabold italic text-[#facc15] news-stroke">
                {hud.p1Combo} HITS!
              </span>
            )}
          </div>
          <div className="hud-combo-slot h-6">
            {hud.p2Combo >= 2 && (
              <span className="hud-combo-text font-display text-2xl font-extrabold italic text-[#fb7185] news-stroke">
                {hud.p2Combo} HITS!
              </span>
            )}
          </div>
        </div>
      </header>

      {/* FLOATING 2D COMIC HIT-WORDS */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {callouts.map((c) => (
          <div
            key={c.id}
            className="comic-pop-text absolute whitespace-nowrap text-3xl sm:text-4xl"
            style={{
              left: `${c.screenX}px`,
              top: `${c.screenY}px`,
              color: c.color,
            }}
          >
            {c.text}
          </div>
        ))}
      </div>

      {/* PRE-FIGHT TV DEBATE CLASH BANNER (2s intro with SKIP ›) */}
      {hud.showBroadcastIntro && (
        <div
          data-testid="broadcast-intro-banner"
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-4"
        >
          <div className="pointer-events-auto relative w-full max-w-2xl border-4 border-[#0f0a06] bg-[#14100d]/95 shadow-[8px_8px_0_#dc2626]">
            {/* Top Live Debate Ribbon */}
            <div className="flex items-center justify-between bg-[#dc2626] px-4 py-1.5">
              <div className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-widest text-white">
                <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                <span>LIVE · PRIME TIME SHOWDOWN</span>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSkipIntro();
                }}
                className="flex cursor-pointer items-center gap-0.5 border border-[#facc15] bg-[#110b08] px-2.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#facc15] hover:bg-[#facc15] hover:text-[#110b08]"
              >
                <span>SKIP</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* P1 VS CPU Clash Row */}
            <div className="hud-intro-body flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <img
                  src={getFighterPortraitDataUrl(p1Id)}
                  alt={p1Cfg.name}
                  className="hud-intro-avatar h-14 w-14 border-2 border-[#facc15] object-cover sm:h-16 sm:w-16"
                />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#facc15]">
                    PLAYER 1
                  </div>
                  <div className="hud-intro-name font-display text-2xl font-extrabold uppercase italic leading-none text-white sm:text-3xl">
                    {p1Cfg.name}
                  </div>
                </div>
              </div>

              <div className="-skew-x-12 bg-[#facc15] px-3 py-1 font-display text-2xl font-extrabold italic text-[#110b08] shadow-[4px_4px_0_#dc2626] sm:text-3xl">
                <span className="inline-block skew-x-12">VS</span>
              </div>

              <div className="flex flex-row-reverse items-center gap-3 text-right">
                <img
                  src={getFighterPortraitDataUrl(p2Id)}
                  alt={p2Cfg.name}
                  className="hud-intro-avatar h-14 w-14 border-2 border-[#ef4444] object-cover sm:h-16 sm:w-16"
                />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#fb7185]">
                    CPU CHALLENGER
                  </div>
                  <div className="hud-intro-name font-display text-2xl font-extrabold uppercase italic leading-none text-white sm:text-3xl">
                    {p2Cfg.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Witty 1-line Debate Tagline */}
            <div className="border-t-2 border-[#facc15] bg-[#facc15] px-4 py-1 text-center font-display text-sm font-extrabold uppercase italic tracking-wider text-[#110b08] sm:text-lg">
              &ldquo;{hud.introTagline}&rdquo;
            </div>
          </div>
        </div>
      )}

      {/* CENTER TRANSIENT FIGHT KARO! / K.O.! CALLOUT BANNER */}
      {!hud.showBroadcastIntro && hud.bannerText && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="hud-banner-box -skew-x-12 border-4 border-[#0f0a06] bg-[#dc2626] px-8 py-2.5 font-display text-5xl font-extrabold uppercase italic tracking-wider text-[#facc15] shadow-[8px_8px_0_#0f0a06] sm:text-7xl">
            <span className="inline-block skew-x-12">{hud.bannerText}</span>
          </div>
        </div>
      )}

      {/* BOTTOM CLEAN CONTROLS & FLUSH BREAKING BAKWAS TICKER */}
      <div className="w-full shrink-0">
        {/* Responsive Touch Joystick (Left) + Sleek Circular Arcade Cluster (Right) */}
        <div className="safe-pad-hud-controls hud-controls-row mx-auto flex w-full max-w-6xl items-end justify-between pb-2.5 sm:px-6 sm:pb-3">
          {/* Left Virtual Joystick */}
          <div
            ref={stickBaseRef}
            data-testid="virtual-joystick"
            aria-label="Movement virtual joystick"
            onPointerDown={(e) => {
              activePointerId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateStickFromPoint(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (activePointerId.current === e.pointerId) {
                updateStickFromPoint(e.clientX, e.clientY);
              }
            }}
            onPointerUp={(e) => {
              if (activePointerId.current === e.pointerId) resetStick();
            }}
            onPointerCancel={resetStick}
            className="hud-stick-base pointer-events-auto relative flex h-24 w-24 touch-none items-center justify-center rounded-full border-2 border-[#facc15]/75 bg-[#120d0a]/60 shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:h-28 sm:w-28"
          >
            <div className="pointer-events-none absolute inset-2 rounded-full border border-dashed border-white/25" />
            <div
              className="hud-stick-knob pointer-events-none h-10 w-10 rounded-full border-2 border-[#0f0a06] bg-[#facc15]/95 shadow-[0_3px_0_#dc2626] sm:h-11 sm:w-11"
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            />
          </div>

          {/* Right Semi-Translucent Circular Arcade Action Cluster */}
          <div className="hud-action-cluster pointer-events-auto flex items-end gap-3" data-testid="action-cluster">
            {/* Highlighted Specialised Move Circular Button with Radial Cooldown Ring */}
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Specialised move: ${p1Cfg.special.name}`}
              onPointerDown={(e) => {
                e.preventDefault();
                onTouchAction('special');
              }}
              className={`hud-special-btn relative flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-full border-2 text-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-transform active:scale-95 sm:h-[72px] sm:w-[72px] ${
                cdReady
                  ? 'border-[#facc15] bg-[#14100d]/82 text-[#facc15]'
                  : 'border-white/25 bg-[#14100d]/65 text-[#a8a29e]'
              }`}
            >
              <svg
                viewBox="0 0 64 64"
                className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="4"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={cdReady ? '#FACC15' : '#FB923C'}
                  strokeWidth="4"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={cdReady ? 0 : ringOffset}
                />
              </svg>
              <SpecialIcon iconKey={p1Cfg.special.iconKey} />
              <span className="hud-special-label mt-0.5 max-w-[46px] truncate font-display text-[9px] font-extrabold uppercase leading-none sm:text-[10px]">
                {cdReady ? p1Cfg.special.shortLabel : `${hud.p1SpecialCd.toFixed(1)}s`}
              </span>
            </button>

            {/* Circular Diamond/Grid for PUNCH, KICK, GRAB, SUPER */}
            <div className="hud-action-grid grid grid-cols-2 gap-2">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Punch attack"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchAction('punch');
                }}
                className="hud-action-btn flex h-13 w-13 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-[#facc15] bg-[#facc15]/82 font-display text-xs font-extrabold uppercase leading-none text-[#110b08] shadow-[0_3px_10px_rgba(0,0,0,0.45)] active:scale-95 sm:h-14 sm:w-14 sm:text-sm"
              >
                <span>PUNCH</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Kick attack"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchAction('kick');
                }}
                className="hud-action-btn flex h-13 w-13 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-[#fca5a5] bg-[#dc2626]/82 font-display text-xs font-extrabold uppercase leading-none text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)] active:scale-95 sm:h-14 sm:w-14 sm:text-sm"
              >
                <span>KICK</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Grab throw"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchAction('grab');
                }}
                className="hud-action-btn flex h-13 w-13 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-[#7dd3fc] bg-[#0284c7]/78 font-display text-xs font-extrabold uppercase leading-none text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)] active:scale-95 sm:h-14 sm:w-14 sm:text-sm"
              >
                <span>GRAB</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={superReady ? 'Trigger Shakti Super' : 'Super Shakti charge'}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchAction('superMove');
                }}
                className={`hud-action-btn flex h-13 w-13 cursor-pointer flex-col items-center justify-center rounded-full border-2 font-display text-xs font-extrabold uppercase leading-none shadow-[0_3px_10px_rgba(0,0,0,0.45)] active:scale-95 sm:h-14 sm:w-14 ${
                  superReady
                    ? 'border-[#fde047] bg-[#ea580c]/92 text-white'
                    : 'border-white/30 bg-[#14100d]/72 text-[#d6d3d1]'
                }`}
              >
                <span>SUPER</span>
                <span className="font-mono-num text-[9px] font-bold">
                  {superReady ? 'MAX!' : `${hud.p1Shakti}%`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* FLUSH BOTTOM BREAKING BAKWAS NEWS TICKER */}
        <div
          data-testid="breaking-ticker"
          className="safe-pad-ticker w-full border-t-2 border-[#0f0a06] bg-[#facc15] text-[#110b08]"
        >
          <div className="hud-ticker-inner flex h-7 w-full items-center overflow-hidden sm:h-8">
            <div className="hud-ticker-label z-10 flex h-full shrink-0 items-center bg-[#dc2626] px-3 font-display text-xs font-extrabold uppercase tracking-wider text-white sm:text-sm">
              BREAKING BAKWAS
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div className="hud-ticker-text animate-ticker font-display text-xs font-extrabold uppercase tracking-wide sm:text-sm">
                <span className="pr-10">{tickerText}</span>
                <span className="pr-10" aria-hidden="true">
                  {tickerText}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
