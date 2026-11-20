import React, { useMemo, useState } from 'react';
import {
  Archive,
  Edit3,
  LayoutGrid,
  List,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/format';
import type { CategoryItem, NoteItem } from '../types';

interface MyNotesViewProps {
  notes: NoteItem[];
  categories: CategoryItem[];
  selectedCategoryId: string | 'all';
  searchQuery: string;
  isLoading: boolean;
  onSelectCategory: (categoryId: string | 'all') => void;
  onOpenCreateNote: () => void;
  onOpenEditNote: (note: NoteItem) => void;
  onQuickCategoryChange: (noteId: string, categoryId: string) => Promise<void>;
  onTogglePin: (note: NoteItem) => Promise<void>;
  onToggleArchive: (note: NoteItem) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export function MyNotesView({
  notes,
  categories,
  selectedCategoryId,
  searchQuery,
  isLoading,
  onSelectCategory,
  onOpenCreateNote,
  onOpenEditNote,
  onQuickCategoryChange,
  onTogglePin,
  onToggleArchive,
  onDeleteNote,
}: MyNotesViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'words'>('updated');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (showArchived !== n.isArchived) return false;
      if (selectedCategoryId !== 'all' && n.categoryId !== selectedCategoryId) return false;
      if (q) {
        const catName = (categoryMap.get(n.categoryId)?.name || '').toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          catName.includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'words') return b.wordCount - a.wordCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, showArchived, selectedCategoryId, searchQuery, categoryMap, sortBy]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {showArchived ? 'Archived Notes' : 'My Notes'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} displayed · Click any note to edit or reassign category
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              showArchived
                ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{showArchived ? 'Viewing Archived' : 'Archived'}</span>
          </button>

          <select
            aria-label="Sort notes"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updated' | 'title' | 'words')}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="updated">Sort: Recently Updated</option>
            <option value="title">Sort: Title (A–Z)</option>
            <option value="words">Sort: Word Count</option>
          </select>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setViewMode('list')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Segmented Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedCategoryId === 'all'
              ? 'bg-slate-900 text-white dark:bg-blue-600'
              : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategoryId === cat.id
                ? 'bg-slate-900 text-white dark:bg-blue-600'
                : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: cat.accentColor }}
            />
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Loading / Empty / Populated States */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {searchQuery.trim()
              ? 'No notes match your search'
              : showArchived
                ? 'No archived notes'
                : 'No notes in this category yet'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {searchQuery.trim()
              ? 'Try clearing your search filter or switching categories.'
              : 'Create a new note and organize it right into your cloud workspace.'}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={onOpenCreateNote}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Note</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => {
            const isConfirming = confirmDeleteId === note.id;
            return (
              <article
                key={note.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenEditNote(note)}
                      className="min-w-0 text-left"
                    >
                      <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                        {note.title}
                      </h3>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePin(note)}
                      aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
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
                    <p className="line-clamp-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {note.content || 'Empty note — click to add content.'}
                    </p>
                  </button>
                </div>

                <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      aria-label={`Category for ${note.title}`}
                      value={note.categoryId}
                      onChange={(e) => onQuickCategoryChange(note.id, e.target.value)}
                      className="h-7 max-w-[140px] rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {note.wordCount}w · {formatRelativeTime(note.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenEditNote(note)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit Note</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleArchive(note)}
                        aria-label={note.isArchived ? 'Restore from archive' : 'Archive note'}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              void onDeleteNote(note.id);
                            }}
                            className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(note.id)}
                          aria-label={`Delete ${note.title}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Words</th>
                <th className="px-4 py-3 text-right">Sync</th>
                <th className="px-4 py-3 text-right">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredNotes.map((note) => (
                <tr
                  key={note.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenEditNote(note)}
                      className="flex items-center gap-2 text-left font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />}
                      <span className="truncate max-w-[280px]">{note.title}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      aria-label={`Category for ${note.title}`}
                      value={note.categoryId}
                      onChange={(e) => onQuickCategoryChange(note.id, e.target.value)}
                      className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">
                    {note.wordCount}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">
                    v{note.syncVersion}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                    {formatRelativeTime(note.updatedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditNote(note)}
                        aria-label={`Edit ${note.title}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label={`Delete ${note.title}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
