import type { FighterId } from './types';

export type RafScheduler = (callback: FrameRequestCallback) => number;
export type RafCanceller = (handle: number) => void;

/**
 * Coordinates frame-locked Super Power audio playback so the voiceover MP3
 * starts strictly inside the immediate next `requestAnimationFrame` callback
 * right after the first Super visual frame has been submitted by Three.js.
 *
 * This eliminates audio-ahead desync caused by first-frame visual/GPU work.
 */
export class SuperAudioSyncController {
  private queuedFighterId: FighterId | null = null;
  private pendingRafId: number | null = null;
  private token = 0;

  public queue(fighterId: FighterId): void {
    this.queuedFighterId = fighterId;
  }

  public hasQueued(): boolean {
    return this.queuedFighterId !== null;
  }

  public hasPendingRaf(): boolean {
    return this.pendingRafId !== null;
  }

  public flushAfterRender(
    scheduleRaf: RafScheduler,
    onPlay: (fighterId: FighterId) => void,
    shouldStillPlay: () => boolean,
  ): boolean {
    const fighterId = this.queuedFighterId;
    if (!fighterId) return false;
    this.queuedFighterId = null;

    const currentToken = ++this.token;
    this.pendingRafId = scheduleRaf(() => {
      this.pendingRafId = null;
      if (currentToken !== this.token) return;
      if (!shouldStillPlay()) return;
      onPlay(fighterId);
    });
    return true;
  }

  public cancel(cancelRaf?: RafCanceller): void {
    this.queuedFighterId = null;
    this.token += 1;
    if (this.pendingRafId !== null) {
      const id = this.pendingRafId;
      this.pendingRafId = null;
      cancelRaf?.(id);
    }
  }
}
