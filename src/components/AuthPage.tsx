import React, { useState } from 'react';
import { ArrowRight, BookOpen, Cloud, FolderKanban, Lock, Mail, User } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../supabaseClient';
import type { AuthResponse } from '../types';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onAuthenticated: (auth: AuthResponse) => void;
}

export function AuthPage({ initialMode = 'login', onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
    window.history.replaceState(null, '', nextMode === 'signup' ? '/signup' : '/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'signup') {
      if (name.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const cleanEmail = email.trim();
      const cleanName = name.trim();

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              name: cleanName,
              display_name: cleanName,
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError(
            'An account with this email already exists. Please sign in instead or use a different email.',
          );
          return;
        }
        if (!data.session) {
          setInfoMessage('Check your email and confirm your account before logging in.');
          return;
        }

        const userEmail = data.user?.email || cleanEmail;
        const response = await api.syncSupabaseSession({
          email: userEmail,
          name: cleanName,
          mode: 'signup',
        });
        onAuthenticated(response);
        window.history.replaceState(null, '', '/');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        if (!data.session) {
          setError('Check your email and confirm your account before logging in.');
          return;
        }

        const metaName =
          (typeof data.user?.user_metadata?.full_name === 'string' && data.user.user_metadata.full_name) ||
          (typeof data.user?.user_metadata?.display_name === 'string' && data.user.user_metadata.display_name) ||
          (typeof data.user?.user_metadata?.name === 'string' && data.user.user_metadata.name) ||
          undefined;
        const userEmail = data.user?.email || cleanEmail;
        const response = await api.syncSupabaseSession({
          email: userEmail,
          name: metaName,
          mode: 'login',
        });
        if (!metaName && response.user.name) {
          await supabase.auth.updateUser({
            data: {
              full_name: response.user.name,
              name: response.user.name,
              display_name: response.user.name,
            },
          });
        }
        onAuthenticated(response);
        window.history.replaceState(null, '', '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await api.loginDemo();
      onAuthenticated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-12">
      {/* Left Column: Auth Form */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:col-span-6 lg:px-16 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              AI Notes
            </span>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === 'signup'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <div className="mx-auto my-10 w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl text-balance">
              {mode === 'login'
                ? 'Welcome back to your cloud workspace'
                : 'Create your AI Notes workspace'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {mode === 'login'
                ? 'Sign in to access, categorize, and synchronize your notes across cloud storage.'
                : 'Start organizing your ideas, research, and daily notes with persistent cloud storage.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Elena Vance"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                {isSubmitting
                  ? mode === 'login'
                    ? 'Signing In...'
                    : 'Creating Account...'
                  : mode === 'login'
                    ? 'Sign In to Dashboard'
                    : 'Create Account'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-3 text-xs font-medium text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}

          {infoMessage && (
            <p
              role="status"
              className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              {infoMessage}
            </p>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-500 dark:text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Continue with Demo Workspace (demo@ainotes.cloud)
          </button>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login' ? (
              <>
                New to AI Notes?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Sign in instead
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          AI Notes · Cloud-synchronized personal knowledge workspace
        </p>
      </div>

      {/* Right Column: Editorial Workspace Showcase */}
      <div className="relative hidden lg:col-span-6 lg:flex lg:flex-col lg:justify-end lg:overflow-hidden lg:border-l lg:border-slate-200 dark:lg:border-slate-800">
        {!imgFailed ? (
          <img
            src="/src/assets/images/auth_workspace_editorial_1795152807865.jpg"
            alt="Minimalist desk with open notebook and aluminum laptop in natural morning light"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/15" />

        <div className="relative z-10 p-12 text-white">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-balance">
            Structured notes, backed by reliable cloud storage.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-200">
            Organize thoughts into custom categories, capture drafts from quick modal overlays, and keep every revision synchronized across your workspace.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/15 pt-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Cloud className="h-4 w-4 text-blue-400" />
                <span>Cloud Sync Vault</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Automatic versioned storage with one-click JSON archive backups.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FolderKanban className="h-4 w-4 text-blue-400" />
                <span>Instant Categorization</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Filter across Work, Ideas, Research, and custom project folders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
