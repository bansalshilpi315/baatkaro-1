import { useEffect, useState } from 'react';
import { CheckCircle2, Coins, Lock, Sparkles, Tv, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { FIGHTER_CONFIGS } from '../game/characters';
import {
  FIGHTER_UNLOCK_ADS,
  FIGHTER_UNLOCK_COSTS,
  getFighterAdProgress,
  type PlayerProfile,
} from '../game/playerAccount';
import type { FighterId } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface UnlockFighterModalProps {
  fighterId: FighterId;
  playerProfile: PlayerProfile;
  onUnlockWithCoins: (id: FighterId) => boolean;
  onWatchRewardedAd: (id: FighterId) => { watched: number; required: number; unlockedNow: boolean };
  onClose: () => void;
}

const AD_SIMULATION_SECONDS = 2;

export function UnlockFighterModal({
  fighterId,
  playerProfile,
  onUnlockWithCoins,
  onWatchRewardedAd,
  onClose,
}: UnlockFighterModalProps) {
  const cfg = FIGHTER_CONFIGS[fighterId];
  const coinCost = FIGHTER_UNLOCK_COSTS[fighterId] ?? 150;
  const requiredAds = FIGHTER_UNLOCK_ADS[fighterId] ?? 2;
  const adProgress = getFighterAdProgress(playerProfile, fighterId);
  const canAffordCoins = playerProfile.coins >= coinCost;
  const isAlreadyUnlocked = playerProfile.unlockedFighters.includes(fighterId);

  const [watchingAd, setWatchingAd] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(AD_SIMULATION_SECONDS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!watchingAd) return;
    audioEngine.pauseAllAudio();
    setAdSecondsLeft(AD_SIMULATION_SECONDS);

    let remaining = AD_SIMULATION_SECONDS;
    const intervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setAdSecondsLeft(remaining);
        return;
      }
      window.clearInterval(intervalId);
      setWatchingAd(false);
      audioEngine.resumeAllAudio(true);

      const res = onWatchRewardedAd(fighterId);
      if (res.unlockedNow) {
        setStatusMessage(`${cfg.name} UNLOCKED PERMANENTLY!`);
        window.setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setStatusMessage(`Ad counted! Progress: ${res.watched}/${res.required} Ads.`);
      }
    }, 900);

    return () => {
      window.clearInterval(intervalId);
      audioEngine.resumeAllAudio(true);
    };
  }, [watchingAd, fighterId, cfg.name, onWatchRewardedAd, onClose]);

  const handleCoinUnlock = () => {
    if (!canAffordCoins || watchingAd) return;
    const unlocked = onUnlockWithCoins(fighterId);
    if (unlocked) {
      setStatusMessage(`${cfg.name} UNLOCKED PERMANENTLY!`);
      window.setTimeout(() => {
        onClose();
      }, 650);
    }
  };

  const handleStartAd = () => {
    if (watchingAd || isAlreadyUnlocked) return;
    setStatusMessage(null);
    setWatchingAd(true);
  };

  const adPct =
    requiredAds > 0 ? Math.min(100, Math.round((adProgress.watched / requiredAds) * 100)) : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Unlock ${cfg.name}`}
      data-testid="unlock-fighter-modal"
      className="safe-pad-modal fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md border-3 border-[#facc15] bg-[#140e0b]/98 p-4 text-white shadow-[0_22px_54px_rgba(0,0,0,0.9),6px_6px_0_#dc2626] sm:p-5">
        <button
          type="button"
          onClick={onClose}
          disabled={watchingAd}
          aria-label="Close Unlock Modal"
          data-testid="unlock-modal-close-btn"
          className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center border border-white/25 bg-[#1f1713] text-[#d6d3d1] transition hover:border-[#facc15] hover:text-[#facc15] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Fighter Header */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="relative h-18 w-18 shrink-0 overflow-hidden border-2 border-[#facc15] bg-[#1e1712] shadow-[3px_3px_0_#0a0705]">
            <FighterPortrait
              id={fighterId}
              alt={cfg.name}
              className="h-full w-full object-cover"
            />
            {!isAlreadyUnlocked && (
              <span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center bg-black/85 text-[#facc15]">
                <Lock className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1 bg-[#dc2626] px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">
              <Sparkles className="h-3 w-3 text-[#facc15]" aria-hidden="true" />
              <span>UNLOCK FIGHTER</span>
            </div>
            <h2 className="mt-1 truncate font-display text-2xl font-extrabold uppercase italic leading-none tracking-wide text-[#facc15] sm:text-3xl">
              {cfg.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono-num text-[11px] font-bold text-[#e7e5e4]">
              <span className="bg-white/10 px-1.5 py-0.5 text-[#fde047]">HP {cfg.maxHp}</span>
              <span className="truncate text-[#d6d3d1]">{cfg.superName}</span>
            </div>
          </div>
        </div>

        {/* Wallet & Ad Progress Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-white/15 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-mono-num font-bold text-[#facc15]">
            <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>YOUR COINS: {playerProfile.coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 font-mono-num font-bold text-[#38bdf8]">
            <Tv className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-testid="unlock-modal-ad-progress">
              ADS: {adProgress.watched}/{requiredAds}
            </span>
          </div>
        </div>

        {/* Rewarded Ad Progress Bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#d6d3d1]">
            <span>Rewarded Ad Unlock Progress</span>
            <span className="font-mono-num text-[#38bdf8]">{adPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden border border-white/20 bg-[#0b0807]">
            <div
              className="h-full bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#facc15] transition-[width] duration-300"
              style={{ width: `${adPct}%` }}
            />
          </div>
        </div>

        {/* Simulated Rewarded Ad Player State */}
        {watchingAd && (
          <div
            data-testid="rewarded-ad-countdown"
            className="mt-3 flex items-center justify-between border-2 border-[#38bdf8] bg-[#082f49]/85 px-3 py-2.5 text-xs font-bold text-[#e0f2fe]"
          >
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 animate-pulse text-[#38bdf8]" aria-hidden="true" />
              <span>Playing Rewarded Ad... Hold tight!</span>
            </div>
            <span className="font-mono-num text-sm font-extrabold text-[#facc15]">
              {adSecondsLeft}s
            </span>
          </div>
        )}

        {statusMessage && (
          <div
            data-testid="unlock-modal-status"
            className="mt-3 flex items-center gap-2 border border-[#4ade80]/70 bg-[#14532d]/80 px-3 py-2 text-xs font-bold text-[#bbf7d0]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ade80]" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Dual Action Buttons: Coins OR Rewarded Ad */}
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            data-testid="modal-unlock-coins-btn"
            disabled={!canAffordCoins || watchingAd || isAlreadyUnlocked}
            onClick={handleCoinUnlock}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#0f0a06] bg-[#facc15] px-4 py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#110b08] shadow-[4px_4px_0_#dc2626] transition hover:bg-[#fde047] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {canAffordCoins
                ? `Unlock with ${coinCost} Coins`
                : `Need ${coinCost - playerProfile.coins} More Coins (${coinCost})`}
            </span>
          </button>

          <button
            type="button"
            data-testid="modal-watch-ad-btn"
            disabled={watchingAd || isAlreadyUnlocked}
            onClick={handleStartAd}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-[#38bdf8] bg-[#0c4a6e]/90 px-4 py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0_#0284c7] transition hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Tv className="h-4 w-4 shrink-0 text-[#fde047]" aria-hidden="true" />
            <span>
              {watchingAd
                ? `Watching Ad (${adSecondsLeft}s)...`
                : `Watch Ad (${adProgress.watched}/${requiredAds})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
