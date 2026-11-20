import React, { useMemo, useState } from 'react';
import {
  FileText,
  FolderKanban,
  Home,
  Plus,
  Search,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { formatRelativeTime } from '../lib/format';
import type { CategoryItem, NoteItem } from '../types';

interface QuickLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'home' | 'notes';
  notes: NoteItem[];
  categories: CategoryItem[];
  onNavigateHome: () => void;
  onNavigateMyNotes: (categoryId?: string) => void;
  onOpenCreateNote: () => void;
  onOpenEditNote: (note: NoteItem) => void;
  onOpenAccountSettings: () => void;
  onOpenCategories: () => void;
}

export function QuickLauncherModal({
  isOpen,
  onClose,
  mode,
  notes,
  categories,
  onNavigateHome,
  onNavigateMyNotes,
  onOpenCreateNote,
  onOpenEditNote,
  onOpenAccountSettings,
  onOpenCategories,
}: QuickLauncherModalProps) {
  const [query, setQuery] = useState('');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = notes.filter((n) => !n.isArchived);
    if (!q) return active.slice(0, 6);
    return active
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (categoryMap.get(n.categoryId) || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [notes, query, categoryMap]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'home' ? 'Workspace Quick Actions' : 'Quick Find & Organize Notes'}
      subtitle="Jump to any note, switch categories, or launch workspace actions"
      size="md"
    >
      <div className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes by title, keyword, or category..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateNote();
              }}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50/50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Create New Note</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCategories();
              }}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50/50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Manage Categories</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (mode === 'home') {
                  onNavigateMyNotes();
                } else {
                  onNavigateHome();
                }
              }}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50/50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <Home className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>{mode === 'home' ? 'Open My Notes Library' : 'Return to Home Overview'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAccountSettings();
              }}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50/50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Account & Cloud Settings</span>
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {query.trim() ? 'Matching Notes' : 'Recent Notes'}
          </p>
          {filteredNotes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No notes match your search query.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditNote(note);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {note.title}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {categoryMap.get(note.categoryId) || 'General'} · {note.wordCount} words ·{' '}
                        {formatRelativeTime(note.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
