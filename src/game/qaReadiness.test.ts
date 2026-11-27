import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DesiAudioEngine } from './audio';
import { loadCareerStats, recordMatchCareerStats } from './careerStats';
import { FIGHTER_LIST, STAGE_CONFIGS } from './characters/configs';
import {
  STAGE_AI_TIER,
  computeCpuInput,
  createMatchState,
  getStageAiProfile,
} from './combat';
import { getEnglishSubtitle } from './dialogue';
import type { StageId } from './types';
import {
  clearSafeStorageFallbackForTests,
  loadAudioPrefs,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  saveAudioPrefs,
} from '../utils/safeStorage';

function createThrowingStorage(): Storage {
  const err = () => {
    throw new Error('SecurityError: The operation is insecure (Incognito sandbox)');
  };
  return {
    length: 0,
    clear: err,
    key: err,
    getItem: err,
    setItem: err,
    removeItem: err,
  };
}

describe('Poki & CrazyGames QA Readiness', () => {
  describe('1. Incognito-Safe Storage Wrapper', () => {
    it('falls back seamlessly to in-memory storage when localStorage throws', () => {
      clearSafeStorageFallbackForTests();
      const brokenStorage = createThrowingStorage();

      assert.equal(safeGetItem('qa_key', brokenStorage), null);
      const persistedNative = safeSetItem('qa_key', 'hello', brokenStorage);
      assert.equal(persistedNative, false);
      assert.equal(safeGetItem('qa_key', brokenStorage), 'hello');

      safeRemoveItem('qa_key', brokenStorage);
      assert.equal(safeGetItem('qa_key', brokenStorage), null);
    });

    it('persists and loads audio mute preferences safely under throwing storage', () => {
      clearSafeStorageFallbackForTests();
      const brokenStorage = createThrowingStorage();

      assert.deepEqual(loadAudioPrefs(brokenStorage), {
        globalMuted: false,
        sfxMuted: false,
        musicMuted: false,
      });

      saveAudioPrefs({ globalMuted: true, sfxMuted: false, musicMuted: true }, brokenStorage);
      assert.deepEqual(loadAudioPrefs(brokenStorage), {
        globalMuted: true,
        sfxMuted: false,
        musicMuted: true,
      });
    });

    it('keeps career stats crash-free when storage throws SecurityError', () => {
      clearSafeStorageFallbackForTests();
      const brokenStorage = createThrowingStorage();

      const statsAfterWin = recordMatchCareerStats(0, brokenStorage);
      assert.equal(statsAfterWin.wins, 1);
      assert.equal(statsAfterWin.losses, 0);

      const reloaded = loadCareerStats(brokenStorage);
      assert.equal(reloaded.wins, 1);
      assert.equal(reloaded.currentStreak, 1);
    });
  });

  describe('2. Global Audio Mute & Pause Controls', () => {
    it('tracks global mute state and reflects it in isMuted() and isGlobalMuted()', () => {
      const audio = new DesiAudioEngine();
      assert.equal(audio.isGlobalMuted(), false);
      assert.equal(audio.isMuted(), false);

      audio.setGlobalMuted(true, false);
      assert.equal(audio.isGlobalMuted(), true);
      assert.equal(audio.isMuted(), true);

      audio.pauseAllAudio();
      audio.resumeAllAudio(false);
      assert.equal(audio.isGlobalMuted(), true);

      audio.setGlobalMuted(false, false);
      assert.equal(audio.isGlobalMuted(), false);
      assert.equal(audio.isMuted(), false);
    });
  });

  describe('3. 5-Stage Progressive AI Difficulty Scaling', () => {
    const FIVE_STAGES: StageId[] = ['mohalla', 'school', 'studio', 'shaadi', 'railway'];

    it('assigns stages 1 through 5 strictly increasing AI tiers', () => {
      FIVE_STAGES.forEach((stageId, idx) => {
        assert.equal(STAGE_AI_TIER[stageId], idx + 1);
      });
      assert.equal(STAGE_AI_TIER.assembly, 5);
    });

    it('monotonically sharpens reaction delay, block/dodge chance, combo frequency, and super usage from Stage 1 to Stage 5', () => {
      const profiles = FIVE_STAGES.map((stage) => getStageAiProfile(stage, 'normal'));

      for (let i = 1; i < profiles.length; i += 1) {
        const prev = profiles[i - 1];
        const curr = profiles[i];
        assert.ok(
          curr.thinkMax < prev.thinkMax,
          `Stage ${i + 1} thinkMax (${curr.thinkMax}) should be faster than Stage ${i} (${prev.thinkMax})`,
        );
        assert.ok(
          curr.blockChance > prev.blockChance,
          `Stage ${i + 1} blockChance (${curr.blockChance}) should exceed Stage ${i} (${prev.blockChance})`,
        );
        assert.ok(
          curr.dodgeChance > prev.dodgeChance,
          `Stage ${i + 1} dodgeChance (${curr.dodgeChance}) should exceed Stage ${i} (${prev.dodgeChance})`,
        );
        assert.ok(
          curr.comboFrequency > prev.comboFrequency,
          `Stage ${i + 1} comboFrequency (${curr.comboFrequency}) should exceed Stage ${i} (${prev.comboFrequency})`,
        );
        assert.ok(
          curr.superChance > prev.superChance,
          `Stage ${i + 1} superChance (${curr.superChance}) should exceed Stage ${i} (${prev.superChance})`,
        );
      }
    });

    it('uses Stage 5 dodge & strategic 33%-capped Super behavior inside computeCpuInput', () => {
      const state = createMatchState('sheru', 'billa');
      state.phase = 'fighting';
      state.fighters[0].x = -1.2;
      state.fighters[1].x = 1.2;
      state.aiThinkTimer = 0;
      state.fighters[1].shakti = 100;

      // With low rng value and 100% Shakti in optimal strike range, Stage 5 AI fires its Super
      const superInput = computeCpuInput(state, 'hard', 0.016, () => 0.01, 'railway');
      assert.equal(superInput.superMove, true);

      // Incoming projectile triggers a jump-dodge on Stage 5 when rng < dodgeChance
      state.fighters[1].shakti = 0;
      state.aiThinkTimer = 0;
      state.projectiles.push({
        uid: 1,
        ownerSlot: 0,
        kind: 'belan',
        x: 0.4,
        y: 1.0,
        vx: 7.5,
        vy: 0,
        radius: 0.35,
        damage: 12,
        stunDuration: 0.3,
        knockbackX: 3.5,
        knockbackY: 1.5,
        life: 1.2,
        maxLife: 1.2,
        spin: 0,
        active: true,
      });
      const dodgeInput = computeCpuInput(state, 'normal', 0.016, () => 0.05, 'railway');
      assert.equal(dodgeInput.up, true);
    });
  });

  describe('4. English Subtitles & Global UI Clarity', () => {
    it('provides crisp English subtitles for Hindi/Hinglish lines across all 7 fighters', () => {
      const sampleLines = [
        'Tera budget khatam, meri entry shuru!',
        'Aaj teri chhutti, swatter tayyar hai!',
        'Aam aadmi ka gussa mat jaga beta!',
        'Crack mat bolna, hard-boiled hoon main!',
        'Laddoo khayega ya belan khayega beta?',
        'Uniform kahan hai?! Diary nikaal abhi!',
        'Subah 5 baje deadlift, shaam ko Laxmikanth — ready hai kya?',
        'Ye le 18% GST ke saath pitai!',
        'Phatak! Machhar jaise uda diya!',
        'Dharna mode ON — ab bhaag mat!',
        'Omelette banne se pehle hi flat kar diya!',
        'Aaj belan ka VIP treatment milega!',
        'Line seedhi karo — discipline pehle, baaki baad mein!',
        'Article 21 tera defense suspend kar diya!',
        'Last bench se direct knockout dene aaya hoon!',
      ];
      for (const line of sampleLines) {
        const sub = getEnglishSubtitle(line);
        assert.ok(sub && sub.length > 5, `Missing English subtitle for: "${line}"`);
      }
      assert.equal(FIGHTER_LIST.length, 8);
    });

    it('keeps all 5 main stage display names clear and readable for global players', () => {
      assert.equal(STAGE_CONFIGS.mohalla.name, 'Desi Mohalla');
      assert.equal(STAGE_CONFIGS.school.name, 'Coaching Class');
      assert.equal(STAGE_CONFIGS.studio.name, 'News & Meme Studio');
      assert.equal(STAGE_CONFIGS.shaadi.name, 'Shaadi ka Pandal');
      assert.equal(STAGE_CONFIGS.railway.name, 'Railway Station Platform');
    });
  });
});
