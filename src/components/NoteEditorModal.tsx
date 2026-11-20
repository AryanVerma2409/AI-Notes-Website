import React, { useEffect, useState } from 'react';
import { Archive, CloudCheck, Pin, Plus, Trash2 } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { formatRelativeTime } from '../lib/format';
import type { CategoryItem, CloudProvider, NoteItem } from '../types';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: NoteItem | null;
  categories: CategoryItem[];
  cloudProvider: CloudProvider;
  onSave: (payload: {
    id?: string;
    title: string;
    content: string;
    categoryId: string;
    isPinned: boolean;
    isArchived?: boolean;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateCategory: (name: string) => Promise<CategoryItem>;
}

export function NoteEditorModal({
  isOpen,
  onClose,
  note,
  categories,
  cloudProvider,
  onSave,
  onDelete,
  onCreateCategory,
}: NoteEditorModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setCategoryId(note.categoryId);
      setIsPinned(note.isPinned);
      setIsArchived(note.isArchived);
    } else {
      setTitle('');
      setContent('');
      setCategoryId(categories[0]?.id || '');
      setIsPinned(false);
      setIsArchived(false);
    }
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setConfirmDelete(false);
    setError(null);
  }, [isOpen, note, categories]);

  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = content.length;

  const handleAddCategory = async () => {
    const clean = newCategoryName.trim();
    if (!clean) return;
    setCreatingCategory(true);
    setError(null);
    try {
      const created = await onCreateCategory(clean);
      setCategoryId(created.id);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Please enter a title for your note.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        id: note?.id,
        title: title.trim(),
        content,
        categoryId: categoryId || categories[0]?.id || '',
        isPinned,
        isArchived: note ? isArchived : false,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note || !onDelete) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(note.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note.');
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      title={note ? 'Edit Note' : 'Create Note'}
      subtitle={
        note
          ? `Sync v${note.syncVersion} · Last saved to ${cloudProvider} ${formatRelativeTime(note.syncedAt)}`
          : `New note will be synchronized automatically to ${cloudProvider}`
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="note-title"
            className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Note Title
          </label>
          <input
            id="note-title"
            type="text"
            autoFocus
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Sprint Planning Summary"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="note-category"
                className="text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Category
              </label>
              <button
                type="button"
                onClick={() => setShowNewCategoryInput((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="h-3 w-3" />
                <span>{showNewCategoryInput ? 'Cancel' : 'New Category'}</span>
              </button>
            </div>

            {showNewCategoryInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={36}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="h-10 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  {creatingCategory ? 'Adding...' : 'Add'}
                </button>
              </div>
            ) : (
              <select
                id="note-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setIsPinned((prev) => !prev)}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                isPinned
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              <span>{isPinned ? 'Pinned' : 'Pin Note'}</span>
            </button>

            {note && (
              <button
                type="button"
                onClick={() => setIsArchived((prev) => !prev)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  isArchived
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                <span>{isArchived ? 'Archived' : 'Archive'}</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="note-content"
            className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Content
          </label>
          <textarea
            id="note-content"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note, action items, or research findings..."
            className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            <CloudCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{wordCount} words</span>
            <span aria-hidden="true">·</span>
            <span>{charCount} chars</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {note && onDelete && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isSaving}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      Keep Note
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="h-9 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      Confirm Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isSaving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-red-600 hover:border-red-200 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? 'Syncing...' : note ? 'Save Changes' : 'Save Note'}
            </button>
          </div>
        </div>
      </form>
    </ModalOverlay>
  );
}
