import { useEffect, useState } from 'react';
import { CheckCircle2, LogIn, Swords, UserCheck, UserPlus } from 'lucide-react';
import {
  checkUsernameAvailability,
  validateUsernameFormat,
  type AuthResult,
} from '../game/playerAccount';

interface AuthGateScreenProps {
  onSignIn: (username: string, password: string) => Promise<AuthResult>;
  onSignUp: (username: string, password: string) => Promise<AuthResult>;
  onSignInAsGuest: () => void;
}

type GateTab = 'signin' | 'signup';

export function AuthGateScreen({
  onSignIn,
  onSignUp,
  onSignInAsGuest,
}: AuthGateScreenProps) {
  const [tab, setTab] = useState<GateTab>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (tab !== 'signup') {
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
          available: res.available,
          message: res.message,
        });
      });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res =
        tab === 'signup'
          ? await onSignUp(username, password)
          : await onSignIn(username, password);
      if (!res.ok) {
        setErrorMsg(res.error ?? 'Authentication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="auth-gate-screen"
      className="safe-pad-modal fixed inset-0 z-40 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-[#0a0807]/88 px-3 backdrop-blur-xs select-none"
    >
      <div className="preloader-fade-in max-h-[94dvh] w-full max-w-md overflow-y-auto touch-pan-y border-3 border-[#facc15] bg-[#14100d]/96 text-white shadow-[0_24px_60px_rgba(0,0,0,0.88),8px_8px_0_#dc2626]">
        {/* Brand Header */}
        <div className="flex items-center justify-between bg-[#dc2626] px-5 py-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
            <div>
              <h1 className="font-display text-2xl font-extrabold uppercase italic leading-none tracking-wider text-white">
                DESI DANGAL
              </h1>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#fef08a]">
                PLAYER SIGN IN
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Switch Tabs: Sign In | Sign Up */}
          <div className="grid grid-cols-2 gap-1 border border-white/15 bg-[#0d0a08] p-1">
            <button
              type="button"
              data-testid="gate-tab-signin"
              onClick={() => {
                setTab('signin');
                setErrorMsg(null);
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 py-2 font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                tab === 'signin'
                  ? 'bg-[#dc2626] text-white'
                  : 'text-[#d6d3d1] hover:text-white'
              }`}
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              data-testid="gate-tab-signup"
              onClick={() => {
                setTab('signup');
                setErrorMsg(null);
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 py-2 font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                tab === 'signup'
                  ? 'bg-[#dc2626] text-white'
                  : 'text-[#d6d3d1] hover:text-white'
              }`}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Sign Up</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="gate-username-input"
                className="block text-xs font-bold uppercase tracking-wider text-[#fde68a]"
              >
                Player ID / Username
              </label>
              <input
                id="gate-username-input"
                data-testid="gate-username-input"
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

              {tab === 'signup' && availability && (
                <div
                  data-testid="gate-availability-msg"
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
                htmlFor="gate-password-input"
                className="block text-xs font-bold uppercase tracking-wider text-[#fde68a]"
              >
                Password
              </label>
              <input
                id="gate-password-input"
                data-testid="gate-password-input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Enter password (min 4 characters)"
                className="mt-1 w-full border-2 border-white/25 bg-[#0d0a08] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#facc15] focus:outline-none"
              />
            </div>

            {tab === 'signup' && (
              <p className="text-[11px] leading-snug text-[#a8a29e]">
                Create your unique Player ID &amp; password to save coins and fighter unlocks across visits.
              </p>
            )}

            {errorMsg && (
              <div
                role="alert"
                data-testid="gate-error-msg"
                className="border border-[#ef4444] bg-[#450a0a]/80 px-3 py-2 text-xs font-bold text-[#fecaca]"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              data-testid="gate-submit-btn"
              disabled={submitting || (tab === 'signup' && availability !== null && !availability.available)}
              className="w-full cursor-pointer border-2 border-[#0f0a06] bg-[#facc15] px-4 py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[4px_4px_0_#dc2626] transition hover:bg-[#fde047] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting
                ? 'PLEASE WAIT...'
                : tab === 'signup'
                  ? 'Sign Up & Enter Arena'
                  : 'Sign In'}
            </button>
          </form>

          <div className="relative flex items-center py-0.5">
            <div className="flex-1 border-t border-white/15" />
            <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#a8a29e]">
              OR
            </span>
            <div className="flex-1 border-t border-white/15" />
          </div>

          <button
            type="button"
            data-testid="gate-guest-btn"
            onClick={onSignInAsGuest}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-white/25 bg-[#1e1814] px-4 py-2 font-display text-base font-extrabold uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]"
          >
            <UserCheck className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
            <span>Sign In as Guest</span>
          </button>
        </div>
      </div>
    </div>
  );
}
