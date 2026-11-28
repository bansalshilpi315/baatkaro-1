import { useEffect, useState } from 'react';
import { CheckCircle2, Coins, LogIn, LogOut, ShieldCheck, Trophy, User, UserPlus, Users, X } from 'lucide-react';
import { FIGHTER_LIST, STAGE_LIST } from '../game/characters';
import {
  checkUsernameAvailability,
  validateUsernameFormat,
  type AuthResult,
  type PlayerProfile,
} from '../game/playerAccount';

interface PlayerAccountModalProps {
  profile: PlayerProfile;
  onPlayAsGuest: () => void;
  onCreateAccount: (username: string, password: string) => Promise<AuthResult>;
  onLogin: (username: string, password: string) => Promise<AuthResult>;
  onLogout: () => void;
  onClose: () => void;
}

type AuthTab = 'login' | 'create';

export function PlayerAccountModal({
  profile,
  onPlayAsGuest,
  onCreateAccount,
  onLogin,
  onLogout,
  onClose,
}: PlayerAccountModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    checkedFor: string;
    available: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live unique username availability check during Create Account
  useEffect(() => {
    if (profile.mode === 'account' || tab !== 'create') {
      setAvailability(null);
      return;
    }
    const trimmed = username.trim();
    if (!trimmed) {
      setAvailability(null);
      return;
    }
    const format = validateUsernameFormat(trimmed);
    if (!format.valid) {
      setAvailability({
        checkedFor: trimmed,
        available: false,
        message: format.error ?? 'Invalid username.',
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(trimmed).then((res) => {
        if (cancelled) return;
        setAvailability({
          checkedFor: trimmed,
          available: res.available,
          message: res.message,
        });
      });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, tab, profile.mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const result =
        tab === 'create'
          ? await onCreateAccount(username, password)
          : await onLogin(username, password);
      if (!result.ok) {
        setErrorMsg(result.error ?? 'Authentication failed.');
      } else {
        setUsername('');
        setPassword('');
        setErrorMsg(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-account-title"
      data-testid="player-account-modal"
      className="safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black/82 px-3"
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d] text-white shadow-[8px_8px_0_#dc2626]">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#dc2626] px-5 py-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <h2
              id="player-account-title"
              className="font-display text-xl font-extrabold uppercase italic tracking-wider text-white sm:text-2xl"
            >
              {profile.mode === 'account' ? 'PLAYER PROFILE' : 'PLAYER ACCOUNT'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Player Account"
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-2 border-white/50 bg-[#0f0a06] text-white hover:border-[#facc15] hover:text-[#facc15]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {profile.mode === 'account' ? (
          /* LOGGED-IN ACCOUNT SUMMARY */
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between border border-[#facc15]/40 bg-[#1d1713] px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#a8a29e]">
                  SIGNED IN AS
                </div>
                <div
                  data-testid="profile-active-username"
                  className="font-display text-2xl font-extrabold tracking-wide text-[#facc15]"
                >
                  {profile.displayName}
                </div>
              </div>
              {profile.allModesUnlocked && (
                <div className="flex items-center gap-1 border border-[#4ade80]/50 bg-[#14532d]/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#86efac]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ALL UNLOCKED</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="border border-white/15 bg-[#1b1511] px-2 py-3">
                <Coins className="mx-auto h-4 w-4 text-[#facc15]" aria-hidden="true" />
                <div
                  data-testid="profile-coins-value"
                  className="mt-1 font-mono-num text-lg font-extrabold text-white"
                >
                  {profile.coins.toLocaleString()}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a8a29e]">
                  Coins
                </div>
              </div>

              <div className="border border-white/15 bg-[#1b1511] px-2 py-3">
                <Users className="mx-auto h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
                <div
                  data-testid="profile-fighters-count"
                  className="mt-1 font-mono-num text-lg font-extrabold text-white"
                >
                  {profile.unlockedFighters.length} / {FIGHTER_LIST.length}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a8a29e]">
                  Fighters
                </div>
              </div>

              <div className="border border-white/15 bg-[#1b1511] px-2 py-3">
                <Trophy className="mx-auto h-4 w-4 text-[#fb923c]" aria-hidden="true" />
                <div
                  data-testid="profile-wins-count"
                  className="mt-1 font-mono-num text-lg font-extrabold text-white"
                >
                  {profile.wins}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a8a29e]">
                  Wins
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border border-white/10 bg-[#1a1410] px-3.5 py-2 text-xs text-[#d6d3d1]">
              <span>Arcade Stage Access</span>
              <span className="font-mono-num font-bold text-[#fde047]">
                Stage 1 – {profile.highestStage} / {STAGE_LIST.length}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                data-testid="logout-btn"
                onClick={onLogout}
                className="flex cursor-pointer items-center gap-1.5 border-2 border-[#ef4444]/80 bg-[#2a1212] px-4 py-2 font-display text-base font-extrabold uppercase tracking-wider text-[#fca5a5] transition hover:bg-[#dc2626] hover:text-white"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Log Out</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer border-2 border-[#0f0a06] bg-[#facc15] px-5 py-2 font-display text-base font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[3px_3px_0_#dc2626] hover:bg-[#fde047]"
              >
                Back to Arena
              </button>
            </div>
          </div>
        ) : (
          /* GUEST / LOGIN / CREATE ACCOUNT VIEW */
          <div className="space-y-4 p-5">
            {/* Active Guest Quick Status + 1-Click Play as Guest */}
            <div className="flex items-center justify-between gap-3 border border-white/15 bg-[#1b1511] px-3.5 py-2.5">
              <div>
                <div className="text-xs font-bold text-white">
                  Guest Session ·{' '}
                  <span className="font-mono-num text-[#facc15]">
                    {profile.coins.toLocaleString()} Coins
                  </span>
                </div>
                <div className="text-[11px] text-[#a8a29e]">
                  {profile.unlockedFighters.length}/{FIGHTER_LIST.length} Fighters · {profile.wins} Wins
                </div>
              </div>
              <button
                type="button"
                data-testid="play-as-guest-btn"
                onClick={onPlayAsGuest}
                className="cursor-pointer whitespace-nowrap shrink-0 border-2 border-[#0f0a06] bg-[#facc15] px-3.5 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[2px_2px_0_#dc2626] hover:bg-[#fde047]"
              >
                Play as Guest
              </button>
            </div>

            {/* Switch Tabs: Login | Create Account */}
            <div className="grid grid-cols-2 gap-1 bg-[#0d0a08] p-1 border border-white/15">
              <button
                type="button"
                data-testid="auth-tab-login"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`flex cursor-pointer items-center justify-center gap-1.5 py-2 font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  tab === 'login'
                    ? 'bg-[#dc2626] text-white'
                    : 'text-[#d6d3d1] hover:text-white'
                }`}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Login</span>
              </button>
              <button
                type="button"
                data-testid="auth-tab-create"
                onClick={() => {
                  setTab('create');
                  setErrorMsg(null);
                }}
                className={`flex cursor-pointer items-center justify-center gap-1.5 py-2 font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  tab === 'create'
                    ? 'bg-[#dc2626] text-white'
                    : 'text-[#d6d3d1] hover:text-white'
                }`}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Create Account</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="player-username-input"
                  className="block text-xs font-bold uppercase tracking-wider text-[#fde68a]"
                >
                  Player ID / Username
                </label>
                <input
                  id="player-username-input"
                  data-testid="auth-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrorMsg(null);
                  }}
                  maxLength={16}
                  autoComplete="username"
                  placeholder="3-16 chars (a-z, 0-9, @, _, -)"
                  className="mt-1 w-full border-2 border-white/25 bg-[#0d0a08] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#facc15] focus:outline-none"
                />

                {tab === 'create' && availability && (
                  <div
                    data-testid="username-availability-msg"
                    className={`mt-1.5 flex items-center gap-1.5 text-xs font-bold ${
                      availability.available ? 'text-[#4ade80]' : 'text-[#fca5a5]'
                    }`}
                  >
                    {availability.available && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{availability.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="player-password-input"
                  className="block text-xs font-bold uppercase tracking-wider text-[#fde68a]"
                >
                  Password
                </label>
                <input
                  id="player-password-input"
                  data-testid="auth-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  autoComplete={tab === 'create' ? 'new-password' : 'current-password'}
                  placeholder="Enter password (min 4 characters)"
                  className="mt-1 w-full border-2 border-white/25 bg-[#0d0a08] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#facc15] focus:outline-none"
                />
              </div>

              {tab === 'create' && (
                <p className="text-[11px] leading-snug text-[#a8a29e]">
                  No email or personal info needed. Any Guest coins and unlocked fighters from this session will automatically transfer to your new ID.
                </p>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  data-testid="auth-error-msg"
                  className="border border-[#ef4444] bg-[#450a0a]/80 px-3 py-2 text-xs font-bold text-[#fecaca]"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                data-testid="auth-submit-btn"
                disabled={submitting || (tab === 'create' && availability !== null && !availability.available)}
                className="w-full cursor-pointer border-2 border-[#0f0a06] bg-[#dc2626] px-4 py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0_#facc15] transition hover:bg-[#ef4444] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {submitting
                  ? 'PLEASE WAIT...'
                  : tab === 'create'
                    ? 'Create Account & Save'
                    : 'Login & Restore Progress'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
