import React, { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Download,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { api, getStorageBackendMode, SUPABASE_SCHEMA_SQL } from '../lib/api';
import { supabase } from '../supabaseClient';
import { formatBytes, formatShortDateTime } from '../lib/format';
import type { CloudProvider, CloudSyncSummary, ThemePreference, UserProfile } from '../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  noteCount: number;
  categoryCount: number;
  estimatedBytes: number;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => Promise<void>;
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  'AI Notes Cloud',
  'Google Drive Mirror',
  'AWS S3 Vault',
  'Dropbox Sync',
];

export function AccountSettingsModal({
  isOpen,
  onClose,
  user,
  noteCount,
  categoryCount,
  estimatedBytes,
  onUserUpdated,
  onLogout,
}: AccountSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'cloud'>('profile');
  const [name, setName] = useState(user.name);
  const [themePreference, setThemePreference] = useState<ThemePreference>(user.themePreference);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>(user.cloudProvider);
  const [cloudBucketName, setCloudBucketName] = useState(user.cloudBucketName);
  const [autoSync, setAutoSync] = useState(user.autoSync);

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncSummary, setSyncSummary] = useState<CloudSyncSummary | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const storageMode = getStorageBackendMode();

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setError('Unable to copy automatically. Check supabase_schema.sql in the project root.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setName(user.name);
    setThemePreference(user.themePreference);
    setCloudProvider(user.cloudProvider);
    setCloudBucketName(user.cloudBucketName);
    setAutoSync(user.autoSync);
    setFeedback(null);
    setError(null);
    setSyncSummary(null);
  }, [isOpen, user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const res = await api.updateAccount({
        name: trimmedName,
        themePreference,
        cloudProvider,
        cloudBucketName: cloudBucketName.trim(),
        autoSync,
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await supabase.auth.updateUser({
            data: {
              full_name: trimmedName,
              name: trimmedName,
              display_name: trimmedName,
            },
          });
        }
      } catch {
        // Ignore if user is on local demo session rather than Supabase session
      }

      onUserUpdated(res.user);
      setFeedback('Account and cloud storage settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setError(null);
    setFeedback(null);
    setIsSyncing(true);
    try {
      const res = await api.syncCloud();
      setSyncSummary(res.summary);
      onUserUpdated({
        ...user,
        lastSyncedAt: res.summary.syncedAt,
      });
      setFeedback(`All ${res.summary.noteCount} notes synchronized to ${res.summary.provider}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const blob = await api.exportCloudBackup();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ai-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setFeedback('Cloud backup archive downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Account Settings"
      subtitle="Personalize your workspace profile, theme, and cloud storage integration"
      size="lg"
    >
      <div className="mb-5 flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" />
          <span>Profile & Theme</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cloud')}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'cloud'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Cloud className="h-3.5 w-3.5" />
          <span>Cloud Storage Integration</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {feedback && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-5">
        {activeTab === 'profile' ? (
          <>
            <div className="flex items-center gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
              {!avatarFailed && user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-display text-base font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {initials || 'AN'}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-name"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Display Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-email"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Account Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  disabled
                  value={user.email}
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
                />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Interface Theme
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setThemePreference('light')}
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    themePreference === 'light'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <Sun className="h-4 w-4 shrink-0" />
                  <span>Light Workspace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemePreference('dark')}
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    themePreference === 'dark'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <Moon className="h-4 w-4 shrink-0" />
                  <span>Dark Workspace</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {storageMode === 'supabase-db' ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <p className="font-semibold">Cross-device sync active (Supabase Cloud Database)</p>
                <p className="mt-0.5 opacity-90">
                  Your notes and categories are saved to Supabase Postgres and sync across all computers.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {storageMode === 'local-browser'
                        ? 'Saved in this browser only (Cross-device sync inactive)'
                        : 'Saved to local server storage'}
                    </p>
                    <p className="mt-0.5 opacity-90">
                      Run <span className="font-mono">supabase_schema.sql</span> once in your Supabase SQL Editor so notes sync across computers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="h-8 rounded-md bg-amber-900 px-3 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 whitespace-nowrap shrink-0"
                  >
                    {copiedSql ? 'Copied SQL!' : 'Copy SQL Setup'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Synced Notes</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {syncSummary ? syncSummary.noteCount : noteCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Categories</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {syncSummary ? syncSummary.categoryCount : categoryCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cloud Footprint</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {formatBytes(syncSummary ? syncSummary.storageBytes : estimatedBytes)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cloud-provider"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cloud Storage Provider
                </label>
                <select
                  id="cloud-provider"
                  value={cloudProvider}
                  onChange={(e) => setCloudProvider(e.target.value as CloudProvider)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {CLOUD_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cloud-bucket"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cloud Vault / Folder Name
                </label>
                <input
                  id="cloud-bucket"
                  type="text"
                  minLength={3}
                  maxLength={80}
                  value={cloudBucketName}
                  onChange={(e) => setCloudBucketName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Automatic Cloud Sync
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Last synchronized {formatShortDateTime(user.lastSyncedAt)}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoSync}
                onClick={() => setAutoSync((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  autoSync ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSync ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExporting ? 'Exporting...' : 'Export Backup (.json)'}</span>
              </button>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-red-600 hover:border-red-200 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </ModalOverlay>
  );
}
