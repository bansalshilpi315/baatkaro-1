import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Pause, Volume2, VolumeX } from 'lucide-react';
import { FIGHTER_CONFIGS, getFighterPortraitDataUrl, STAGE_CONFIGS } from '../game/characters';
import type { FighterId, FloatingCallout, HudSnapshot, StageId } from '../game/types';
import { FullscreenButton } from './FullscreenButton';

interface FightHudProps {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  hud: HudSnapshot;
  callouts: FloatingCallout[];
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

export function FightHud({
  p1Id,
  p2Id,
  stageId,
  hud,
  callouts,
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
    hud.showBroadcastIntro ||
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
  const timerUrgent = hud.roundTime <= 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none">
      {/* =================================================================
          TOP ARCADE HUD BAR (SPACIOUS, CLEAN, ZERO BOTTOM TICKER)
          ================================================================= */}
      <header className="safe-pad-hud-top w-full">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-2 sm:gap-3">
          {/* ---------------- LEFT: P1 PORTRAIT + HP + ROUNDS + SHAKTI ---------------- */}
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
            {/* Far-Left Square Portrait with Thin Gold Border */}
            <div className="hud-portrait relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border-2 border-[#facc15] bg-[#14100d] shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:h-16 sm:w-16">
              <img
                src={getFighterPortraitDataUrl(p1Id)}
                alt={p1Cfg.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* Fighter Name + P1 Tag */}
              <div className="mb-1 flex items-baseline justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="hud-role-tag font-display text-xs font-extrabold uppercase tracking-wider text-[#facc15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-sm">
                    P1
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
          </div>

          {/* ---------------- RIGHT: CPU HP + ROUNDS + SHAKTI + PORTRAIT ---------------- */}
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
            <div className="min-w-0 flex-1">
              {/* Fighter Name + CPU Tag */}
              <div className="mb-1 flex items-baseline justify-end gap-1.5 px-0.5">
                <span className="hud-fighter-name truncate font-display text-base font-extrabold uppercase tracking-wide text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] sm:text-xl">
                  {p2Cfg.name}
                </span>
                <span className="hud-role-tag font-display text-xs font-extrabold uppercase tracking-wider text-[#facc15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-sm">
                  CPU
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
              <img
                src={getFighterPortraitDataUrl(p2Id)}
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
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="hud-util-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white/40 bg-[#14100d]/90 text-white transition-colors hover:border-[#facc15] hover:text-[#facc15]"
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5 text-[#f87171]" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Combo Counters */}
        <div className="hud-combo-row mx-auto mt-1 flex w-full max-w-6xl justify-between px-16 sm:px-20">
          <div className="h-6">
            {hud.p1Combo >= 2 && (
              <div className="hud-combo-text news-stroke font-display text-xl font-extrabold italic text-[#facc15] sm:text-2xl">
                {hud.p1Combo} HIT COMBO!
              </div>
            )}
          </div>
          <div className="h-6">
            {hud.p2Combo >= 2 && (
              <div className="hud-combo-text news-stroke font-display text-xl font-extrabold italic text-[#fb7185] sm:text-2xl">
                {hud.p2Combo} HIT COMBO!
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =================================================================
          FLOATING COMIC-BOOK CALLOUTS (DHISHUM!, PAISA VASOOL!, ETC.)
          ================================================================= */}
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        {callouts.map((c) => (
          <div
            key={c.id}
            className="comic-pop-text absolute text-2xl sm:text-4xl"
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

      {/* =================================================================
          PRE-FIGHT BROADCAST INTRO CARD (ROUND 1)
          ================================================================= */}
      {hud.showBroadcastIntro && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl border-4 border-[#110b08] bg-[#140e0b]/95 shadow-[8px_8px_0_#dc2626]">
            <div className="flex items-center justify-between border-b-2 border-[#facc15] bg-[#dc2626] px-4 py-1.5">
              <span className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-white sm:text-sm">
                BREAKING BAKWAS · ROUND 1 SHOWDOWN
              </span>
              <span className="font-display text-xs font-extrabold uppercase tracking-widest text-[#facc15]">
                {stageCfg.name}
              </span>
            </div>
            <div className="hud-intro-body flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <img
                  src={getFighterPortraitDataUrl(p1Id)}
                  alt={p1Cfg.name}
                  className="hud-intro-avatar h-14 w-14 border-2 border-[#facc15] object-cover sm:h-16 sm:w-16"
                />
                <div>
                  <div className="font-display text-xs font-bold uppercase text-[#facc15]">P1</div>
                  <div className="hud-intro-name font-display text-xl font-extrabold uppercase text-white sm:text-2xl">
                    {p1Cfg.name}
                  </div>
                </div>
              </div>

              <div className="border-2 border-[#110b08] bg-[#facc15] px-3 py-1 font-display text-2xl font-extrabold italic text-[#110b08] shadow-[3px_3px_0_#dc2626]">
                VS
              </div>

              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="font-display text-xs font-bold uppercase text-[#facc15]">CPU</div>
                  <div className="hud-intro-name font-display text-xl font-extrabold uppercase text-white sm:text-2xl">
                    {p2Cfg.name}
                  </div>
                </div>
                <img
                  src={getFighterPortraitDataUrl(p2Id)}
                  alt={p2Cfg.name}
                  className="hud-intro-avatar h-14 w-14 -scale-x-100 border-2 border-[#facc15] object-cover sm:h-16 sm:w-16"
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/15 bg-[#1c1510] px-4 py-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[#fde047] sm:text-sm">
                &ldquo;{hud.introTagline}&rdquo;
              </span>
              <button
                type="button"
                onClick={onSkipIntro}
                className="flex cursor-pointer items-center gap-1 border border-[#facc15] bg-[#facc15] px-2.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#110b08] hover:bg-[#fde047]"
              >
                <span>SKIP</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          SHERU BHAI SUPER POWER CINEMATIC BANNER
          ================================================================= */}
      {hud.superBannerText && (
        <div
          data-testid="sheru-super-banner"
          className="pointer-events-none fixed inset-x-0 top-[18%] z-30 flex flex-col items-center justify-center px-4"
        >
          <div className="border-4 border-[#110b08] bg-gradient-to-r from-[#b45309] via-[#facc15] to-[#b45309] px-7 py-2 shadow-[0_0_40px_rgba(250,204,21,0.85),6px_6px_0_#110b08]">
            <div className="text-center font-display text-xs font-extrabold uppercase tracking-[0.28em] text-[#1c1005] sm:text-sm">
              SHERU BHAI · SUPER POWER
            </div>
            <div className="news-stroke text-center font-display text-3xl font-extrabold uppercase italic tracking-wider text-white sm:text-5xl">
              {hud.superBannerText}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          ROUND / FIGHT KARO! / K.O.! CENTER BANNER
          ================================================================= */}
      {hud.bannerText && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="hud-banner-box news-stroke -rotate-2 border-4 border-[#110b08] bg-[#dc2626] px-8 py-2 font-display text-5xl font-extrabold uppercase italic tracking-wider text-[#facc15] shadow-[8px_8px_0_#110b08] sm:text-7xl">
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

        {/* Bottom-Right: 4 Translucent Circular Arcade Buttons in an Ergonomic Thumb Arc */}
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

          {/* SUPER — Muted Translucent Grey While Charging; Bright Glowing Gold at 100% Shakti */}
          <button
            type="button"
            data-testid="btn-super"
            disabled={!p1SuperReady}
            onPointerDown={(e) => {
              e.preventDefault();
              if (p1SuperReady) onTouchAction('superMove');
            }}
            className={`hud-arc-btn hud-arc-super ${
              p1SuperReady
                ? 'shakti-ready-pulse cursor-pointer border-[#fef9c3] bg-gradient-to-br from-[#fef08a]/92 via-[#facc15]/88 to-[#ea580c]/90 text-[#1c1004] shadow-[0_0_24px_rgba(250,204,21,0.95),inset_0_2px_5px_rgba(255,255,255,0.65)]'
                : 'cursor-not-allowed border-zinc-400/45 bg-zinc-800/45 text-zinc-300/80'
            }`}
          >
            <span className="hud-arc-label font-display text-sm font-extrabold uppercase tracking-wider">
              SUPER
            </span>
            {!p1SuperReady && (
              <span className="font-mono-num text-[10px] font-bold opacity-80">
                {hud.p1Shakti}%
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
