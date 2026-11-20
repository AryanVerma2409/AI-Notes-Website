import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { AuthPage } from './components/AuthPage';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { DashboardHome } from './components/DashboardHome';
import { MyNotesView } from './components/MyNotesView';
import { NoteEditorModal } from './components/NoteEditorModal';
import { QuickLauncherModal } from './components/QuickLauncherModal';
import { Sidebar } from './components/Sidebar';
import { api, setStoredToken } from './lib/api';
import { supabase } from './supabaseClient';
import type { AuthResponse, CategoryItem, NoteItem, UserProfile } from './types';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const [activeView, setActiveView] = useState<'home' | 'notes'>('home');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal Overlay States
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [quickLauncherMode, setQuickLauncherMode] = useState<'home' | 'notes' | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Apply light/dark theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (user?.themePreference === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [user?.themePreference]);

  const loadWorkspaceData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [catRes, noteRes] = await Promise.all([api.getCategories(), api.getNotes()]);
      setCategories(catRes.categories);
      setNotes(noteRes.notes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load workspace.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;

    const verifySupabaseSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session) {
          setStoredToken(null);
          setUser(null);
          if (
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/signup'
          ) {
            window.history.replaceState(null, '', '/login');
          }
          return;
        }

        const sbEmail = session.user?.email;
        if (!sbEmail) {
          setStoredToken(null);
          setUser(null);
          if (
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/signup'
          ) {
            window.history.replaceState(null, '', '/login');
          }
          return;
        }

        const metaName =
          (typeof session.user?.user_metadata?.full_name === 'string' &&
            session.user.user_metadata.full_name) ||
          (typeof session.user?.user_metadata?.display_name === 'string' &&
            session.user.user_metadata.display_name) ||
          (typeof session.user?.user_metadata?.name === 'string' &&
            session.user.user_metadata.name) ||
          undefined;

        const syncRes = await api.syncSupabaseSession({
          email: sbEmail,
          name: metaName,
          mode: 'login',
        });
        if (!active) return;

        setStoredToken(syncRes.token);
        setUser(syncRes.user);
        if (
          window.location.pathname === '/login' ||
          window.location.pathname === '/signup'
        ) {
          window.history.replaceState(null, '', '/');
        }
        await loadWorkspaceData();
      } catch {
        if (!active) return;
        setStoredToken(null);
        setUser(null);
        if (
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/signup'
        ) {
          window.history.replaceState(null, '', '/login');
        }
      } finally {
        if (active) setIsCheckingAuth(false);
      }
    };

    void verifySupabaseSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) {
        setStoredToken(null);
        setUser(null);
        setNotes([]);
        setCategories([]);
        if (
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/signup'
        ) {
          window.history.replaceState(null, '', '/login');
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadWorkspaceData]);

  // Global keyboard shortcut Cmd/Ctrl + K for Quick Launcher Modal
  useEffect(() => {
    if (!user) return;
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickLauncherMode((prev) => (prev ? null : activeView));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [user, activeView]);

  const handleAuthenticated = async (auth: AuthResponse) => {
    setStoredToken(auth.token);
    setUser(auth.user);
    await loadWorkspaceData();
  };

  const handleLogout = async () => {
    try {
      await Promise.allSettled([api.logout(), supabase.auth.signOut()]);
    } catch {
      // Clear local state regardless
    }
    setStoredToken(null);
    setUser(null);
    setNotes([]);
    setCategories([]);
    setSettingsModalOpen(false);
    document.documentElement.classList.remove('dark');
    window.history.replaceState(null, '', '/login');
  };

  const handleOpenCreateNote = () => {
    setEditingNote(null);
    setNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: NoteItem) => {
    setEditingNote(note);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (payload: {
    id?: string;
    title: string;
    content: string;
    categoryId: string;
    isPinned: boolean;
    isArchived?: boolean;
  }) => {
    if (payload.id) {
      const res = await api.updateNote(payload.id, {
        title: payload.title,
        content: payload.content,
        categoryId: payload.categoryId,
        isPinned: payload.isPinned,
        isArchived: payload.isArchived,
      });
      setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
      if (user?.autoSync) {
        setUser((prev) => (prev ? { ...prev, lastSyncedAt: res.note.syncedAt } : prev));
      }
      showToast('Note updated and synced to cloud.');
    } else {
      const res = await api.createNote({
        title: payload.title,
        content: payload.content,
        categoryId: payload.categoryId,
        isPinned: payload.isPinned,
      });
      setNotes((prev) => [res.note, ...prev]);
      if (user?.autoSync) {
        setUser((prev) => (prev ? { ...prev, lastSyncedAt: res.note.syncedAt } : prev));
      }
      showToast('Note created and saved to cloud.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await api.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    showToast('Note deleted.');
  };

  const handleQuickCategoryChange = async (noteId: string, categoryId: string) => {
    try {
      const res = await api.updateNote(noteId, { categoryId });
      setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
      showToast('Note category updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update category.', 'error');
    }
  };

  const handleTogglePin = async (note: NoteItem) => {
    try {
      const res = await api.updateNote(note.id, { isPinned: !note.isPinned });
      setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update pin state.', 'error');
    }
  };

  const handleToggleArchive = async (note: NoteItem) => {
    try {
      const res = await api.updateNote(note.id, { isArchived: !note.isArchived });
      setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
      showToast(res.note.isArchived ? 'Note archived.' : 'Note restored from archive.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update archive state.', 'error');
    }
  };

  const handleCreateCategory = async (name: string, accentColor?: string) => {
    const res = await api.createCategory({ name, accentColor });
    setCategories((prev) => [...prev, res.category]);
    showToast(`Category "${res.category.name}" created.`);
    return res.category;
  };

  const handleDeleteCategory = async (id: string) => {
    const res = await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.categoryId === id ? { ...n, categoryId: res.fallbackCategoryId } : n)),
    );
    if (selectedCategoryId === id) {
      setSelectedCategoryId('all');
    }
    showToast('Category removed; notes reassigned to General.');
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncCloud();
      setUser((prev) => (prev ? { ...prev, lastSyncedAt: res.summary.syncedAt } : prev));
      showToast(`Synced ${res.summary.noteCount} notes to ${res.summary.provider}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cloud sync failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const estimatedBytes = useMemo(() => {
    return new Blob([JSON.stringify({ notes, categories })]).size;
  }, [notes, categories]);

  const activeCategoryName = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return categories.find((c) => c.id === selectedCategoryId)?.name || null;
  }, [selectedCategoryId, categories]);

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Connecting to AI Notes workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        initialMode={window.location.pathname === '/signup' ? 'signup' : 'login'}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        user={user}
        activeView={activeView}
        selectedCategoryId={selectedCategoryId}
        categories={categories}
        notes={notes}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectHome={() => setActiveView('home')}
        onSelectMyNotes={(categoryId = 'all') => {
          setSelectedCategoryId(categoryId);
          setActiveView('notes');
        }}
        onOpenCreateNote={handleOpenCreateNote}
        onOpenAccountSettings={() => setSettingsModalOpen(true)}
        onOpenCategoryManager={() => setCategoryModalOpen(true)}
        onOpenQuickLauncher={(mode) => setQuickLauncherMode(mode)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-4 w-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap"
              >
                AI Notes
              </button>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {activeView === 'home' ? 'Home' : 'My Notes'}
              </span>
              {activeView === 'notes' && activeCategoryName && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {activeCategoryName}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim() && activeView !== 'notes') {
                    setActiveView('notes');
                  }
                }}
                placeholder="Search notes..."
                className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none md:w-64 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenCreateNote}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Note</span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          {activeView === 'home' ? (
            <DashboardHome
              user={user}
              notes={notes}
              categories={categories}
              estimatedBytes={estimatedBytes}
              isSyncing={isSyncing}
              onOpenCreateNote={handleOpenCreateNote}
              onOpenEditNote={handleOpenEditNote}
              onTogglePin={handleTogglePin}
              onOpenMyNotes={(catId = 'all') => {
                setSelectedCategoryId(catId);
                setActiveView('notes');
              }}
              onOpenCategoryManager={() => setCategoryModalOpen(true)}
              onOpenAccountSettings={() => setSettingsModalOpen(true)}
              onSyncNow={handleSyncNow}
            />
          ) : (
            <MyNotesView
              notes={notes}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              searchQuery={searchQuery}
              isLoading={isLoadingData}
              onSelectCategory={setSelectedCategoryId}
              onOpenCreateNote={handleOpenCreateNote}
              onOpenEditNote={handleOpenEditNote}
              onQuickCategoryChange={handleQuickCategoryChange}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
              onDeleteNote={handleDeleteNote}
            />
          )}
        </main>
      </div>

      {/* Modal Overlays */}
      <NoteEditorModal
        isOpen={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        note={editingNote}
        categories={categories}
        cloudProvider={user.cloudProvider}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        onCreateCategory={(name) => handleCreateCategory(name)}
      />

      <AccountSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        user={user}
        noteCount={notes.length}
        categoryCount={categories.length}
        estimatedBytes={estimatedBytes}
        onUserUpdated={setUser}
        onLogout={handleLogout}
      />

      <CategoryManagerModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        notes={notes}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSelectCategory={(catId) => {
          setSelectedCategoryId(catId);
          setActiveView('notes');
        }}
      />

      <QuickLauncherModal
        isOpen={quickLauncherMode !== null}
        onClose={() => setQuickLauncherMode(null)}
        mode={quickLauncherMode || 'home'}
        notes={notes}
        categories={categories}
        onNavigateHome={() => setActiveView('home')}
        onNavigateMyNotes={(catId = 'all') => {
          setSelectedCategoryId(catId);
          setActiveView('notes');
        }}
        onOpenCreateNote={handleOpenCreateNote}
        onOpenEditNote={handleOpenEditNote}
        onOpenAccountSettings={() => setSettingsModalOpen(true)}
        onOpenCategories={() => setCategoryModalOpen(true)}
      />

      {/* Feedback Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed right-5 bottom-5 z-50 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg transition-all ${
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
              : 'border-slate-200 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
