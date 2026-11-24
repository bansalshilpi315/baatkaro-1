import assert from 'node:assert/strict';
import test from 'node:test';
import {
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

    // Verify BGM ducking scheduled ONCE via setTargetAtTime(0.15, now, 0.08)
    const bgmGain = env.gainNodes[0];
    const duckCalls = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === 0.15 && c.args[2] === 0.08,
    );
    assert.equal(duckCalls.length, 1, 'BGM must duck once with setTargetAtTime(0.15, now, 0.08)');

    // Overlap guard: triggering again while active must NOT create a second source
    engine.playSheruSuperAudio();
    assert.equal(env.sources.length, 1, 'Active Super playback must prevent overlapping sources');

    // Animation ending must NOT stop or cut off the active AudioBufferSourceNode
    engine.notifySuperAnimationEnd();
    assert.equal(env.sources[0].stoppedCount, 0, 'notifySuperAnimationEnd must never call source.stop()');
    assert.equal(engine.isSuperAudioPlaying(), true, 'Source must keep playing until natural onended');

    // Simulate natural audio end -> restores BGM via setTargetAtTime(1.0, now, 0.2)
    env.sources[0].onended?.();
    assert.equal(engine.isSuperAudioPlaying(), false);
    assert.equal(env.sources[0].disconnected, true);
    const restoreCalls = bgmGain.calls.filter(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === 1.0 && c.args[2] === 0.2,
    );
    assert.equal(restoreCalls.length, 1, 'source.onended must restore BGM via setTargetAtTime(1.0, now, 0.2)');
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
