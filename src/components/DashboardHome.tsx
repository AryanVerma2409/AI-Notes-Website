import React from 'react';
import {
  ArrowRight,
  Cloud,
  Edit3,
  FolderKanban,
  Pin,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { formatBytes, formatRelativeTime, getGreeting } from '../lib/format';
import type { CategoryItem, NoteItem, UserProfile } from '../types';

interface DashboardHomeProps {
  user: UserProfile;
  notes: NoteItem[];
  categories: CategoryItem[];
  estimatedBytes: number;
  isSyncing: boolean;
  onOpenCreateNote: () => void;
  onOpenEditNote: (note: NoteItem) => void;
  onTogglePin: (note: NoteItem) => Promise<void>;
  onOpenMyNotes: (categoryId?: string | 'all') => void;
  onOpenCategoryManager: () => void;
  onOpenAccountSettings: () => void;
  onSyncNow: () => Promise<void>;
}

export function DashboardHome({
  user,
  notes,
  categories,
  estimatedBytes,
  isSyncing,
  onOpenCreateNote,
  onOpenEditNote,
  onTogglePin,
  onOpenMyNotes,
  onOpenCategoryManager,
  onOpenAccountSettings,
  onSyncNow,
}: DashboardHomeProps) {
  const activeNotes = notes.filter((n) => !n.isArchived);
  const pinnedNotes = activeNotes.filter((n) => n.isPinned);
  const recentNotes = activeNotes.slice(0, 6);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Greeting & Cloud Status Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100 text-balance">
            {getGreeting(user.name)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <Cloud className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{user.cloudProvider}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{user.cloudBucketName}</span>
            <span aria-hidden="true">·</span>
            <span>Last synced {formatRelativeTime(user.lastSyncedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateNote}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Note</span>
          </button>
        </div>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Notes</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {activeNotes.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pinned Notes</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {pinnedNotes.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Categories</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {categories.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cloud Storage</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {formatBytes(estimatedBytes)}
          </p>
        </div>
      </div>

      {/* Quick Action Row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Quick actions:
        </span>
        <button
          type="button"
          onClick={onOpenCreateNote}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Note Modal</span>
        </button>
        <button
          type="button"
          onClick={onOpenCategoryManager}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 whitespace-nowrap"
        >
          <FolderKanban className="h-3.5 w-3.5" />
          <span>Organize Categories</span>
        </button>
        <button
          type="button"
          onClick={onOpenAccountSettings}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 whitespace-nowrap"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Cloud & Account Settings</span>
        </button>
      </div>

      {/* Main Content Split: Recent Notes + Category Distribution */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent & Pinned Notes
            </h2>
            <button
              type="button"
              onClick={() => onOpenMyNotes('all')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>View all notes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Your cloud workspace is empty
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Create your first note to begin organizing ideas and syncing to {user.cloudProvider}.
              </p>
              <button
                type="button"
                onClick={onOpenCreateNote}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Note</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recentNotes.map((note) => {
                const cat = categoryMap.get(note.categoryId);
                return (
                  <article
                    key={note.id}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenEditNote(note)}
                          className="text-left"
                        >
                          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                            {note.title}
                          </h3>
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePin(note)}
                          aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                            note.isPinned
                              ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenEditNote(note)}
                        className="mt-2 block w-full text-left"
                      >
                        <p className="line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {note.content || 'Empty note — click to start writing.'}
                        </p>
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                          {cat?.name || 'General'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{note.wordCount}w</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{formatRelativeTime(note.updatedAt)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenEditNote(note)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 whitespace-nowrap shrink-0"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Notes by Category
            </h2>
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Manage
            </button>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {categories.map((cat) => {
              const count = activeNotes.filter((n) => n.categoryId === cat.id).length;
              const pct = activeNotes.length > 0 ? Math.round((count / activeNotes.length) * 100) : 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onOpenMyNotes(cat.id)}
                  className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: cat.accentColor }}
                      />
                      <span>{cat.name}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${pct}%`, backgroundColor: cat.accentColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
