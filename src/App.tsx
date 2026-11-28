import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { FightHud } from './components/FightHud';
import { FriendRoomModal } from './components/FriendRoomModal';
import { AboutModal, HowToPlayModal } from './components/InfoModals';
import { LoadingScreen } from './components/LoadingScreen';
import { PauseModal } from './components/PauseModal';
import { PlayerAccountModal } from './components/PlayerAccountModal';
import { PortraitGuard } from './components/PortraitGuard';
import { SatireNoticeModal } from './components/SatireNoticeModal';
import { SelectScreen } from './components/SelectScreen';
import { SettingsModal } from './components/SettingsModal';
import { SuperPreviewBar } from './components/SuperPreviewBar';
import { TitleScreen } from './components/TitleScreen';
import type { RewardedAdFighterResult } from './components/UnlockFighterModal';
import { VictoryScreen } from './components/VictoryScreen';
import { audioEngine } from './game/audio';
import {
  loadCareerStats,
  recordMatchCareerStats,
  type CareerStats,
} from './game/careerStats';
import { preloadRealFaceTextures, STAGE_LIST } from './game/characters';
import { CG_SDK } from './game/crazyGamesSdk';
import { DesiShowdownEngine } from './game/engine';
import {
  applyMatchOutcomeToProfile,
  createPlayerAccount,
  FREE_COINS_AD_REWARD,
  getFighterAdProgress,
  grantRewardedCoins,
  loadActivePlayerProfile,
  loginPlayerAccount,
  logoutToGuest,
  recordRewardedAdWatch,
  unlockFighterWithCoins,
  unlockStageWithCoins,
  type PlayerProfile,
} from './game/playerAccount';
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
import { tryAutoMobileFullscreen, useFullscreen } from './utils/fullscreen';
import {
  loadAudioPrefs,
  loadSelectionPrefs,
  saveAudioPrefs,
  saveSelectionPrefs,
} from './utils/safeStorage';

