import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BGM_AUDIO_URL,
  BGM_DEFAULT_GAIN,
  BGM_DUCKED_GAIN,
  DAHI_KO_AUDIO_URL,
  DesiAudioEngine,
  SHERU_SUPER_AUDIO_URL,
  clearSuperAudioCacheForTests,
} from './audio';

interface GainCall {
  method: string;
  args: number[];
}

interface MockSource {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  startedAt: number[];
  stoppedCount: number;
  disconnected: boolean;
  connect: (dest: unknown) => void;
  disconnect: () => void;
  start: (when?: number) => void;
  stop: () => void;
}

function createMockAudioEnv(fetchImpl: typeof fetch) {
  const gainNodes: Array<{ calls: GainCall[]; disconnected: boolean }> = [];
  const sources: MockSource[] = [];
  let resumeCalls = 0;
  let suspendCalls = 0;
  let decodeCalls = 0;

  class MockAudioContext {
    public state: 'suspended' | 'running' = 'suspended';
    public currentTime = 1.25;
    public destination = { kind: 'destination' };

    public resume() {
      resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    public suspend() {
      suspendCalls += 1;
      this.state = 'suspended';
      return Promise.resolve();
    }

    public createGain() {
      const record = { calls: [] as GainCall[], disconnected: false };
      gainNodes.push(record);
      return {
        gain: {
          value: 1,
          setValueAtTime: (val: number, time: number) => {
            record.calls.push({ method: 'setValueAtTime', args: [val, time] });
          },
          setTargetAtTime: (val: number, time: number, tc: number) => {
            record.calls.push({ method: 'setTargetAtTime', args: [val, time, tc] });
          },
        },
        connect: () => {},
        disconnect: () => {
          record.disconnected = true;
        },
      };
    }

    public createBufferSource(): MockSource {
      const src: MockSource = {
        buffer: null,
        loop: false,
        onended: null,
        startedAt: [],
        stoppedCount: 0,
        disconnected: false,
        connect: () => {},
        disconnect: () => {
          src.disconnected = true;
        },
        start: (when = 0) => {
          src.startedAt.push(when);
        },
        stop: () => {
          src.stoppedCount += 1;
        },
      };
      sources.push(src);
      return src;
    }

    public decodeAudioData(_buf: ArrayBuffer) {
      decodeCalls += 1;
      return Promise.resolve({ duration: 8.2, numberOfChannels: 2, sampleRate: 44100 });
    }
  }

  const prevWindow = (globalThis as { window?: unknown }).window;
  const prevFetch = globalThis.fetch;

  (globalThis as { window?: unknown }).window = {
    AudioContext: MockAudioContext,
  };
  globalThis.fetch = fetchImpl;

  return {
    gainNodes,
    sources,
    getResumeCalls: () => resumeCalls,
    getSuspendCalls: () => suspendCalls,
    getDecodeCalls: () => decodeCalls,
    restore: () => {
      (globalThis as { window?: unknown }).window = prevWindow;
      globalThis.fetch = prevFetch;
    },
  };
}

test('Super MP3 preloads once into RAM AudioBuffer cache, ducks BGM via setTargetAtTime, guards overlap, and finishes naturally on onended', async () => {
  clearSuperAudioCacheForTests();
  let fetchCount = 0;

  const env = createMockAudioEnv((async () => {
    fetchCount += 1;
    const bytes = new Uint8Array(256);
    return {
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();

    // Preload once and verify second call hits persistent module cache
    const buf1 = await engine.preloadSuperAudio(SHERU_SUPER_AUDIO_URL);
    const buf2 = await engine.preloadSuperAudio(SHERU_SUPER_AUDIO_URL);
    assert.ok(buf1, 'Decoded AudioBuffer should be returned');
    assert.equal(buf1, buf2, 'Second preload must reuse cached AudioBuffer');
    assert.equal(fetchCount, 1, 'MP3 must only be fetched once');
    assert.equal(env.getDecodeCalls(), 1, 'MP3 must only be decoded once');

    // Trigger Sheru Super playback
    engine.playSheruSuperAudio();
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 1);
    assert.deepEqual(env.sources[0].startedAt, [0], 'AudioBufferSourceNode must call start(0)');
    assert.ok(env.getResumeCalls() >= 1, 'AudioContext.resume() must be called');

    // Verify BGM ducking scheduled ONCE via setTargetAtTime(BGM_DUCKED_GAIN, now, 0.08)
    const bgmGain = env.gainNodes[0];
    const duckCalls = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DUCKED_GAIN && c.args[2] === 0.08,
    );
    assert.equal(duckCalls.length, 1, 'BGM must duck once with setTargetAtTime(BGM_DUCKED_GAIN, now, 0.08)');

    // Overlap guard: triggering again while active must NOT create a second source
    engine.playSheruSuperAudio();
    assert.equal(env.sources.length, 1, 'Active Super playback must prevent overlapping sources');

    // Animation ending must NOT stop or cut off the active AudioBufferSourceNode
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[0].stoppedCount, 0, 'notifySuperAnimationEnd must never call source.stop()');
    assert.equal(engine.isSuperAudioPlaying(), true, 'Source must keep playing until natural onended');

    // Simulate natural audio end -> restores BGM via setTargetAtTime(BGM_DEFAULT_GAIN, now, 0.2)
    env.sources[0].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);
    assert.equal(env.sources[0].disconnected, true);
    const restoreCalls = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DEFAULT_GAIN && c.args[2] === 0.2,
    );
    assert.equal(restoreCalls.length, 1, 'source.onended must restore BGM via setTargetAtTime(BGM_DEFAULT_GAIN, now, 0.2)');
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

test('Explicit stopSuperAudio stops active source cleanly; missing MP3 fails silently without crash', async () => {
  clearSuperAudioCacheForTests();
  const env = createMockAudioEnv((async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('missing')) {
      return {
        ok: false,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response;
    }
    const bytes = new Uint8Array(256);
    return {
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();

    // Missing MP3 fails silently and restores BGM cleanly when Super animation finishes
    const missingBuf = await engine.preloadSuperAudio('/audio/supers/missing.mp3');
    assert.equal(missingBuf, null);
    engine.playSuperAudio('/audio/supers/missing.mp3');
    assert.equal(engine.isSuperAudioPlaying(), false);
    engine.notifySuperAnimationEnd();

    // Valid MP3 stopped explicitly on match restart / exit to Select
    await engine.preloadSuperAudio(SHERU_SUPER_AUDIO_URL);
    engine.playSheruSuperAudio();
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 1);

    engine.stopSuperAudio();
    assert.equal(env.sources[0].stoppedCount, 1, 'Explicit stopSuperAudio must call source.stop()');
    assert.equal(engine.isSuperAudioPlaying(), false);
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

test('All 9 fighter Super MP3s (sheru, billa, neta, anda, mausi, father, samyak, adi, krish) + dahi.mp3 share Web Audio AudioBuffer cache & ducking', async () => {
  clearSuperAudioCacheForTests();
  const fetchedUrls: string[] = [];

  const env = createMockAudioEnv((async (url: string | URL | Request) => {
    fetchedUrls.push(String(url));
    const bytes = new Uint8Array(256);
    return {
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();
    await engine.preloadAllSuperAudios();

    assert.ok(fetchedUrls.includes(BGM_AUDIO_URL));
    assert.ok(fetchedUrls.includes('./audio/supers/sheru.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/billa.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/neta.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/anda.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/mausi.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/father.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/ias.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/adi.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/krish.mp3'));
    assert.ok(fetchedUrls.includes('./audio/supers/utkarsh.mp3'));
    assert.ok(!fetchedUrls.includes('./audio/supers/principal.mp3'), 'Principal Man must reuse father.mp3 without fetching principal.mp3');
    assert.ok(fetchedUrls.includes(DAHI_KO_AUDIO_URL));

    // Blue Billa Super audio plays from RAM cache without refetching and ends cleanly on onended
    engine.playFighterSuperAudio('billa');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 1);
    assert.deepEqual(env.sources[0].startedAt, [0]);
    env.sources[0].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Garib Sena Neta Super audio plays from RAM cache without refetching
    engine.playFighterSuperAudio('neta');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 2);
    assert.deepEqual(env.sources[1].startedAt, [0]);
    env.sources[1].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Anda Bhai Super audio (/audio/supers/anda.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('anda');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 3);
    assert.deepEqual(env.sources[2].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[2].stoppedCount, 0, 'Anda Super MP3 must never be cut off early');
    env.sources[2].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Laddoo Mausi Super audio (/audio/supers/mausi.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('mausi');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 4);
    assert.deepEqual(env.sources[3].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[3].stoppedCount, 0, 'Mausi Super MP3 must never be cut off early');
    env.sources[3].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Principal Man (id: father) Super audio (/audio/supers/father.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('father');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 5);
    assert.deepEqual(env.sources[4].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[4].stoppedCount, 0, 'Principal Man Super MP3 must never be cut off early');
    env.sources[4].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Samyak Super audio (/audio/supers/ias.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('samyak');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 6);
    assert.deepEqual(env.sources[5].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[5].stoppedCount, 0, 'Samyak Super MP3 must never be cut off early');
    env.sources[5].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Adi Super audio (/audio/supers/adi.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('adi');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 7);
    assert.deepEqual(env.sources[6].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[6].stoppedCount, 0, 'Adi Super MP3 must never be cut off early');
    env.sources[6].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Krish Super audio (/audio/supers/krish.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('krish');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 8);
    assert.deepEqual(env.sources[7].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[7].stoppedCount, 0, 'Krish Super MP3 must never be cut off early');
    env.sources[7].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    // Utkarsh Super audio (/audio/supers/utkarsh.mp3) plays from RAM cache and finishes naturally
    engine.playFighterSuperAudio('utkarsh');
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(env.sources.length, 9);
    assert.deepEqual(env.sources[8].startedAt, [0]);
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[8].stoppedCount, 0, 'Utkarsh Super MP3 must never be cut off early');
    env.sources[8].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);

    assert.equal(fetchedUrls.length, 12, 'Preloaded buffers (bgm + 10 supers + dahi KO) must never trigger duplicate fetches');
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

test('DAHI KHATAM! KO MP3 (/audio/supers/dahi.mp3) plays from RAM cache, ducks BGM, prevents duplicate triggers, coordinates with Super MP3, and stops only on explicit stopDahiKoAudio', async () => {
  clearSuperAudioCacheForTests();
  let dahiFetchCount = 0;

  const env = createMockAudioEnv((async (url: string | URL | Request) => {
    if (String(url) === DAHI_KO_AUDIO_URL) {
      dahiFetchCount += 1;
    }
    const bytes = new Uint8Array(256);
    return {
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();
    await engine.preloadAllSuperAudios();
    assert.equal(dahiFetchCount, 1, 'dahi.mp3 must be preloaded once into shared RAM cache');

    // Trigger KO audio -> fresh AudioBufferSourceNode, BGM ducked to BGM_DUCKED_GAIN
    engine.playDahiKoAudio();
    assert.equal(engine.isDahiKoAudioPlaying(), true);
    assert.equal(env.sources.length, 1);
    assert.deepEqual(env.sources[0].startedAt, [0]);

    const bgmGain = env.gainNodes[0];
    const duckCalls = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DUCKED_GAIN && c.args[2] === 0.08,
    );
    assert.equal(duckCalls.length, 1, 'BGM must duck to BGM_DUCKED_GAIN when dahi.mp3 starts');

    // Duplicate rapid trigger on the same KO must be ignored
    engine.playDahiKoAudio();
    assert.equal(env.sources.length, 1, 'Rapid duplicate KO triggers must not spawn overlapping sources');

    // Natural finish via onended restores BGM smoothly via setTargetAtTime(BGM_DEFAULT_GAIN, now, 0.2)
    env.sources[0].onended?.();
    assert.equal(engine.isDahiKoAudioPlaying(), false);
    assert.equal(env.sources[0].disconnected, true);
    const restoreCallsAfterFirst = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DEFAULT_GAIN && c.args[2] === 0.2,
    );
    assert.equal(restoreCallsAfterFirst.length, 1, 'BGM must restore cleanly on dahi.mp3 onended');

    // Overlap with Super MP3 (e.g. Super Power deals KO blow): BGM stays ducked until BOTH end
    engine.playSheruSuperAudio();
    engine.playDahiKoAudio();
    assert.equal(engine.isSuperAudioPlaying(), true);
    assert.equal(engine.isDahiKoAudioPlaying(), true);
    assert.equal(env.sources.length, 3);

    // Super ends first -> BGM must stay ducked while dahi.mp3 is still playing
    env.sources[1].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);
    assert.equal(engine.isDahiKoAudioPlaying(), true);
    const restoreWhileDahiActive = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DEFAULT_GAIN && c.args[2] === 0.2,
    );
    assert.equal(restoreWhileDahiActive.length, 1, 'BGM must remain ducked until dahi.mp3 also finishes');

    // Explicit stopDahiKoAudio (Rematch / Exit to Select) stops playback & restores BGM
    engine.stopDahiKoAudio();
    assert.equal(env.sources[2].stoppedCount, 1);
    assert.equal(engine.isDahiKoAudioPlaying(), false);
    const restoreAfterStop = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DEFAULT_GAIN && c.args[2] === 0.2,
    );
    assert.equal(restoreAfterStop.length, 2, 'Explicit stopDahiKoAudio must restore BGM');
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

test('Missing /audio/supers/dahi.mp3 fails silently with zero errors and does not leave BGM stuck ducked', async () => {
  clearSuperAudioCacheForTests();

  const env = createMockAudioEnv((async () => {
    return {
      ok: false,
      status: 404,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();
    const buf = await engine.preloadSuperAudio(DAHI_KO_AUDIO_URL);
    assert.equal(buf, null);

    // Calling playDahiKoAudio when missing must not throw, play a source, or duck BGM
    engine.playDahiKoAudio();
    assert.equal(engine.isDahiKoAudioPlaying(), false);
    assert.equal(env.sources.length, 0);
    const allDuckCalls = env.gainNodes.flatMap((g) =>
      g.calls.filter((c) => c.method === 'setTargetAtTime' && c.args[0] === BGM_DUCKED_GAIN),
    );
    assert.equal(allDuckCalls.length, 0, 'Missing dahi.mp3 must never leave BGM stuck ducked');
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

test('Gapless continuous /audio/bgm.mp3 loops via AudioBufferSourceNode at 0.35 gain, never restarts on screen changes, and preserves track position on mute & tab pause', async () => {
  clearSuperAudioCacheForTests();
  const env = createMockAudioEnv((async () => {
    const bytes = new Uint8Array(512);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch);

  try {
    const engine = new DesiAudioEngine();
    const bgmBuf = await engine.preloadBgmAudio();
    assert.ok(bgmBuf, '/audio/bgm.mp3 must decode into AudioBuffer');

    // Start music -> creates ONE looping AudioBufferSourceNode routed through bgmGain (0.35)
    engine.startMusic();
    assert.equal(engine.isBgmLooping(), true);
    assert.equal(engine.isUsingMp3Bgm(), true);
    assert.equal(env.sources.length, 1);
    assert.equal(env.sources[0].loop, true, 'BGM AudioBufferSourceNode must set source.loop = true for gapless looping');
    assert.deepEqual(env.sources[0].startedAt, [0]);

    const bgmGain = env.gainNodes[0];
    const initGainCall = bgmGain.calls.find(
      (c) => c.method === 'setValueAtTime' && c.args[0] === BGM_DEFAULT_GAIN,
    );
    assert.ok(initGainCall, 'bgmGain must initialize at BGM_DEFAULT_GAIN (0.35)');

    // Calling startMusic() again across screen transitions (Menu -> Select -> Combat -> Victory) must NEVER stop or recreate the looping node
    engine.startMusic();
    engine.startMusic();
    assert.equal(env.sources.length, 1, 'BGM must never restart or duplicate across screen transitions');
    assert.equal(env.sources[0].stoppedCount, 0);

    // Muting sets gain to 0 WITHOUT stopping/restarting the continuous AudioBufferSourceNode
    engine.setGlobalMuted(true);
    assert.equal(env.sources[0].stoppedCount, 0, 'Global mute must preserve continuous BGM track position');
    assert.ok(
      bgmGain.calls.some((c) => c.method === 'setTargetAtTime' && c.args[0] === 0),
      'Global mute must set bgmGain to 0',
    );
    engine.setGlobalMuted(false);
    assert.equal(env.sources.length, 1, 'Unmuting must keep the exact same looping BGM source');

    // Tab hidden / pauseAllAudio suspends AudioContext without stopping bgmBufferSource
    const suspendsBefore = env.getSuspendCalls();
    engine.pauseAllAudio();
    assert.equal(env.getSuspendCalls(), suspendsBefore + 1, 'pauseAllAudio must suspend AudioContext');
    assert.equal(env.sources[0].stoppedCount, 0, 'Tab pause must NOT stop or reset bgmBufferSource');

    // Tab active / resumeAllAudio resumes AudioContext seamlessly from exact sample offset
    const resumesBefore = env.getResumeCalls();
    engine.resumeAllAudio(true);
    assert.ok(env.getResumeCalls() > resumesBefore, 'resumeAllAudio must resume AudioContext');
    assert.equal(env.sources.length, 1, 'Resuming from tab switch must continue exact same BGM source');
  } finally {
    env.restore();
    clearSuperAudioCacheForTests();
  }
});

