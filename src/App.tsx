import { useCallback, useEffect, useRef, useState } from 'react';
import { FightHud } from './components/FightHud';
import { AboutModal, HowToPlayModal } from './components/InfoModals';
import { LoadingScreen } from './components/LoadingScreen';
import { PauseModal } from './components/PauseModal';
import { PortraitGuard } from './components/PortraitGuard';
import { SatireNoticeModal } from './components/SatireNoticeModal';
import { SelectScreen } from './components/SelectScreen';
import { TitleScreen } from './components/TitleScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { audioEngine } from './game/audio';
import { DesiShowdownEngine } from './game/engine';
import type {
  Difficulty,
  FighterId,
  FloatingCallout,
  GameScreen,
  GraphicsQuality,
  HudSnapshot,
  MatchResultSnapshot,
  StageId,
} from './game/types';
import { useFullscreen } from './utils/fullscreen';

const INITIAL_HUD: HudSnapshot = {
  p1Hp: 110,
  p1MaxHp: 110,
  p1Shakti: 0,
  p1SpecialCd: 0,
  p1SpecialMaxCd: 4.5,
  p1Combo: 0,
  p2Hp: 100,
  p2MaxHp: 100,
  p2Shakti: 0,
  p2SpecialCd: 0,
  p2SpecialMaxCd: 4.2,
  p2Combo: 0,
  roundNumber: 1,
  p1RoundsWon: 0,
  p2RoundsWon: 0,
  roundTime: 60,
  phase: 'intro',
  isSuperCinematic: false,
  bannerText: null,
  bannerTone: 'round',
  superBanner: null,
  moveCallout: null,
  speechBubble: null,
  canSkipIntro: false,
};

function isAutostartRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

function isAutostartIntroRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('intro') === '1';
}

function getNumericQueryParam(key: string): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = new URLSearchParams(window.location.search).get(key);
  if (raw === null || raw === '') return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function getInitialShaktiParam(): number {
  const raw = getNumericQueryParam('shakti');
  return raw !== undefined ? Math.max(0, Math.min(100, raw)) : 0;
}

