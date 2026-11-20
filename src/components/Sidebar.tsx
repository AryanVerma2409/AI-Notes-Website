import React, { useState } from 'react';
import {
  BookOpen,
  Cloud,
  FileText,
  FolderKanban,
  Home,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import type { CategoryItem, NoteItem, UserProfile } from '../types';

interface SidebarProps {
  user: UserProfile;
  activeView: 'home' | 'notes';
  selectedCategoryId: string | 'all';
  categories: CategoryItem[];
  notes: NoteItem[];
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectHome: () => void;
  onSelectMyNotes: (categoryId?: string | 'all') => void;
  onOpenCreateNote: () => void;
  onOpenAccountSettings: () => void;
  onOpenCategoryManager: () => void;
  onOpenQuickLauncher: (mode: 'home' | 'notes') => void;
}

export function Sidebar({
  user,
  activeView,
  selectedCategoryId,
  categories,
  notes,
  isMobileOpen,
  onCloseMobile,
  onSelectHome,
  onSelectMyNotes,
  onOpenCreateNote,
  onOpenAccountSettings,
  onOpenCategoryManager,
  onOpenQuickLauncher,
}: SidebarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const activeNotes = notes.filter((n) => !n.isArchived);

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <aside className="flex h-full w-[260px] flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onSelectHome();
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            AI Notes
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Sidebar Navigation */}
      <nav aria-label="Primary Sidebar" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {/* 1. Home */}
          <div className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (activeView === 'home') {
                  onOpenQuickLauncher('home');
                } else {
                  onSelectHome();
                }
                onCloseMobile();
              }}
              className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeView === 'home'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Home className="h-4 w-4 shrink-0" />
              <span>Home</span>
            </button>
            <button
              type="button"
              title="Workspace Quick Actions"
              aria-label="Open workspace quick actions modal"
              onClick={() => {
                onOpenQuickLauncher('home');
                onCloseMobile();
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 2. My Notes */}
          <div className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (activeView === 'notes' && selectedCategoryId === 'all') {
                  onOpenQuickLauncher('notes');
                } else {
                  onSelectMyNotes('all');
                }
                onCloseMobile();
              }}
              className={`flex flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeView === 'notes'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="h-4 w-4 shrink-0" />
                <span>My Notes</span>
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {activeNotes.length}
              </span>
            </button>
            <button
              type="button"
              title="Quick Find Notes"
              aria-label="Open quick find notes modal"
              onClick={() => {
                onOpenQuickLauncher('notes');
                onCloseMobile();
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 3. Create Notes */}
          <button
            type="button"
            onClick={() => {
              onOpenCreateNote();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Create Notes</span>
          </button>

          {/* 4. Account Settings */}
          <button
            type="button"
            onClick={() => {
              onOpenAccountSettings();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Account Settings</span>
          </button>
        </div>

        {/* Categories Section */}
        <div className="mt-7 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Categories
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenCategoryManager();
                onCloseMobile();
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <FolderKanban className="h-3 w-3" />
              <span>Manage</span>
            </button>
          </div>

          <div className="space-y-0.5">
            {categories.map((cat) => {
              const count = activeNotes.filter((n) => n.categoryId === cat.id).length;
              const isSelected = activeView === 'notes' && selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onSelectMyNotes(cat.id);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: cat.accentColor }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom User & Cloud Profile Trigger */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onOpenAccountSettings();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {!avatarFailed && user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-display text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {initials || 'AN'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {user.name}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
              <Cloud className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">{user.cloudProvider}</span>
            </p>
          </div>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block lg:shrink-0">{content}</div>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
