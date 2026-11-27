import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { FightHud } from './components/FightHud';
import { FriendRoomModal } from './components/FriendRoomModal';
import { AboutModal, HowToPlayModal } from './components/InfoModals';
import { LoadingScreen } from './components/LoadingScreen';
import { PauseModal } from './components/PauseModal';
import { PortraitGuard } from './components/PortraitGuard';
import { SatireNoticeModal } from './components/SatireNoticeModal';
import { SelectScreen } from './components/SelectScreen';
import { SettingsModal } from './components/SettingsModal';
import { SuperPreviewBar } from './components/SuperPreviewBar';
import { TitleScreen } from './components/TitleScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { audioEngine } from './game/audio';
import {
  loadCareerStats,
  recordMatchCareerStats,
  type CareerStats,
} from './game/careerStats';
import { preloadRealFaceTextures } from './game/characters';
import { DesiShowdownEngine } from './game/engine';
import {
  FriendRoomManager,
  type FriendRoomStateSnapshot,
} from './game/friendRoomPeer';
import type { FriendRoomPacket, OnlineRole } from './game/friendRoomProtocol';
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
  p1SpecialMaxCd: 3.5,
  p1Combo: 0,
  p2Hp: 100,
  p2MaxHp: 100,
  p2Shakti: 0,
  p2SpecialCd: 0,
  p2SpecialMaxCd: 3.5,
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
  speechBubbles: [],
  canSkipIntro: false,
};