export default function App() {
  const autostart = isAutostartRequested();

  const [screen, setScreen] = useState<GameScreen>(autostart ? 'playing' : 'notice');
  const [p1Id, setP1Id] = useState<FighterId>('sheru');
  const [p2Id, setP2Id] = useState<FighterId>('billa');
  const [stageId, setStageId] = useState<StageId>('mohalla');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [graphics, setGraphics] = useState<GraphicsQuality>('high');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const {
    isFullscreen,
    isSupported: fullscreenSupported,
    toggleFullscreen,
  } = useFullscreen();

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSnapshot | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DesiShowdownEngine | null>(null);
  const screenRef = useRef<GameScreen>(screen);
  const musicMutedRef = useRef(musicMuted);
  screenRef.current = screen;
  musicMutedRef.current = musicMuted;

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    const mapped =
      screen === 'playing'
        ? 'playing'
        : screen === 'paused'
          ? 'paused'
          : screen === 'victory'
            ? 'gameover'
            : 'title';
    document.body.dataset.state = mapped;
    document.body.dataset.screen = screen;
  }, [screen]);

  // Mount Three.js engine ONCE inside isolated sibling container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new DesiShowdownEngine(container, {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onCallout: (callout) => {
        setCallouts((prev) => [...prev.slice(-5), callout]);
        const ttl = callout.text.includes('TRILLION') ? 1350 : 720;
        window.setTimeout(() => {
          setCallouts((prev) => prev.filter((c) => c.id !== callout.id));
        }, ttl);
      },
      onHeadline: () => {},
      onMatchFinish: (result) => {
        setMatchResult(result);
        setScreen('victory');
      },
    });
    engineRef.current = engine;

    void audioEngine.preloadSuperAudio();

    if (isAutostartRequested()) {
      const p1RoundsWon = getNumericQueryParam('p1rounds');
      const p2RoundsWon = getNumericQueryParam('p2rounds');
      const p1Hp = getNumericQueryParam('p1hp');
      const p2Hp = getNumericQueryParam('p2hp');
      const skipIntro = !isAutostartIntroRequested();
      engine.startMatch('sheru', 'billa', 'mohalla', 'normal', skipIntro, getInitialShaktiParam(), {
        p1RoundsWon,
        p2RoundsWon,
        p1Hp,
        p2Hp,
      });
    }

    return () => {
      audioEngine.stopSuperAudio();
      audioEngine.stopMusic();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Global Esc / P pause and M mute shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing') {
          e.preventDefault();
          audioEngine.playUiClick();
          audioEngine.stopMusic();
          engineRef.current?.setScreen('paused');
          setScreen('paused');
        } else if (screenRef.current === 'paused') {
          e.preventDefault();
          audioEngine.playUiClick();
          if (!musicMutedRef.current) audioEngine.startMusic();
          engineRef.current?.setScreen('playing');
          setScreen('playing');
        }
      } else if (e.code === 'KeyM' && (screenRef.current === 'playing' || screenRef.current === 'paused')) {
        setMuted((prev) => {
          const next = !prev;
          audioEngine.setMuted(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleDismissNotice = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    engineRef.current?.setScreen('loading');
    setScreen('loading');
  }, []);

  const handleLoadingComplete = useCallback(() => {
    engineRef.current?.setScreen('title');
    setScreen('title');
  }, []);

  const handleOpenSelect = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setHowToPlayOpen(false);
    setAboutOpen(false);
    engineRef.current?.setScreen('select');
    setScreen('select');
  }, []);

  const handleSelectP1 = useCallback(
    (id: FighterId) => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      setP1Id(id);
      engineRef.current?.setPreviewSelection(id, p2Id, stageId, difficulty);
    },
    [p2Id, stageId, difficulty],
  );

  const handleSelectP2 = useCallback(
    (id: FighterId) => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      setP2Id(id);
      engineRef.current?.setPreviewSelection(p1Id, id, stageId, difficulty);
    },
    [p1Id, stageId, difficulty],
  );

  const handleSelectStage = useCallback(
    (id: StageId) => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      setStageId(id);
      engineRef.current?.setPreviewSelection(p1Id, p2Id, id, difficulty);
    },
    [p1Id, p2Id, difficulty],
  );

  const handleSelectDifficulty = useCallback(
    (d: Difficulty) => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      setDifficulty(d);
      engineRef.current?.setPreviewSelection(p1Id, p2Id, stageId, d);
    },
    [p1Id, p2Id, stageId],
  );

  const handleStartFight = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setHowToPlayOpen(false);
    setAboutOpen(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    setMatchResult(null);
    setCallouts([]);
    engineRef.current?.startMatch(p1Id, p2Id, stageId, difficulty, false);
    setScreen('playing');
  }, [p1Id, p2Id, stageId, difficulty]);

  const handlePause = useCallback(() => {
    audioEngine.playUiClick();
    audioEngine.stopMusic();
    engineRef.current?.setScreen('paused');
    setScreen('paused');
  }, []);

  const handleResume = useCallback(() => {
    audioEngine.playUiClick();
    if (!musicMutedRef.current) audioEngine.startMusic();
    (document.activeElement as HTMLElement | null)?.blur?.();
    engineRef.current?.setScreen('playing');
    setScreen('playing');
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      if (!next) audioEngine.playUiClick();
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    audioEngine.playUiClick();
    setMusicMuted((prev) => {
      const next = !prev;
      audioEngine.setMusicMuted(next);
      if (!next && screenRef.current !== 'paused') {
        audioEngine.startMusic();
      }
      return next;
    });
  }, []);

  const handleToggleGraphics = useCallback(() => {
    audioEngine.playUiClick();
    setGraphics((prev) => {
      const next: GraphicsQuality = prev === 'high' ? 'low' : 'high';
      engineRef.current?.setGraphicsQuality(next);
      return next;
    });
  }, []);

  const handleQuitToSelect = useCallback(() => {
    audioEngine.playUiClick();
    audioEngine.stopSuperAudio();
    if (!musicMutedRef.current) audioEngine.startMusic();
    engineRef.current?.setScreen('select');
    engineRef.current?.setPreviewSelection(p1Id, p2Id, stageId, difficulty);
    setScreen('select');
  }, [p1Id, p2Id, stageId, difficulty]);

  const handleSkipIntro = useCallback(() => {
    audioEngine.playUiClick();
    engineRef.current?.skipPreFightIntro();
  }, []);

  const handleTouchDirection = useCallback(
    (dir: { left: boolean; right: boolean; up: boolean; down: boolean }) => {
      engineRef.current?.setTouchDirection(dir);
    },
    [],
  );

  const handleTouchAction = useCallback(
    (action: 'punch' | 'kick' | 'grab' | 'special' | 'superMove') => {
      engineRef.current?.triggerTouchAction(action);
    },
    [],
  );

  return (
    <main className="fixed inset-0 h-[100dvh] w-[100dvw] overflow-hidden select-none touch-none bg-[#0e0c0a]">
      {/* Isolated WebGL Three.js Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="arena-canvas-mount"
        className="fixed inset-0 z-0 h-[100dvh] w-[100dvw]"
      />

      {/* Screen Overlays */}
      {screen === 'notice' && <SatireNoticeModal onContinue={handleDismissNotice} />}

      {screen === 'loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {screen === 'title' && (
        <TitleScreen
          muted={muted}
          musicMuted={musicMuted}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          modalOpen={howToPlayOpen || aboutOpen}
          onStart={handleOpenSelect}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onToggleFullscreen={toggleFullscreen}
          onOpenHowToPlay={() => {
            audioEngine.playUiClick();
            setHowToPlayOpen(true);
          }}
          onOpenAbout={() => {
            audioEngine.playUiClick();
            setAboutOpen(true);
          }}
        />
      )}

      {screen === 'select' && (
        <SelectScreen
          p1Id={p1Id}
          p2Id={p2Id}
          stageId={stageId}
          difficulty={difficulty}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          onSelectP1={handleSelectP1}
          onSelectP2={handleSelectP2}
          onSelectStage={handleSelectStage}
          onSelectDifficulty={handleSelectDifficulty}
          onToggleFullscreen={toggleFullscreen}
          onOpenHowToPlay={() => {
            audioEngine.playUiClick();
            setHowToPlayOpen(true);
          }}
          onStartFight={handleStartFight}
        />
      )}

      {(screen === 'playing' || screen === 'paused') && (
        <FightHud
          p1Id={p1Id}
          p2Id={p2Id}
          stageId={stageId}
          hud={hud}
          callouts={callouts}
          muted={muted}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={toggleFullscreen}
          onSkipIntro={handleSkipIntro}
          onTouchDirection={handleTouchDirection}
          onTouchAction={handleTouchAction}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          muted={muted}
          musicMuted={musicMuted}
          graphics={graphics}
          onResume={handleResume}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onToggleGraphics={handleToggleGraphics}
          onQuitToSelect={handleQuitToSelect}
        />
      )}

      {screen === 'victory' && matchResult && (
        <VictoryScreen
          result={matchResult}
          onRematch={handleStartFight}
          onCharacterSelect={handleQuitToSelect}
        />
      )}

      {/* How to Play & About Modals */}
      {howToPlayOpen && <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {/* Mobile Portrait Orientation Guard */}
      <PortraitGuard />
    </main>
  );
}
