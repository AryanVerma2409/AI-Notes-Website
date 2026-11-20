import React, { useState } from 'react';
import { FolderPlus, Trash2 } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import type { CategoryItem, NoteItem } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  notes: NoteItem[];
  onCreateCategory: (name: string, accentColor?: string) => Promise<CategoryItem>;
  onDeleteCategory: (id: string) => Promise<void>;
  onSelectCategory: (categoryId: string) => void;
}

const SWATCH_COLORS = ['#2563EB', '#0D9488', '#D97706', '#4F46E5', '#64748B', '#0284C7'];

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  notes,
  onCreateCategory,
  onDeleteCategory,
  onSelectCategory,
}: CategoryManagerModalProps) {
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState(SWATCH_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateCategory(clean, accentColor);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await onDeleteCategory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete category.');
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      title="Organize Categories"
      subtitle="Create custom folders to group your notes across cloud storage"
      size="md"
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 space-y-3 border-b border-slate-200 pb-5 dark:border-slate-800">
        <label
          htmlFor="new-cat-input"
          className="block text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Add New Category
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="new-cat-input"
            type="text"
            maxLength={36}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Client Projects"
            className="h-10 min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Adding...' : 'Add Category'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Color marker:</span>
          {SWATCH_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccentColor(color)}
              aria-label={`Select color ${color}`}
              className={`h-5 w-5 rounded-md transition-transform ${
                accentColor === color ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </form>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {categories.map((cat) => {
          const count = notes.filter((n) => n.categoryId === cat.id && !n.isArchived).length;
          const isDefault = cat.name.toLowerCase() === 'general';
          return (
            <div key={cat.id} className="flex items-center justify-between gap-3 py-3">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(cat.id);
                  onClose();
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-blue-600 dark:hover:text-blue-400"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: cat.accentColor }}
                />
                <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {cat.name}
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {count} {count === 1 ? 'note' : 'notes'}
                </span>
              </button>
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id)}
                  aria-label={`Delete category ${cat.name}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ModalOverlay>
  );
}