const INITIAL_HUD: HudSnapshot = {
  p1Hp: 155,
  p1MaxHp: 155,
  p1Shakti: 0,
  p1SpecialCd: 0,
  p1SpecialMaxCd: 3.5,
  p1Combo: 0,
  p2Hp: 150,
  p2MaxHp: 150,
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
    raw === 'utkarsh' ||
    raw === 'neta' ||
    raw === 'anda' ||
    raw === 'mausi' ||
    raw === 'father' ||
    raw === 'samyak' ||
    raw === 'adi' ||
    raw === 'krish'
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
  const [initialBootData] = useState(() => {
    const savedSelection = loadSelectionPrefs();
    const initialProfile = loadActivePlayerProfile();
    const initialAudioPrefs = loadAudioPrefs();
    const safeSavedP1: FighterId = initialProfile.unlockedFighters.includes(savedSelection.p1Id)
      ? savedSelection.p1Id
      : 'sheru';
    const savedStageIdx = STAGE_LIST.findIndex((s) => s.id === savedSelection.stageId);
    const safeSavedStage: StageId =
      savedStageIdx >= 0 && savedStageIdx + 1 <= initialProfile.highestStage
        ? savedSelection.stageId
        : 'mohalla';
    return {
      initialProfile,
      initialAudioPrefs,
      initialP1: autostart ? getFighterQueryParam('p1', 'sheru') : safeSavedP1,
      initialP2: autostart ? getFighterQueryParam('p2', 'billa') : savedSelection.p2Id,
      initialStage: autostart ? getStageQueryParam('mohalla') : safeSavedStage,
      initialDifficulty: (autostart ? 'normal' : savedSelection.difficulty) as Difficulty,
    };
  });

  const [screen, setScreen] = useState<GameScreen>(autostart ? 'playing' : 'loading');
  const [p1Id, setP1Id] = useState<FighterId>(initialBootData.initialP1);
  const [p2Id, setP2Id] = useState<FighterId>(initialBootData.initialP2);
  const [stageId, setStageId] = useState<StageId>(initialBootData.initialStage);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialBootData.initialDifficulty);
  const [globalMuted, setGlobalMuted] = useState(initialBootData.initialAudioPrefs.globalMuted);
  const [muted, setMuted] = useState(initialBootData.initialAudioPrefs.sfxMuted);
  const [musicMuted, setMusicMuted] = useState(initialBootData.initialAudioPrefs.musicMuted);
  const [autoPaused, setAutoPaused] = useState(false);
  const [graphics, setGraphics] = useState<GraphicsQuality>('high');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [satireNoticeOpen, setSatireNoticeOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [friendRoomModalOpen, setFriendRoomModalOpen] = useState(false);
  const [friendRoomState, setFriendRoomState] =
    useState<FriendRoomStateSnapshot>(INITIAL_FRIEND_ROOM);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const [previewFighterId, setPreviewFighterId] = useState<FighterId>(initialBootData.initialP1);
  const [previewSuperPlaying, setPreviewSuperPlaying] = useState(false);
  const [adOverlayActive, setAdOverlayActive] = useState(false);
  const [freeCoinsAdBusy, setFreeCoinsAdBusy] = useState(false);
  const [adToast, setAdToast] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const adToastTimerRef = useRef<number | null>(null);
  const {
    isFullscreen,
    isSupported: fullscreenSupported,
    toggleFullscreen,
  } = useFullscreen();

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSnapshot | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStats>(() => loadCareerStats());
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(
    () => initialBootData.initialProfile,
  );

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DesiShowdownEngine | null>(null);
  const friendRoomRef = useRef<FriendRoomManager | null>(null);
  const screenRef = useRef<GameScreen>(screen);
  const globalMutedRef = useRef(globalMuted);
  const mutedRef = useRef(muted);
  const musicMutedRef = useRef(musicMuted);
  const p1IdRef = useRef(p1Id);
  const p2IdRef = useRef(p2Id);
  const stageIdRef = useRef(stageId);
  const difficultyRef = useRef(difficulty);
  const onlineRoleRef = useRef<OnlineRole>('offline');
  const playerProfileRef = useRef<PlayerProfile>(playerProfile);

  const activeOnlineRole: OnlineRole =
    friendRoomState.status === 'connected' ? friendRoomState.role : 'offline';

  screenRef.current = screen;
  globalMutedRef.current = globalMuted;
  mutedRef.current = muted;
  musicMutedRef.current = musicMuted;
  p1IdRef.current = p1Id;
  p2IdRef.current = p2Id;
  stageIdRef.current = stageId;
  difficultyRef.current = difficulty;
  onlineRoleRef.current = activeOnlineRole;
  playerProfileRef.current = playerProfile;

  const portraitBlockedRef = useRef(false);

  // Apply persisted audio mute preferences immediately on boot & keep audio strictly silent until 100% booted
  useEffect(() => {
    const prefs = initialBootData.initialAudioPrefs;
    audioEngine.setBootReady(isAutostartRequested());
    audioEngine.setMuted(prefs.sfxMuted);
    audioEngine.setMusicMuted(prefs.musicMuted);
    audioEngine.setGlobalMuted(prefs.globalMuted, false);
  }, [initialBootData]);

  // Initialize CrazyGames SDK v3, hydrate SaveStore data, and sync portal muteAudio settings
  useEffect(() => {
    let active = true;

    const applyPortalMute = (shouldMute: boolean) => {
      if (!active) return;
      globalMutedRef.current = shouldMute;
      setGlobalMuted(shouldMute);
      saveAudioPrefs({
        globalMuted: shouldMute,
        sfxMuted: mutedRef.current,
        musicMuted: musicMutedRef.current,
      });
      const allowMusic =
        !shouldMute &&
        screenRef.current !== 'paused' &&
        screenRef.current !== 'notice' &&
        screenRef.current !== 'loading';
      audioEngine.setGlobalMuted(shouldMute, allowMusic);
    };

    const unsubscribeMute = CG_SDK.onMuteAudioSettingChange(applyPortalMute);

    void CG_SDK.init().then(() => {
      if (!active) return;
      // Re-hydrate persisted profile, career stats, and audio prefs from SaveStore (SDK.data + localStorage)
      const hydratedProfile = loadActivePlayerProfile();
      playerProfileRef.current = hydratedProfile;
      setPlayerProfile(hydratedProfile);
      setCareerStats(loadCareerStats());

      const cgMute = CG_SDK.getMuteAudioSetting();
      if (typeof cgMute === 'boolean') {
        applyPortalMute(cgMute);
      }
      if (isAutostartRequested()) {
        CG_SDK.loadingStop();
      }
    });

    return () => {
      active = false;
      unsubscribeMute();
    };
  }, []);

  // Persist selected fighter, opponent, stage, and difficulty via unified SaveStore
  useEffect(() => {
    saveSelectionPrefs({ p1Id, p2Id, stageId, difficulty });
  }, [p1Id, p2Id, stageId, difficulty]);

  // Synchronize CrazyGames v3 gameplayStart / gameplayStop lifecycle accurately
  useEffect(() => {
    const isInteractiveCombat =
      (screen === 'playing' || screen === 'super_preview') &&
      !settingsOpen &&
      !accountModalOpen &&
      !howToPlayOpen &&
      !aboutOpen &&
      !satireNoticeOpen &&
      !adOverlayActive;

    if (isInteractiveCombat) {
      CG_SDK.gameplayStart();
    } else {
      CG_SDK.gameplayStop();
    }
  }, [
    screen,
    settingsOpen,
    accountModalOpen,
    howToPlayOpen,
    aboutOpen,
    satireNoticeOpen,
    adOverlayActive,
  ]);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (adToastTimerRef.current !== null) {
        window.clearTimeout(adToastTimerRef.current);
      }
    };
  }, []);

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

        const accountOutcome: 'win' | 'loss' | 'draw' =
          localPerspectiveOutcome === 'draw'
            ? 'draw'
            : localPerspectiveOutcome === 0
              ? 'win'
              : 'loss';
        const stageNumber = Math.max(
          1,
          STAGE_LIST.findIndex((s) => s.id === stageIdRef.current) + 1,
        );
        const progression = applyMatchOutcomeToProfile(
          playerProfileRef.current,
          accountOutcome,
          stageNumber,
        );
        playerProfileRef.current = progression.profile;
        setPlayerProfile(progression.profile);

        CG_SDK.gameplayStop();
        if (accountOutcome === 'win') {
          CG_SDK.happytime();
        }

        setMatchResult(result);
        setScreen('victory');
      },
      onSuperPreviewStateChange: (isPlaying) => {
        setPreviewSuperPlaying(isPlaying);
      },
      deferAssetPreload: !isAutostartRequested(),
    });
    engineRef.current = engine;

    if (isAutostartRequested()) {
      void audioEngine.preloadAllSuperAudios();
      preloadRealFaceTextures();
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

  // Poki & CrazyGames QA: Automatic Tab-Switch & Window-Blur Pause
  // Immediately pauses active combat + ALL playing audio on tab hide/minimize/blur,
  // and keeps the match safely paused behind the PAUSED overlay until the player clicks RESUME.
  useEffect(() => {
    const handleInactiveWindow = () => {
      audioEngine.pauseAllAudio();
      if (screenRef.current === 'playing') {
        setAutoPaused(true);
        engineRef.current?.setScreen('paused');
        setScreen('paused');
      }
    };

    const handleActiveWindow = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      // Never auto-unpause combat — wait for the player to click RESUME.
      if (screenRef.current === 'paused') return;
      const shouldResumeMusic =
        !globalMutedRef.current &&
        !musicMutedRef.current &&
        screenRef.current !== 'loading';
      audioEngine.resumeAllAudio(shouldResumeMusic);
    };

    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        handleInactiveWindow();
      } else {
        handleActiveWindow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', handleInactiveWindow);
    window.addEventListener('focus', handleActiveWindow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', handleInactiveWindow);
      window.removeEventListener('focus', handleActiveWindow);
    };
  }, []);

  // Global Esc / P pause, M global mute shortcuts, and CrazyGames iframe Arrow/Space scroll prevention
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        e.preventDefault();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing') {
          e.preventDefault();
          audioEngine.playUiClick();
          audioEngine.pauseAllAudio();
          CG_SDK.gameplayStop();
          setAutoPaused(false);
          engineRef.current?.setScreen('paused');
          setScreen('paused');
        } else if (screenRef.current === 'paused') {
          e.preventDefault();
          setAutoPaused(false);
          audioEngine.resumeAllAudio(!globalMutedRef.current && !musicMutedRef.current);
          audioEngine.playUiClick();
          engineRef.current?.setScreen('playing');
          setScreen('playing');
          CG_SDK.gameplayStart();
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        const nextGlobalMuted = !globalMutedRef.current;
        globalMutedRef.current = nextGlobalMuted;
        setGlobalMuted(nextGlobalMuted);
        saveAudioPrefs({
          globalMuted: nextGlobalMuted,
          sfxMuted: mutedRef.current,
          musicMuted: musicMutedRef.current,
        });
        const allowMusic = screenRef.current !== 'paused' && screenRef.current !== 'notice' && screenRef.current !== 'loading';
        audioEngine.setGlobalMuted(nextGlobalMuted, allowMusic);
        if (!nextGlobalMuted) {
          audioEngine.playUiClick();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Unlock Web Audio, trigger mobile fullscreen (if gesture required), & start /audio/bgm.mp3 on first post-boot landscape gesture
  useEffect(() => {
    const handleFirstGesture = () => {
      if (screenRef.current === 'loading' || portraitBlockedRef.current) return;
      void tryAutoMobileFullscreen();
      audioEngine.unlock();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  const handlePortraitBlockedChange = useCallback((blocked: boolean) => {
    portraitBlockedRef.current = blocked;
    audioEngine.setPortraitBlocked(blocked);
    if (!blocked && screenRef.current !== 'loading') {
      void tryAutoMobileFullscreen();
    }
  }, []);

  const handleLoadingComplete = useCallback(() => {
    const nextScreen: GameScreen =
      playerProfileRef.current.mode === 'account' ? 'title' : 'auth';
    audioEngine.setBootReady(true);
    engineRef.current?.setScreen(nextScreen);
    setScreen(nextScreen);
    CG_SDK.loadingStop();
    if (!portraitBlockedRef.current) {
      void tryAutoMobileFullscreen();
      // Start continuous gapless ./audio/bgm.mp3 immediately if AudioContext is already unlocked
      audioEngine.tryAutoStartMusic();
    }
  }, []);

  const handleGateGuest = useCallback(() => {
    if (!portraitBlockedRef.current) {
      void tryAutoMobileFullscreen();
    }
    audioEngine.unlock();
    audioEngine.playUiClick();
    if (playerProfileRef.current.mode !== 'guest') {
      const guest = logoutToGuest();
      playerProfileRef.current = guest;
      setPlayerProfile(guest);
    }
    engineRef.current?.setScreen('title');
    setScreen('title');
  }, []);

  const handleOpenSelect = useCallback(() => {
    if (!portraitBlockedRef.current) {
      void tryAutoMobileFullscreen();
    }
    audioEngine.unlock();
    audioEngine.playUiClick();
    setHowToPlayOpen(false);
    setAboutOpen(false);
    setSatireNoticeOpen(false);
    setAccountModalOpen(false);
    setSettingsOpen(false);
    engineRef.current?.setScreen('select');
    setScreen('select');
  }, []);

  const handlePlayAsGuest = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    if (playerProfileRef.current.mode !== 'guest') {
      const guest = logoutToGuest();
      playerProfileRef.current = guest;
      setPlayerProfile(guest);
    }
    setAccountModalOpen(false);
  }, []);

  const handleCreateAccount = useCallback(async (username: string, password: string) => {
    audioEngine.unlock();
    const res = await createPlayerAccount(username, password);
    if (res.ok && res.profile) {
      audioEngine.playUiClick();
      playerProfileRef.current = res.profile;
      setPlayerProfile(res.profile);
      setAccountModalOpen(false);
      if (screenRef.current === 'auth') {
        engineRef.current?.setScreen('title');
        setScreen('title');
      }
    }
    return res;
  }, []);

  const handleLogin = useCallback(async (username: string, password: string) => {
    audioEngine.unlock();
    const res = await loginPlayerAccount(username, password);
    if (res.ok && res.profile) {
      audioEngine.playUiClick();
      playerProfileRef.current = res.profile;
      setPlayerProfile(res.profile);
      setAccountModalOpen(false);
      if (screenRef.current === 'auth') {
        engineRef.current?.setScreen('title');
        setScreen('title');
      }
    }
    return res;
  }, []);

  const handleLogout = useCallback(() => {
    audioEngine.playUiClick();
    const guest = logoutToGuest();
    playerProfileRef.current = guest;
    setPlayerProfile(guest);
    if (!guest.unlockedFighters.includes(p1IdRef.current)) {
      setP1Id('sheru');
    }
    const stageNum = STAGE_LIST.findIndex((s) => s.id === stageIdRef.current) + 1;
    if (stageNum > guest.highestStage) {
      setStageId('mohalla');
    }
  }, []);

  const showAdToast = useCallback((text: string, tone: 'success' | 'error') => {
    setAdToast({ text, tone });
    if (adToastTimerRef.current !== null) {
      window.clearTimeout(adToastTimerRef.current);
    }
    adToastTimerRef.current = window.setTimeout(() => {
      setAdToast(null);
      adToastTimerRef.current = null;
    }, 3200);
  }, []);

  const pauseForAd = useCallback(() => {
    CG_SDK.gameplayStop();
    setAdOverlayActive(true);
    audioEngine.pauseAllAudio();
  }, []);

  const restoreAfterAd = useCallback(() => {
    setAdOverlayActive(false);
    const shouldResumeMusic =
      !globalMutedRef.current &&
      !musicMutedRef.current &&
      screenRef.current !== 'paused' &&
      screenRef.current !== 'loading';
    audioEngine.resumeAllAudio(shouldResumeMusic);
  }, []);

  const handleUnlockFighter = useCallback((id: FighterId): boolean => {
    audioEngine.unlock();
    const res = unlockFighterWithCoins(playerProfileRef.current, id);
    if (res.ok) {
      audioEngine.playUnlockFanfare();
      CG_SDK.happytime();
      playerProfileRef.current = res.profile;
      setPlayerProfile(res.profile);
      return true;
    }
    return false;
  }, []);

  const handleRequestFighterRewardedAd = useCallback(
    async (
      id: FighterId,
      onSimulatedTick?: (secondsLeft: number) => void,
    ): Promise<RewardedAdFighterResult> => {
      audioEngine.unlock();
      const before = getFighterAdProgress(playerProfileRef.current, id);
      const grantHolder: {
        value: { watched: number; required: number; unlockedNow: boolean } | null;
      } = { value: null };
      let errorMsg: string | undefined;

      const outcome = await CG_SDK.requestRewardedAd({
        onAdStarted: pauseForAd,
        onAdFinished: restoreAfterAd,
        onSimulatedTick,
        onRewardGranted: () => {
          const res = recordRewardedAdWatch(playerProfileRef.current, id);
          playerProfileRef.current = res.profile;
          setPlayerProfile(res.profile);
          grantHolder.value = {
            watched: res.watched,
            required: res.required,
            unlockedNow: res.unlockedNow,
          };
          if (res.unlockedNow) {
            audioEngine.playUnlockFanfare();
            CG_SDK.happytime();
          } else {
            audioEngine.playUiClick();
          }
        },
        onAdError: (toastText) => {
          errorMsg = toastText;
          showAdToast(toastText, 'error');
        },
      });

      const granted = grantHolder.value;
      if (!outcome.ok || !granted) {
        return {
          ok: false,
          watched: before.watched,
          required: before.required,
          unlockedNow: false,
          errorMessage: errorMsg ?? 'Ad not available right now, try again!',
        };
      }

      return {
        ok: true,
        watched: granted.watched,
        required: granted.required,
        unlockedNow: granted.unlockedNow,
      };
    },
    [pauseForAd, restoreAfterAd, showAdToast],
  );

  const handleWatchFreeCoinsAd = useCallback(async (): Promise<boolean> => {
    if (freeCoinsAdBusy) return false;
    audioEngine.unlock();
    setFreeCoinsAdBusy(true);

    const outcome = await CG_SDK.requestRewardedAd({
      onAdStarted: pauseForAd,
      onAdFinished: restoreAfterAd,
      onRewardGranted: () => {
        const res = grantRewardedCoins(playerProfileRef.current, FREE_COINS_AD_REWARD);
        playerProfileRef.current = res.profile;
        setPlayerProfile(res.profile);
        audioEngine.playUnlockFanfare();
        showAdToast(`+${res.coinsGranted} Free Coins Added!`, 'success');
      },
      onAdError: (toastText) => {
        showAdToast(toastText, 'error');
      },
    });

    setFreeCoinsAdBusy(false);
    return outcome.ok;
  }, [freeCoinsAdBusy, pauseForAd, restoreAfterAd, showAdToast]);

  const handleUnlockStage = useCallback((stageNumber: number) => {
    audioEngine.unlock();
    const res = unlockStageWithCoins(playerProfileRef.current, stageNumber);
    if (res.ok) {
      audioEngine.playUiClick();
      playerProfileRef.current = res.profile;
      setPlayerProfile(res.profile);
    }
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
      const stageNum = STAGE_LIST.findIndex((s) => s.id === stageId) + 1;
      if (
        !playerProfileRef.current.unlockedFighters.includes(p1Id) ||
        stageNum > playerProfileRef.current.highestStage
      ) {
        return;
      }
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
    audioEngine.pauseAllAudio();
    setAutoPaused(false);
    engineRef.current?.setScreen('paused');
    setScreen('paused');
  }, []);

  const handleResume = useCallback(() => {
    setAutoPaused(false);
    audioEngine.resumeAllAudio(!globalMutedRef.current && !musicMutedRef.current);
    audioEngine.playUiClick();
    (document.activeElement as HTMLElement | null)?.blur?.();
    engineRef.current?.setScreen('playing');
    setScreen('playing');
  }, []);

  const handleToggleGlobalMute = useCallback(() => {
    audioEngine.unlock();
    const next = !globalMutedRef.current;
    globalMutedRef.current = next;
    setGlobalMuted(next);
    saveAudioPrefs({
      globalMuted: next,
      sfxMuted: mutedRef.current,
      musicMuted: musicMutedRef.current,
    });
    const allowMusic =
      screenRef.current !== 'paused' &&
      screenRef.current !== 'notice' &&
      screenRef.current !== 'loading';
    audioEngine.setGlobalMuted(next, allowMusic);
    if (!next) {
      audioEngine.playUiClick();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    audioEngine.unlock();
    if (globalMutedRef.current) {
      globalMutedRef.current = false;
      setGlobalMuted(false);
      mutedRef.current = false;
      setMuted(false);
      saveAudioPrefs({
        globalMuted: false,
        sfxMuted: false,
        musicMuted: musicMutedRef.current,
      });
      audioEngine.setMuted(false);
      audioEngine.setGlobalMuted(false, screenRef.current !== 'paused');
      audioEngine.playUiClick();
      return;
    }
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    saveAudioPrefs({
      globalMuted: globalMutedRef.current,
      sfxMuted: next,
      musicMuted: musicMutedRef.current,
    });
    audioEngine.setMuted(next);
    if (!next) audioEngine.playUiClick();
  }, []);

  const handleToggleMusic = useCallback(() => {
    audioEngine.unlock();
    if (globalMutedRef.current) {
      globalMutedRef.current = false;
      setGlobalMuted(false);
      musicMutedRef.current = false;
      setMusicMuted(false);
      saveAudioPrefs({
        globalMuted: false,
        sfxMuted: mutedRef.current,
        musicMuted: false,
      });
      audioEngine.setMusicMuted(false);
      audioEngine.setGlobalMuted(false, screenRef.current !== 'paused');
      audioEngine.playUiClick();
      return;
    }
    audioEngine.playUiClick();
    const next = !musicMutedRef.current;
    musicMutedRef.current = next;
    setMusicMuted(next);
    saveAudioPrefs({
      globalMuted: globalMutedRef.current,
      sfxMuted: mutedRef.current,
      musicMuted: next,
    });
    audioEngine.setMusicMuted(next);
    if (!next && screenRef.current !== 'paused') {
      audioEngine.startMusic();
    }
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
    setAutoPaused(false);
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();
    audioEngine.resumeAllAudio(!globalMutedRef.current && !musicMutedRef.current);
    audioEngine.playUiClick();
    CG_SDK.gameplayStop();
    if (onlineRoleRef.current !== 'offline') {
      friendRoomRef.current?.send({ type: 'BACK_TO_SELECT' });
    }
    engineRef.current?.setScreen('select');
    engineRef.current?.setPreviewSelection(p1Id, p2Id, stageId, difficulty);
    setScreen('select');
  }, [p1Id, p2Id, stageId, difficulty]);

  const handleVictoryRematch = useCallback(() => {
    void CG_SDK.requestMidgameAd({
      onAdStarted: pauseForAd,
      onAdFinished: restoreAfterAd,
      onAdError: restoreAfterAd,
    }).finally(() => {
      handleStartFight();
    });
  }, [pauseForAd, restoreAfterAd, handleStartFight]);

  const handleVictoryBackToSelect = useCallback(() => {
    void CG_SDK.requestMidgameAd({
      onAdStarted: pauseForAd,
      onAdFinished: restoreAfterAd,
      onAdError: restoreAfterAd,
    }).finally(() => {
      handleQuitToSelect();
    });
  }, [pauseForAd, restoreAfterAd, handleQuitToSelect]);

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
    <main
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 h-[100dvh] w-[100dvw] overflow-hidden select-none touch-none bg-[#0e0c0a]"
    >
      {/* Isolated WebGL Three.js Canvas Mount */}
      <div
        ref={canvasMountRef}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="arena-canvas-mount"
        className="fixed inset-0 z-0 h-[100dvh] w-[100dvw]"
      />

      {/* Screen Overlays */}
      {screen === 'loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {screen === 'auth' && (
        <AuthGateScreen
          onSignIn={handleLogin}
          onSignUp={handleCreateAccount}
          onSignInAsGuest={handleGateGuest}
        />
      )}

      {screen === 'title' && (
        <TitleScreen
          globalMuted={globalMuted}
          musicMuted={musicMuted}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          modalOpen={
            howToPlayOpen || aboutOpen || satireNoticeOpen || accountModalOpen || settingsOpen
          }
          onStart={handleOpenSelect}
          onOpenSettings={() => {
            audioEngine.unlock();
            audioEngine.playUiClick();
            setSettingsOpen(true);
          }}
          onToggleGlobalMute={handleToggleGlobalMute}
          onToggleMusic={handleToggleMusic}
          onToggleFullscreen={toggleFullscreen}
          onOpenHowToPlay={() => {
            audioEngine.playUiClick();
            setHowToPlayOpen(true);
          }}
          onOpenSatireNotice={() => {
            audioEngine.playUiClick();
            setSatireNoticeOpen(true);
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
          playerProfile={playerProfile}
          globalMuted={globalMuted}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          onSelectP1={handleSelectP1}
          onSelectP2={handleSelectP2}
          onSelectStage={handleSelectStage}
          onSelectDifficulty={handleSelectDifficulty}
          onUnlockFighter={handleUnlockFighter}
          onRequestRewardedAd={handleRequestFighterRewardedAd}
          onWatchFreeCoinsAd={handleWatchFreeCoinsAd}
          freeCoinsAdBusy={freeCoinsAdBusy}
          onUnlockStage={handleUnlockStage}
          onToggleGlobalMute={handleToggleGlobalMute}
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
          globalMuted={globalMuted}
          superBanner={hud.superBanner}
          callouts={callouts}
          onSwitchFighter={handlePreviewSwitchFighter}
          onTriggerSuper={handlePreviewTriggerSuper}
          onToggleGlobalMute={handleToggleGlobalMute}
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
          globalMuted={globalMuted}
          onlineRole={activeOnlineRole}
          roomCode={friendRoomState.roomCode}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          onPause={handlePause}
          onToggleGlobalMute={handleToggleGlobalMute}
          onToggleFullscreen={toggleFullscreen}
          onSkipIntro={handleSkipIntro}
          onTouchDirection={handleTouchDirection}
          onTouchAction={handleTouchAction}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          globalMuted={globalMuted}
          muted={muted}
          musicMuted={musicMuted}
          graphics={graphics}
          autoPaused={autoPaused}
          onResume={handleResume}
          onToggleGlobalMute={handleToggleGlobalMute}
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
          onRematch={handleVictoryRematch}
          onCharacterSelect={handleVictoryBackToSelect}
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
      {settingsOpen && (screen === 'title' || screen === 'select') && (
        <SettingsModal
          profile={playerProfile}
          muted={globalMuted || muted}
          musicMuted={globalMuted || musicMuted}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onStartSuperPreview={handleStartSuperPreview}
          onOpenAccount={() => {
            audioEngine.playUiClick();
            setSettingsOpen(false);
            setAccountModalOpen(true);
          }}
          onClose={() => {
            audioEngine.playUiClick();
            setSettingsOpen(false);
          }}
        />
      )}
      {accountModalOpen && (
        <PlayerAccountModal
          profile={playerProfile}
          onPlayAsGuest={handlePlayAsGuest}
          onCreateAccount={handleCreateAccount}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onClose={() => {
            audioEngine.playUiClick();
            setAccountModalOpen(false);
          }}
        />
      )}
      {satireNoticeOpen && (
        <SatireNoticeModal
          onContinue={() => {
            audioEngine.playUiClick();
            setSatireNoticeOpen(false);
          }}
        />
      )}
      {howToPlayOpen && <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {/* Non-Intrusive CrazyGames Rewarded Ad / Coin Toast */}
      {adToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="ad-status-toast"
          className={`pointer-events-none fixed top-4 left-1/2 z-[60] -translate-x-1/2 border-2 px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wider shadow-[4px_4px_0_#0f0a06] ${
            adToast.tone === 'error'
              ? 'border-[#f87171] bg-[#450a0a]/95 text-[#fecaca]'
              : 'border-[#4ade80] bg-[#14532d]/95 text-[#bbf7d0]'
          }`}
        >
          {adToast.text}
        </div>
      )}

      {/* Mobile Portrait Orientation Guard */}
      <PortraitGuard onPortraitBlockedChange={handlePortraitBlockedChange} />
    </main>
  );
}

