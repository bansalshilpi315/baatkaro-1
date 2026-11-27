import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Pause, Volume2, VolumeX } from 'lucide-react';
import { FIGHTER_CONFIGS } from '../game/characters';
import type { OnlineRole } from '../game/friendRoomProtocol';
import type { FighterId, FloatingCallout, HudSnapshot, StageId } from '../game/types';
import { FighterPortrait } from './FighterPortrait';
import { FullscreenButton } from './FullscreenButton';

interface FightHudProps {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  hud: HudSnapshot;
  callouts: FloatingCallout[];
  globalMuted: boolean;
  onlineRole?: OnlineRole;
  roomCode?: string;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onPause: () => void;
  onToggleGlobalMute: () => void;
  onToggleFullscreen: () => void;
  onSkipIntro: () => void;
  onTouchDirection: (dir: { left: boolean; right: boolean; up: boolean; down: boolean }) => void;
  onTouchAction: (action: 'punch' | 'kick' | 'grab' | 'special' | 'superMove') => void;
}

export function FightHud({
  p1Id,
  p2Id,
  hud,
  callouts,
  globalMuted,
  onlineRole = 'offline',
  roomCode = '',
  isFullscreen,
  fullscreenSupported,
  onPause,
  onToggleGlobalMute,
  onToggleFullscreen,
  onSkipIntro,
  onTouchDirection,
  onTouchAction,
}: FightHudProps) {
  const p1Cfg = FIGHTER_CONFIGS[p1Id];
  const p2Cfg = FIGHTER_CONFIGS[p2Id];
  const isGuest = onlineRole === 'guest';
  const isOnline = onlineRole !== 'offline';
  const localCfg = isGuest ? p2Cfg : p1Cfg;
  const leftRoleLabel = onlineRole === 'host' ? '1P · YOU' : isGuest ? '1P · HOST' : 'P1';
  const rightRoleLabel = isGuest ? '2P · YOU' : onlineRole === 'host' ? '2P · FRIEND' : 'CPU';

  const p1Pct = Math.max(0, Math.min(100, (hud.p1Hp / hud.p1MaxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (hud.p2Hp / hud.p2MaxHp) * 100));

  // Smooth red trailing damage indicator
  const [p1Trail, setP1Trail] = useState(100);
  const [p2Trail, setP2Trail] = useState(100);

  useEffect(() => {
    if (p1Pct > p1Trail) {
      setP1Trail(p1Pct);
      return;
    }
    const t = window.setTimeout(() => setP1Trail(p1Pct), 220);
    return () => clearTimeout(t);
  }, [p1Pct, p1Trail]);

  useEffect(() => {
    if (p2Pct > p2Trail) {
      setP2Trail(p2Pct);
      return;
    }
    const t = window.setTimeout(() => setP2Trail(p2Pct), 220);
    return () => clearTimeout(t);
  }, [p2Pct, p2Trail]);

  // Auto-hide touch controls during pre-fight intros, cinematic Supers, and KO/Victory
  const controlsHidden =
    hud.phase === 'intro' ||
    hud.isSuperCinematic ||
    hud.phase === 'ko_freeze' ||
    hud.phase === 'finished';

  // Virtual Joystick State
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const resetStick = useCallback(() => {
    activePointerId.current = null;
    setKnobPos({ x: 0, y: 0 });
    onTouchDirection({ left: false, right: false, up: false, down: false });
  }, [onTouchDirection]);

  useEffect(() => {
    if (controlsHidden && activePointerId.current !== null) {
      resetStick();
    }
  }, [controlsHidden, resetStick]);

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobPos({ x: dx, y: dy });
    const dead = maxR * 0.25;
    onTouchDirection({
      left: dx < -dead,
      right: dx > dead,
      up: dy < -dead * 1.15,
      down: dy > dead * 1.15,
    });
  };

  const p1SuperReady = hud.p1Shakti >= 100;
  const p2SuperReady = hud.p2Shakti >= 100;
  const localShakti = isGuest ? hud.p2Shakti : hud.p1Shakti;
  const localSuperReady = localShakti >= 100;
  const localSpecialCd = isGuest ? hud.p2SpecialCd : hud.p1SpecialCd;
  const localSpecialMaxCd = isGuest ? hud.p2SpecialMaxCd : hud.p1SpecialMaxCd;
  const timerUrgent = hud.roundTime <= 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none">
      {/* =================================================================
          TOP ARCADE HUD BAR (SPACIOUS, CLEAN, ZERO BOTTOM TICKER)
          ================================================================= */}
      <header className="safe-pad-hud-top relative z-20 w-full">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-2 sm:gap-3">
          {/* ---------------- LEFT: P1 PORTRAIT + HP + ROUNDS + SHAKTI ---------------- */}
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
            {/* Far-Left Square Portrait with Thin Gold Border */}
            <div className="hud-portrait relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border-2 border-[#facc15] bg-[#14100d] shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:h-16 sm:w-16">
              <FighterPortrait
                id={p1Id}
                alt={p1Cfg.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* Fighter Name + P1 Tag */}
              <div className="mb-1 flex items-baseline justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="hud-role-tag font-display text-xs font-extrabold uppercase tracking-wider text-[#facc15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-sm">
                    {leftRoleLabel}
                  </span>
                  <span className="hud-fighter-name truncate font-display text-base font-extrabold uppercase tracking-wide text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] sm:text-xl">
                    {p1Cfg.name}
                  </span>
                </div>
              </div>

              {/* Thick Skewed Golden-Yellow HP Bar + Smooth Red Trailing Damage Indicator */}
              <div
                data-testid="p1-hp-bar"
                className="hud-hp-bar relative h-4 w-full -skew-x-[12deg] overflow-hidden border-2 border-[#facc15]/90 bg-[#1a130e]/90 shadow-[0_3px_10px_rgba(0,0,0,0.65)] sm:h-5"
              >
                {/* Red trailing damage bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#dc2626] transition-[width] duration-300 ease-out"
                  style={{ width: `${p1Trail}%` }}
                />
                {/* Golden-yellow active health fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#ca8a04] transition-[width] duration-100"
                  style={{ width: `${p1Pct}%` }}
                />
                {/* Subtle top specular gloss */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-white/25" />
              </div>

              {/* 2 Round-Win Indicator Circles (Best of 3) */}
              <div
                data-testid="p1-rounds"
                className="mt-1 flex items-center gap-1.5 px-0.5"
                aria-label={`P1 rounds won: ${hud.p1RoundsWon} of 2`}
              >
                {[0, 1].map((idx) => {
                  const won = hud.p1RoundsWon > idx;
                  return (
                    <span
                      key={idx}
                      data-won={won ? 'true' : 'false'}
                      className={`hud-round-dot h-3 w-3 rounded-full border-[1.5px] transition-all duration-200 ${
                        won
                          ? 'border-[#fef9c3] bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.95)]'
                          : 'border-[#facc15]/60 bg-black/65'
                      }`}
                    />
                  );
                })}
                {p1SuperReady && (
                  <span
                    data-testid="p1-shakti-ready"
                    className="hud-shakti-ready-text ml-auto font-display text-[11px] font-extrabold uppercase tracking-wider text-[#fde047] [-webkit-text-stroke:0.6px_#140d04] drop-shadow-[0_1px_3px_rgba(0,0,0,0.98)] sm:text-xs"
                  >
                    SHAKTI READY!
                  </span>
                )}
              </div>

              {/* Sleek Emerald-to-Gold Shakti Bar */}
              <div
                data-testid="p1-shakti-bar"
                className={`hud-shakti-bar mt-1 h-2 w-full -skew-x-[12deg] overflow-hidden border bg-black/75 transition-all ${
                  p1SuperReady
                    ? 'shakti-ready-pulse border-[#fef08a]'
                    : 'border-white/25'
                }`}
              >
                <div
                  className={`h-full transition-[width] duration-150 ${
                    p1SuperReady
                      ? 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#fef08a]'
                      : 'bg-gradient-to-r from-[#059669] via-[#10b981] to-[#facc15]'
                  }`}
                  style={{ width: `${Math.min(100, hud.p1Shakti)}%` }}
                />
              </div>
            </div>
          </div>

          {/* ---------------- CENTER: CRISP WHITE 60s TIMER + PAUSE BUTTON ---------------- */}
          <div className="flex shrink-0 flex-col items-center px-1 sm:px-2">
            <div
              data-testid="hud-timer"
              className={`hud-timer-num font-display text-4xl font-extrabold leading-none tracking-tight drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)] sm:text-5xl ${
                timerUrgent ? 'text-[#f87171]' : 'text-white'
              }`}
            >
              {String(hud.roundTime).padStart(2, '0')}
            </div>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause Game"
              data-testid="hud-pause-btn"
              className="hud-pause-btn pointer-events-auto mt-1 flex h-7 w-9 cursor-pointer items-center justify-center rounded-md border border-white/35 bg-black/55 text-white backdrop-blur-sm transition hover:border-[#facc15] hover:bg-black/75 hover:text-[#facc15]"
            >
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </button>
            {isOnline && roomCode && (
              <div className="mt-0.5 rounded bg-black/65 px-1.5 py-0.5 font-mono-num text-[9px] font-bold tracking-wider text-[#86efac]">
                #{roomCode}
              </div>
            )}
          </div>

          {/* ---------------- RIGHT: CPU / 2P HP + ROUNDS + SHAKTI + PORTRAIT ---------------- */}
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
            <div className="min-w-0 flex-1">
              {/* Fighter Name + CPU / 2P Tag */}
              <div className="mb-1 flex items-baseline justify-end gap-1.5 px-0.5">
                <span className="hud-fighter-name truncate font-display text-base font-extrabold uppercase tracking-wide text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] sm:text-xl">
                  {p2Cfg.name}
                </span>
                <span className="hud-role-tag font-display text-xs font-extrabold uppercase tracking-wider text-[#facc15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-sm">
                  {rightRoleLabel}
                </span>
              </div>

              {/* Thick Skewed Golden-Yellow HP Bar (Drains Right-to-Left) */}
              <div
                data-testid="p2-hp-bar"
                className="hud-hp-bar relative h-4 w-full skew-x-[12deg] overflow-hidden border-2 border-[#facc15]/90 bg-[#1a130e]/90 shadow-[0_3px_10px_rgba(0,0,0,0.65)] sm:h-5"
              >
                {/* Red trailing damage bar */}
                <div
                  className="absolute inset-y-0 right-0 bg-[#dc2626] transition-[width] duration-300 ease-out"
                  style={{ width: `${p2Trail}%` }}
                />
                {/* Golden-yellow active health fill */}
                <div
                  className="absolute inset-y-0 right-0 bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#ca8a04] transition-[width] duration-100"
                  style={{ width: `${p2Pct}%` }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-white/25" />
              </div>

              {/* 2 Round-Win Indicator Circles (Right-aligned) */}
              <div
                data-testid="p2-rounds"
                className="mt-1 flex items-center justify-end gap-1.5 px-0.5"
                aria-label={`CPU rounds won: ${hud.p2RoundsWon} of 2`}
              >
                {p2SuperReady && (
                  <span className="hud-shakti-ready-text mr-auto font-display text-[11px] font-extrabold uppercase tracking-wider text-[#fde047] [-webkit-text-stroke:0.6px_#140d04] drop-shadow-[0_1px_3px_rgba(0,0,0,0.98)] sm:text-xs">
                    SHAKTI READY!
                  </span>
                )}
                {[1, 0].map((idx) => {
                  const won = hud.p2RoundsWon > idx;
                  return (
                    <span
                      key={idx}
                      data-won={won ? 'true' : 'false'}
                      className={`hud-round-dot h-3 w-3 rounded-full border-[1.5px] transition-all duration-200 ${
                        won
                          ? 'border-[#fef9c3] bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.95)]'
                          : 'border-[#facc15]/60 bg-black/65'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Sleek Emerald-to-Gold Shakti Bar (Fills Right-to-Left) */}
              <div
                data-testid="p2-shakti-bar"
                className={`hud-shakti-bar mt-1 flex h-2 w-full skew-x-[12deg] justify-end overflow-hidden border bg-black/75 transition-all ${
                  p2SuperReady
                    ? 'shakti-ready-pulse border-[#fef08a]'
                    : 'border-white/25'
                }`}
              >
                <div
                  className={`h-full transition-[width] duration-150 ${
                    p2SuperReady
                      ? 'bg-gradient-to-l from-[#fde047] via-[#facc15] to-[#fef08a]'
                      : 'bg-gradient-to-l from-[#059669] via-[#10b981] to-[#facc15]'
                  }`}
                  style={{ width: `${Math.min(100, hud.p2Shakti)}%` }}
                />
              </div>
            </div>

            {/* Far-Right Square Portrait with Thin Gold Border */}
            <div className="hud-portrait relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border-2 border-[#facc15] bg-[#14100d] shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:h-16 sm:w-16">
              <FighterPortrait
                id={p2Id}
                alt={p2Cfg.name}
                className="h-full w-full -scale-x-100 object-cover"
              />
            </div>

            {/* Compact Top-Right Utility Controls (Fullscreen + Mute) Tucked Cleanly Beside Portrait */}
            <div className="pointer-events-auto flex shrink-0 flex-col gap-1">
              <FullscreenButton
                variant="hud"
                isFullscreen={isFullscreen}
                isSupported={fullscreenSupported}
                onToggle={onToggleFullscreen}
              />
              <button
                type="button"
                data-testid="global-mute-btn"
                onClick={onToggleGlobalMute}
                aria-label={globalMuted ? 'Unmute All Audio' : 'Mute All Audio'}
                aria-pressed={globalMuted}
                title={globalMuted ? 'Unmute All Audio (M)' : 'Mute All Audio (M)'}
                className={`hud-util-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 bg-[#14100d]/90 transition-colors hover:border-[#facc15] hover:text-[#facc15] ${
                  globalMuted
                    ? 'border-[#f87171]/80 text-[#f87171]'
                    : 'border-white/40 text-white'
                }`}
              >
                {globalMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-[#f87171]" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Combo Counters + Floating Top-Center Move Callout */}
        <div className="hud-combo-row mx-auto mt-1 flex w-full max-w-6xl items-center justify-between px-16 sm:px-20">
          <div className="h-7 min-w-[7rem]">
            {hud.p1Combo >= 2 && (
              <div
                data-testid="p1-combo-counter"
                className="hud-combo-text news-stroke font-display text-2xl font-extrabold uppercase italic tracking-wide text-[#facc15] sm:text-3xl"
              >
                {hud.p1Combo} HITS
              </div>
            )}
          </div>

          <div className="flex h-7 items-center justify-center">
            {hud.moveCallout && !hud.superBanner && !hud.bannerText && (
              <div
                data-testid="move-callout"
                className="move-callout-pop news-stroke -skew-x-[10deg] font-display text-lg font-extrabold uppercase italic tracking-wider text-[#fde047] sm:text-2xl"
              >
                {hud.moveCallout}
              </div>
            )}
          </div>

          <div className="h-7 min-w-[7rem] text-right">
            {hud.p2Combo >= 2 && (
              <div
                data-testid="p2-combo-counter"
                className="hud-combo-text news-stroke font-display text-2xl font-extrabold uppercase italic tracking-wide text-[#facc15] sm:text-3xl"
              >
                {hud.p2Combo} HITS
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =================================================================
          FLOATING COMIC-BOOK CALLOUTS (AND SIGNATURE SUPER FINISHER POP-UPS)
          ================================================================= */}
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        {callouts.map((c) => {
          const isLongSignature = Boolean(c.isSignature && c.text.length > 26);
          return (
            <div
              key={c.id}
              data-testid={c.isSignature ? 'super-signature-callout' : 'floating-comic-callout'}
              data-signature={c.isSignature ? 'true' : 'false'}
              className={`comic-pop-text absolute ${
                isLongSignature
                  ? 'comic-pop-signature max-w-[86vw] whitespace-normal text-center text-xl leading-tight sm:text-3xl'
                  : c.isSignature
                    ? 'comic-pop-signature whitespace-nowrap text-3xl sm:text-5xl'
                    : 'whitespace-nowrap text-2xl sm:text-4xl'
              }`}
              style={{
                left: isLongSignature ? '50%' : `${c.screenX}px`,
                top: isLongSignature ? '28%' : `${c.screenY}px`,
                color: c.color,
              }}
            >
              {c.text}
            </div>
          );
        })}
      </div>

      {/* =================================================================
          WHITE COMIC SPEECH BUBBLES (NON-BLOCKING, 2.0s SMOOTH FADE-OUT)
          ================================================================= */}
      {hud.speechBubbles.map((bubble) => {
        const tailPosClass =
          bubble.tailSide === 'left'
            ? '-left-[6px] bottom-2.5 border-b-2 border-l-2'
            : bubble.tailSide === 'right'
              ? '-right-[6px] bottom-2.5 border-t-2 border-r-2'
              : '-bottom-[6px] left-1/2 -translate-x-1/2 border-r-2 border-b-2';
        return (
          <div
            key={bubble.id}
            data-testid="comic-speech-bubble"
            data-slot={bubble.slot}
            className="pointer-events-none fixed z-30"
            style={{
              left: `${bubble.screenX}px`,
              top: `${bubble.screenY}px`,
              opacity: bubble.opacity,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="comic-bubble-pop relative max-w-[12.5rem] rounded-lg border-2 border-[#110b08] bg-white/95 px-2.5 py-1.5 text-[#110b08] shadow-[3px_3px_0_#110b08] sm:max-w-[15rem] sm:px-3 sm:py-1.5">
              <div className="font-display text-[9px] font-extrabold uppercase leading-none tracking-[0.14em] text-[#b45309] sm:text-[10px]">
                {bubble.speakerName}
              </div>
              <div className="mt-0.5 font-display text-[11px] font-extrabold leading-tight tracking-wide text-[#110b08] sm:text-xs">
                &ldquo;{bubble.text}&rdquo;
              </div>
              {bubble.subtitle && (
                <div
                  data-testid="dialogue-english-subtitle"
                  className="mt-0.5 border-t border-[#110b08]/15 pt-0.5 font-sans text-[9px] font-semibold leading-tight text-[#44403c] sm:text-[10px]"
                >
                  {bubble.subtitle}
                </div>
              )}
              {/* Crisp compact comic speech tail pointing toward fighter head */}
              <div
                aria-hidden="true"
                className={`absolute h-2.5 w-2.5 rotate-45 bg-white/95 border-[#110b08] ${tailPosClass}`}
              />
            </div>
          </div>
        );
      })}

      {/* Subtle Tap to Skip overlay & badge during Round 1 intro dialogues ONLY */}
      {hud.canSkipIntro && (
        <>
          <button
            type="button"
            aria-label="Tap to Skip Intro"
            data-testid="intro-tap-skip-overlay"
            onClick={onSkipIntro}
            className="pointer-events-auto fixed inset-0 z-10 cursor-pointer bg-transparent"
          />
          <div className="pointer-events-auto fixed right-4 bottom-4 z-30">
            <button
              type="button"
              data-testid="skip-intro-btn"
              onClick={onSkipIntro}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-[#facc15]/70 bg-[#140e0b]/75 px-3 py-1 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[#fde68a] backdrop-blur-xs transition hover:border-[#facc15] hover:bg-[#facc15] hover:text-[#110b08] sm:text-xs"
            >
              <span>Tap to Skip</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {/* =================================================================
          SLEEK DARK TRANSLUCENT HORIZONTAL SUPER POWER BANNER STRIP
          ================================================================= */}
      {hud.superBanner && (
        <div
          data-testid={
            hud.superBanner.fighterId === 'sheru' ? 'sheru-super-banner' : 'super-banner'
          }
          className="super-strip-in pointer-events-none fixed inset-x-0 bottom-[10%] z-30 border-y-[3px] border-[#facc15] bg-[#0b0806]/90 shadow-[0_10px_36px_rgba(0,0,0,0.85)]"
        >
          <div
            className={`mx-auto flex max-w-5xl items-center gap-4 px-5 py-2 sm:gap-6 sm:px-8 sm:py-3 ${
              hud.superBanner.slot === 1 ? 'flex-row-reverse text-right' : 'flex-row text-left'
            }`}
          >
            <div className="hud-super-portrait relative h-14 w-14 shrink-0 overflow-hidden border-2 border-[#facc15] bg-[#16100c] shadow-[0_0_18px_rgba(250,204,21,0.55)] sm:h-20 sm:w-20">
              <FighterPortrait
                id={hud.superBanner.fighterId}
                alt={hud.superBanner.fighterName}
                className={`h-full w-full object-cover ${
                  hud.superBanner.slot === 1 ? '-scale-x-100' : ''
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-[#facc15] sm:text-sm">
                {hud.superBanner.fighterName} · SUPER POWER
              </div>
              <div className="hud-super-title news-stroke truncate font-display text-3xl font-extrabold uppercase italic leading-none tracking-wider text-white sm:text-6xl">
                {hud.superBanner.superName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          HUGE SLANTED ARCADE CALLOUTS: ROUND 1 / DAHI KHATAM! / <NAME> WINS
          ================================================================= */}
      {hud.bannerText && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-4">
          <div
            data-testid="arcade-center-banner"
            data-tone={hud.bannerTone}
            className={`hud-arcade-banner font-display font-extrabold uppercase italic tracking-wider ${
              hud.bannerTone === 'ko'
                ? 'arcade-banner-ko text-5xl sm:text-8xl'
                : hud.bannerTone === 'winner'
                  ? 'arcade-banner-winner text-4xl sm:text-7xl'
                  : 'arcade-banner-round text-5xl sm:text-8xl'
            }`}
          >
            {hud.bannerText}
          </div>
        </div>
      )}

      {/* =================================================================
          BOTTOM ERGONOMIC TRANSLUCENT TOUCH CONTROLS (AUTO-HIDE ON CUTSCENES)
          ================================================================= */}
      <div
        data-testid="touch-controls-layer"
        data-hidden={controlsHidden ? 'true' : 'false'}
        className={`safe-pad-hud-controls mt-auto flex w-full items-end justify-between pb-3 transition-all duration-200 sm:pb-4 ${
          controlsHidden
            ? 'pointer-events-none translate-y-4 opacity-0'
            : 'pointer-events-none translate-y-0 opacity-100'
        }`}
      >
        {/* Bottom-Left: Semi-Transparent Dark Circular Virtual Joystick + Glowing Golden-Orange Orb */}
        <div
          ref={stickBaseRef}
          aria-label="Virtual Movement Joystick"
          data-testid="virtual-joystick"
          onPointerDown={(e) => {
            if (controlsHidden) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            activePointerId.current = e.pointerId;
            updateStickFromPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activePointerId.current !== e.pointerId) return;
            updateStickFromPoint(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (activePointerId.current !== e.pointerId) return;
            resetStick();
          }}
          onPointerCancel={resetStick}
          className={`hud-stick-base relative flex h-28 w-28 touch-none items-center justify-center rounded-full border-2 border-white/25 bg-black/40 shadow-[inset_0_0_24px_rgba(0,0,0,0.65),0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:h-32 sm:w-32 ${
            controlsHidden ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Subtle inner guide ring & directional pips */}
          <div className="pointer-events-none absolute inset-4 rounded-full border border-white/12" />
          <span className="pointer-events-none absolute top-2 h-1.5 w-1.5 rounded-full bg-white/35" />
          <span className="pointer-events-none absolute bottom-2 h-1.5 w-1.5 rounded-full bg-white/35" />
          <span className="pointer-events-none absolute left-2 h-1.5 w-1.5 rounded-full bg-white/35" />
          <span className="pointer-events-none absolute right-2 h-1.5 w-1.5 rounded-full bg-white/35" />

          {/* Glowing Golden-Orange Thumbstick Orb */}
          <div
            className="hud-stick-knob pointer-events-none h-11 w-11 rounded-full border-2 border-[#fef3c7]/90 bg-gradient-to-br from-[#fef08a] via-[#f59e0b] to-[#ea580c] shadow-[0_0_20px_rgba(245,158,11,0.85),inset_0_2px_4px_rgba(255,255,255,0.65)] sm:h-12 sm:w-12"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          />
        </div>

          {/* Bottom-Right: 5 Translucent Circular Arcade Buttons in an Ergonomic Thumb Arc */}
        <div
          data-testid="touch-action-arc"
          className={`hud-thumb-arc ${controlsHidden ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          {/* PUNCH — Warm Amber-Gold Tint */}
          <button
            type="button"
            data-testid="btn-punch"
            onPointerDown={(e) => {
              e.preventDefault();
              onTouchAction('punch');
            }}
            className="hud-arc-btn hud-arc-punch cursor-pointer border-amber-300/80 bg-amber-500/35 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.35),inset_0_1px_4px_rgba(255,255,255,0.35)] hover:bg-amber-500/45"
          >
            <span className="hud-arc-label font-display text-sm font-extrabold uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              PUNCH
            </span>
          </button>

          {/* KICK — Sky-Blue Tint */}
          <button
            type="button"
            data-testid="btn-kick"
            onPointerDown={(e) => {
              e.preventDefault();
              onTouchAction('kick');
            }}
            className="hud-arc-btn hud-arc-kick cursor-pointer border-sky-300/80 bg-sky-500/35 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.35),inset_0_1px_4px_rgba(255,255,255,0.35)] hover:bg-sky-500/45"
          >
            <span className="hud-arc-label font-display text-sm font-extrabold uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              KICK
            </span>
          </button>

          {/* GRAB — Fresh Green Tint */}
          <button
            type="button"
            data-testid="btn-grab"
            onPointerDown={(e) => {
              e.preventDefault();
              onTouchAction('grab');
            }}
            className="hud-arc-btn hud-arc-grab cursor-pointer border-emerald-300/80 bg-emerald-500/35 text-emerald-50 shadow-[0_0_16px_rgba(16,185,129,0.35),inset_0_1px_4px_rgba(255,255,255,0.35)] hover:bg-emerald-500/45"
          >
            <span className="hud-arc-label font-display text-sm font-extrabold uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              GRAB
            </span>
          </button>

          {/* SIGNATURE MOVE (5th Button) — Vibrant Purple/Violet Tint + Dynamic 2-Line Move Name + 3.5s Radial Cooldown Ring */}
          {(() => {
            const maxCd = Math.max(0.5, localSpecialMaxCd || 3.5);
            const cdRemaining = Math.max(0, localSpecialCd);
            const sigReady = cdRemaining <= 0.01;
            const fillRatio = sigReady ? 1 : Math.max(0, Math.min(1, 1 - cdRemaining / maxCd));
            const ringRadius = 29;
            const ringCirc = 2 * Math.PI * ringRadius;
            const dashOffset = ringCirc * (1 - fillRatio);
            const words = localCfg.special.shortLabel.split(' ');
            const line1 = words[0] ?? localCfg.special.shortLabel;
            const line2 = words.slice(1).join(' ');
            return (
              <button
                type="button"
                data-testid="btn-signature"
                data-ready={sigReady ? 'true' : 'false'}
                aria-label={`${localCfg.special.shortLabel}${sigReady ? ' ready' : ` cooling down ${cdRemaining.toFixed(1)} seconds`}`}
                disabled={!sigReady}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (sigReady) onTouchAction('special');
                }}
                className={`hud-arc-btn hud-arc-signature relative overflow-hidden ${
                  sigReady
                    ? 'cursor-pointer border-violet-300/90 bg-purple-600/45 text-purple-50 shadow-[0_0_20px_rgba(168,85,247,0.68),inset_0_1px_5px_rgba(255,255,255,0.4)] hover:bg-purple-500/55'
                    : 'cursor-not-allowed border-purple-400/35 bg-purple-950/60 text-purple-200/60'
                }`}
              >
                {/* 3.5-Second Radial Cooldown Progress Ring */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(216, 180, 254, 0.22)"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke={sigReady ? '#e9d5ff' : '#a855f7'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={dashOffset}
                  />
                </svg>

                <span className="hud-arc-sig-label relative z-10 flex flex-col items-center justify-center px-1 text-center font-display text-[11px] font-extrabold uppercase leading-[0.98] tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  <span>{line1}</span>
                  {line2 && <span>{line2}</span>}
                </span>
                {!sigReady && (
                  <span className="hud-arc-sig-cd relative z-10 mt-0.5 font-mono-num text-[9px] font-bold leading-none text-purple-200">
                    {cdRemaining.toFixed(1)}s
                  </span>
                )}
              </button>
            );
          })()}

          {/* SUPER — Muted Translucent Grey While Charging; Bright Glowing Gold at 100% Shakti */}
          <button
            type="button"
            data-testid="btn-super"
            disabled={!localSuperReady}
            onPointerDown={(e) => {
              e.preventDefault();
              if (localSuperReady) onTouchAction('superMove');
            }}
            className={`hud-arc-btn hud-arc-super ${
              localSuperReady
                ? 'shakti-ready-pulse cursor-pointer border-[#fef9c3] bg-gradient-to-br from-[#fef08a]/92 via-[#facc15]/88 to-[#ea580c]/90 text-[#1c1004] shadow-[0_0_24px_rgba(250,204,21,0.95),inset_0_2px_5px_rgba(255,255,255,0.65)]'
                : 'cursor-not-allowed border-zinc-400/45 bg-zinc-800/45 text-zinc-300/80'
            }`}
          >
            <span className="hud-arc-label font-display text-sm font-extrabold uppercase tracking-wider">
              SUPER
            </span>
            {!localSuperReady && (
              <span className="font-mono-num text-[10px] font-bold opacity-80">
                {localShakti}%
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