const INITIAL_FRIEND_ROOM: FriendRoomStateSnapshot = {
  role: 'offline',
  status: 'idle',
  roomCode: '',
  statusMessage: '',
  errorMessage: null,
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

function getFighterQueryParam(key: string, fallback: FighterId): FighterId {
  if (typeof window === 'undefined') return fallback;
  const raw = new URLSearchParams(window.location.search).get(key);
  if (
    raw === 'sheru' ||
    raw === 'billa' ||
    raw === 'neta' ||
    raw === 'anda' ||
    raw === 'mausi' ||
    raw === 'father' ||
    raw === 'samyak'
  ) {
    return raw;
  }
  return fallback;
}

function getStageQueryParam(fallback: StageId): StageId {
  if (typeof window === 'undefined') return fallback;
  const raw = new URLSearchParams(window.location.search).get('stage');
  if (
    raw === 'mohalla' ||
    raw === 'school' ||
    raw === 'studio' ||
    raw === 'shaadi' ||
    raw === 'railway' ||
    raw === 'assembly'
  ) {
    return raw;
  }
  return fallback;
}

export default function App() {
  const autostart = isAutostartRequested();
  const initialP1 = autostart ? getFighterQueryParam('p1', 'sheru') : 'sheru';
  const initialP2 = autostart ? getFighterQueryParam('p2', 'billa') : 'billa';
  const initialStage = autostart ? getStageQueryParam('mohalla') : 'mohalla';

  const [screen, setScreen] = useState<GameScreen>(autostart ? 'playing' : 'notice');
  const [p1Id, setP1Id] = useState<FighterId>(initialP1);
  const [p2Id, setP2Id] = useState<FighterId>(initialP2);
  const [stageId, setStageId] = useState<StageId>(initialStage);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [graphics, setGraphics] = useState<GraphicsQuality>('high');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [friendRoomModalOpen, setFriendRoomModalOpen] = useState(false);
  const [friendRoomState, setFriendRoomState] =
    useState<FriendRoomStateSnapshot>(INITIAL_FRIEND_ROOM);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const [previewFighterId, setPreviewFighterId] = useState<FighterId>(initialP1);
  const [previewSuperPlaying, setPreviewSuperPlaying] = useState(false);
  const {
    isFullscreen,
    isSupported: fullscreenSupported,
    toggleFullscreen,
  } = useFullscreen();

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSnapshot | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStats>(() => loadCareerStats());

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DesiShowdownEngine | null>(null);
  const friendRoomRef = useRef<FriendRoomManager | null>(null);
  const screenRef = useRef<GameScreen>(screen);
  const musicMutedRef = useRef(musicMuted);
  const p1IdRef = useRef(p1Id);
  const p2IdRef = useRef(p2Id);
  const stageIdRef = useRef(stageId);
  const difficultyRef = useRef(difficulty);
  const onlineRoleRef = useRef<OnlineRole>('offline');

  const activeOnlineRole: OnlineRole =
    friendRoomState.status === 'connected' ? friendRoomState.role : 'offline';

  screenRef.current = screen;
  musicMutedRef.current = musicMuted;
  p1IdRef.current = p1Id;
  p2IdRef.current = p2Id;
  stageIdRef.current = stageId;
  difficultyRef.current = difficulty;
  onlineRoleRef.current = activeOnlineRole;

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
        window.setTimeout(() => {
          setCallouts((prev) => prev.filter((c) => c.id !== callout.id));
        }, callout.isSignature ? 1250 : 720);
      },
      onClearCallouts: () => setCallouts([]),
      onHeadline: () => {},
      onMatchFinish: (result) => {
        const localPerspectiveOutcome: 0 | 1 | 'draw' =
          result.winnerSlot === 'draw'
            ? 'draw'
            : onlineRoleRef.current === 'guest'
              ? result.winnerSlot === 1
                ? 0
                : 1
              : result.winnerSlot;
        const updatedStats = recordMatchCareerStats(localPerspectiveOutcome);
        setCareerStats(updatedStats);
        setMatchResult(result);
        setScreen('victory');
      },
      onSuperPreviewStateChange: (isPlaying) => {
        setPreviewSuperPlaying(isPlaying);
      },
    });
    engineRef.current = engine;

    void audioEngine.preloadAllSuperAudios();
    preloadRealFaceTextures();

    if (isAutostartRequested()) {
      const p1RoundsWon = getNumericQueryParam('p1rounds');
      const p2RoundsWon = getNumericQueryParam('p2rounds');
      const p1Hp = getNumericQueryParam('p1hp');
      const p2Hp = getNumericQueryParam('p2hp');
      const skipIntro = !isAutostartIntroRequested();
      const startP1 = getFighterQueryParam('p1', 'sheru');
      const startP2 = getFighterQueryParam('p2', 'billa');
      const startStage = getStageQueryParam('mohalla');
      engine.startMatch(startP1, startP2, startStage, 'normal', skipIntro, getInitialShaktiParam(), {
        p1RoundsWon,
        p2RoundsWon,
        p1Hp,
        p2Hp,
      });
    }

    return () => {
      audioEngine.stopSuperAudio();
      audioEngine.stopDahiKoAudio();
      audioEngine.stopMusic();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Initialize PeerJS Friend Room Manager once
  useEffect(() => {
    const startSyncedHostMatch = () => {
      const curP1 = p1IdRef.current;
      const curP2 = p2IdRef.current;
      const curStage = stageIdRef.current;
      const seed = Math.floor(Math.random() * 1000000);
      setHowToPlayOpen(false);
      setAboutOpen(false);
      setSettingsOpen(false);
      setFriendRoomModalOpen(false);
      setMatchResult(null);
      setCallouts([]);
      friendRoomRef.current?.send({
        type: 'START_MATCH',
        p1Id: curP1,
        p2Id: curP2,
        stageId: curStage,
        seed,
      });
      engineRef.current?.startMatch(
        curP1,
        curP2,
        curStage,
        'normal',
        false,
        0,
        undefined,
        seed,
      );
      setScreen('playing');
    };

    const manager = new FriendRoomManager({
      onStateChange: (snapshot) => {
        setFriendRoomState(snapshot);
      },
      onPeerConnected: (role) => {
        setDisconnectNotice(null);
        setFriendRoomModalOpen(false);
        engineRef.current?.setOnlineMode(role, (pkt) => {
          manager.send(pkt);
        });
        if (role === 'host') {
          manager.send({
            type: 'LOBBY_STATE',
            p1Id: p1IdRef.current,
            p2Id: p2IdRef.current,
            stageId: stageIdRef.current,
          });
        }
      },
      onPacket: (pkt: FriendRoomPacket) => {
        if (pkt.type === 'LOBBY_STATE') {
          setP1Id(pkt.p1Id);
          setP2Id(pkt.p2Id);
          setStageId(pkt.stageId);
          engineRef.current?.setPreviewSelection(
            pkt.p1Id,
            pkt.p2Id,
            pkt.stageId,
            difficultyRef.current,
          );
          return;
        }
        if (pkt.type === 'GUEST_SELECT') {
          setP2Id(pkt.p2Id);
          engineRef.current?.setPreviewSelection(
            p1IdRef.current,
            pkt.p2Id,
            stageIdRef.current,
            difficultyRef.current,
          );
          return;
        }
        if (pkt.type === 'START_MATCH') {
          audioEngine.unlock();
          setP1Id(pkt.p1Id);
          setP2Id(pkt.p2Id);
          setStageId(pkt.stageId);
          setHowToPlayOpen(false);
          setAboutOpen(false);
          setSettingsOpen(false);
          setFriendRoomModalOpen(false);
          setMatchResult(null);
          setCallouts([]);
          engineRef.current?.startMatch(
            pkt.p1Id,
            pkt.p2Id,
            pkt.stageId,
            'normal',
            false,
            0,
            undefined,
            pkt.seed,
          );
          setScreen('playing');
          return;
        }
        if (pkt.type === 'REMATCH_REQUEST') {
          if (onlineRoleRef.current === 'host') {
            startSyncedHostMatch();
          }
          return;
        }
        if (pkt.type === 'BACK_TO_SELECT') {
          audioEngine.stopSuperAudio();
          audioEngine.stopDahiKoAudio();
          if (!musicMutedRef.current) audioEngine.startMusic();
          setMatchResult(null);
          setCallouts([]);
          engineRef.current?.setScreen('select');
          engineRef.current?.setPreviewSelection(
            p1IdRef.current,
            p2IdRef.current,
            stageIdRef.current,
            difficultyRef.current,
          );
          setScreen('select');
          return;
        }
        engineRef.current?.receiveFriendPacket(pkt);
      },
      onPeerDisconnected: (reason) => {
        engineRef.current?.setOnlineMode('offline');
        audioEngine.stopSuperAudio();
        audioEngine.stopDahiKoAudio();
        setDisconnectNotice(reason || 'Your friend disconnected from the room.');
      },
    });

    friendRoomRef.current = manager;
    return () => {
      manager.dispose();
      friendRoomRef.current = null;
    };
  }, []);

  // Global Esc / P pause and M mute shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
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
      if (onlineRoleRef.current === 'guest') return;
      audioEngine.unlock();
      audioEngine.playUiClick();
      setP1Id(id);
      engineRef.current?.setPreviewSelection(id, p2Id, stageId, difficulty);
      if (onlineRoleRef.current === 'host') {
        friendRoomRef.current?.send({
          type: 'LOBBY_STATE',
          p1Id: id,
          p2Id,
          stageId,
        });
      }
    },
    [p2Id, stageId, difficulty],
  );

  const handleSelectP2 = useCallback(
    (id: FighterId) => {
      if (onlineRoleRef.current === 'host') return;
      audioEngine.unlock();
      audioEngine.playUiClick();
      setP2Id(id);
      engineRef.current?.setPreviewSelection(p1Id, id, stageId, difficulty);
      if (onlineRoleRef.current === 'guest') {
        friendRoomRef.current?.send({
          type: 'GUEST_SELECT',
          p2Id: id,
        });
      }
    },
    [p1Id, stageId, difficulty],
  );

  const handleSelectStage = useCallback(
    (id: StageId) => {
      if (onlineRoleRef.current === 'guest') return;
      audioEngine.unlock();
      audioEngine.playUiClick();
      setStageId(id);
      engineRef.current?.setPreviewSelection(p1Id, p2Id, id, difficulty);
      if (onlineRoleRef.current === 'host') {
        friendRoomRef.current?.send({
          type: 'LOBBY_STATE',
          p1Id,
          p2Id,
          stageId: id,
        });
      }
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

    // Guest clicking Rematch requests Host to launch the next match
    if (onlineRoleRef.current === 'guest') {
      friendRoomRef.current?.send({ type: 'REMATCH_REQUEST' });
      return;
    }

    setHowToPlayOpen(false);
    setAboutOpen(false);
    setSettingsOpen(false);
    setFriendRoomModalOpen(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    setMatchResult(null);
    setCallouts([]);

    if (onlineRoleRef.current === 'host') {
      const seed = Math.floor(Math.random() * 1000000);
      friendRoomRef.current?.send({
        type: 'START_MATCH',
        p1Id,
        p2Id,
        stageId,
        seed,
      });
      engineRef.current?.startMatch(p1Id, p2Id, stageId, 'normal', false, 0, undefined, seed);
    } else {
      engineRef.current?.startMatch(p1Id, p2Id, stageId, difficulty, false);
    }
    setScreen('playing');
  }, [p1Id, p2Id, stageId, difficulty]);

  const handleCreateFriendRoom = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setDisconnectNotice(null);
    friendRoomRef.current?.createRoom();
  }, []);

  const handleJoinFriendRoom = useCallback((code: string) => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setDisconnectNotice(null);
    friendRoomRef.current?.joinRoom(code);
  }, []);

  const handleLeaveFriendRoom = useCallback(() => {
    audioEngine.playUiClick();
    friendRoomRef.current?.leaveRoom();
    engineRef.current?.setOnlineMode('offline');
    setDisconnectNotice(null);
    setFriendRoomModalOpen(false);
  }, []);

  const handleReturnToVsCpu = useCallback(() => {
    audioEngine.playUiClick();
    friendRoomRef.current?.leaveRoom();
    engineRef.current?.setOnlineMode('offline');
    setDisconnectNotice(null);
    setMatchResult(null);
    setCallouts([]);
    if (!musicMutedRef.current) audioEngine.startMusic();
    engineRef.current?.setScreen('select');
    engineRef.current?.setPreviewSelection(
      p1IdRef.current,
      p2IdRef.current,
      stageIdRef.current,
      difficultyRef.current,
    );
    setScreen('select');
  }, []);

  const handleStartSuperPreview = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setSettingsOpen(false);
    setHowToPlayOpen(false);
    setFriendRoomModalOpen(false);
    setCallouts([]);
    setPreviewFighterId(p1Id);
    setPreviewSuperPlaying(false);
    engineRef.current?.startSuperPreview(p1Id, stageId);
    setScreen('super_preview');
  }, [p1Id, stageId]);

  const handlePreviewSwitchFighter = useCallback((id: FighterId) => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    setPreviewFighterId(id);
    setPreviewSuperPlaying(false);
    setCallouts([]);
    engineRef.current?.setSuperPreviewFighter(id);
  }, []);

  const handlePreviewTriggerSuper = useCallback(() => {
    audioEngine.unlock();
    engineRef.current?.triggerPreviewSuper();
  }, []);

  const handlePreviewSelectAndBack = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();
    setP1Id(previewFighterId);
    setPreviewSuperPlaying(false);
    setCallouts([]);
    engineRef.current?.setScreen('select');
    engineRef.current?.setPreviewSelection(previewFighterId, p2Id, stageId, difficulty);
    setScreen('select');
  }, [previewFighterId, p2Id, stageId, difficulty]);

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
    audioEngine.stopDahiKoAudio();
    if (onlineRoleRef.current !== 'offline') {
      friendRoomRef.current?.send({ type: 'BACK_TO_SELECT' });
    }
    if (!musicMutedRef.current) audioEngine.startMusic();
    engineRef.current?.setScreen('select');
    engineRef.current?.setPreviewSelection(p1Id, p2Id, stageId, difficulty);
    setScreen('select');
  }, [p1Id, p2Id, stageId, difficulty]);

  const handleSkipIntro = useCallback(() => {
    audioEngine.playUiClick();
    if (onlineRoleRef.current !== 'offline') {
      friendRoomRef.current?.send({ type: 'SKIP_INTRO' });
    }
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
          onlineRole={activeOnlineRole}
          roomCode={friendRoomState.roomCode}
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
          onOpenSettings={() => {
            audioEngine.unlock();
            audioEngine.playUiClick();
            setSettingsOpen(true);
          }}
          onOpenFriendRoom={() => {
            audioEngine.unlock();
            audioEngine.playUiClick();
            setFriendRoomModalOpen(true);
          }}
          onStartFight={handleStartFight}
        />
      )}

      {screen === 'super_preview' && (
        <SuperPreviewBar
          activeFighterId={previewFighterId}
          isSuperPlaying={previewSuperPlaying}
          superBanner={hud.superBanner}
          callouts={callouts}
          onSwitchFighter={handlePreviewSwitchFighter}
          onTriggerSuper={handlePreviewTriggerSuper}
          onSelectAndBack={handlePreviewSelectAndBack}
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
          onlineRole={activeOnlineRole}
          roomCode={friendRoomState.roomCode}
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
          careerStats={careerStats}
          onlineRole={activeOnlineRole}
          onRematch={handleStartFight}
          onCharacterSelect={handleQuitToSelect}
        />
      )}

      {/* Friend Room Modal */}
      {friendRoomModalOpen && screen === 'select' && (
        <FriendRoomModal
          roomState={friendRoomState}
          onCreateRoom={handleCreateFriendRoom}
          onJoinRoom={handleJoinFriendRoom}
          onLeaveRoom={handleLeaveFriendRoom}
          onClose={() => {
            audioEngine.playUiClick();
            setFriendRoomModalOpen(false);
          }}
        />
      )}

      {/* Clean Friend Disconnected Banner */}
      {disconnectNotice && (
        <div
          role="alertdialog"
          aria-modal="true"
          data-testid="friend-disconnected-banner"
          className="safe-pad-modal fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm border-2 border-[#ef4444] bg-[#140e0b]/96 p-4 text-center text-white shadow-[0_18px_45px_rgba(0,0,0,0.85),6px_6px_0_#0a0705]">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#ef4444] bg-[#450a0a]">
              <WifiOff className="h-5 w-5 text-[#fca5a5]" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-extrabold uppercase italic tracking-wider text-[#fca5a5]">
              FRIEND DISCONNECTED
            </h2>
            <p className="mt-1 text-xs font-medium text-[#d6d3d1]">{disconnectNotice}</p>
            <button
              type="button"
              data-testid="return-to-vs-cpu-btn"
              onClick={handleReturnToVsCpu}
              className="mt-4 w-full cursor-pointer border-2 border-[#0f0a06] bg-[#facc15] px-4 py-2 font-display text-lg font-extrabold uppercase tracking-wider text-[#110b08] shadow-[4px_4px_0_#dc2626] transition hover:bg-[#fde047]"
            >
              RETURN TO VS CPU
            </button>
          </div>
        </div>
      )}

      {/* Settings, How to Play & About Modals */}
      {settingsOpen && screen === 'select' && (
        <SettingsModal
          muted={muted}
          musicMuted={musicMuted}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onStartSuperPreview={handleStartSuperPreview}
          onClose={() => {
            audioEngine.playUiClick();
            setSettingsOpen(false);
          }}
        />
      )}
      {howToPlayOpen && <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {/* Mobile Portrait Orientation Guard */}
      <PortraitGuard />
    </main>
  );
}

