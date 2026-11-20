import type {
  AuthResponse,
  CategoryItem,
  CloudProvider,
  CloudSyncSummary,
  NoteItem,
  ThemePreference,
  UserProfile,
} from '../types';

const TOKEN_STORAGE_KEY = 'ai_notes_token';
const LOCAL_WORKSPACE_KEY = 'ai_notes_static_workspace_v1';
const DEFAULT_AVATAR = '/src/assets/images/user_avatar_portrait_1795152808598.jpg';

const CATEGORY_COLORS = ['#64748B', '#2563EB', '#0D9488', '#4F46E5', '#D97706', '#0284C7'];

interface StaticWorkspaceState {
  users: UserProfile[];
  categories: CategoryItem[];
  notes: NoteItem[];
  activeEmail: string | null;
}

class BackendUnavailableError extends Error {
  constructor() {
    super('Backend API unavailable');
    this.name = 'BackendUnavailableError';
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function loadStaticWorkspace(): StaticWorkspaceState {
  try {
    const raw = localStorage.getItem(LOCAL_WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticWorkspaceState>;
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        activeEmail: typeof parsed.activeEmail === 'string' ? parsed.activeEmail : null,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { users: [], categories: [], notes: [], activeEmail: null };
}

function saveStaticWorkspace(state: StaticWorkspaceState): void {
  try {
    localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function countMetrics(content: string): { wordCount: number; charCount: number } {
  const trimmed = content.trim();
  return {
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    charCount: content.length,
  };
}

function seedStarterForUser(userId: string, now: string): {
  categories: CategoryItem[];
  notes: NoteItem[];
} {
  const catGeneral: CategoryItem = {
    id: makeId('cat'),
    userId,
    name: 'General',
    accentColor: '#64748B',
    createdAt: now,
  };
  const catWork: CategoryItem = {
    id: makeId('cat'),
    userId,
    name: 'Work',
    accentColor: '#2563EB',
    createdAt: now,
  };
  const catIdeas: CategoryItem = {
    id: makeId('cat'),
    userId,
    name: 'Ideas',
    accentColor: '#0D9488',
    createdAt: now,
  };
  const catResearch: CategoryItem = {
    id: makeId('cat'),
    userId,
    name: 'Research',
    accentColor: '#4F46E5',
    createdAt: now,
  };
  const catPersonal: CategoryItem = {
    id: makeId('cat'),
    userId,
    name: 'Personal',
    accentColor: '#D97706',
    createdAt: now,
  };

  const welcomeContent =
    'Your notes are organized and persisted in your AI Notes workspace.\n\nQuick tips:\n- Click Create Notes in the sidebar to open the quick composer modal.\n- Assign notes to Work, Ideas, Research, Personal, or create your own categories.\n- Open Account Settings to manage your display name, theme, and cloud archive exports.';
  const metrics = countMetrics(welcomeContent);

  const welcomeNote: NoteItem = {
    id: makeId('note'),
    userId,
    title: 'Welcome to AI Notes Cloud Workspace',
    content: welcomeContent,
    categoryId: catGeneral.id,
    isPinned: true,
    isArchived: false,
    wordCount: metrics.wordCount,
    charCount: metrics.charCount,
    syncVersion: 1,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return {
    categories: [catGeneral, catWork, catIdeas, catResearch, catPersonal],
    notes: [welcomeNote],
  };
}

function getActiveStaticUser(state: StaticWorkspaceState): UserProfile {
  const user =
    state.users.find((u) => u.email === state.activeEmail) || state.users[0];
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }
  return user;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new BackendUnavailableError();
  }

  const contentType = res.headers.get('content-type') || '';
  if (res.status === 404 || (!contentType.includes('application/json') && res.ok)) {
    throw new BackendUnavailableError();
  }

  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function withFallback<T>(
  remoteCall: () => Promise<T>,
  fallbackCall: () => T | Promise<T>,
): Promise<T> {
  try {
    return await remoteCall();
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return fallbackCall();
    }
    throw err;
  }
}

export const api = {
  signup(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
    return withFallback(
      () =>
        request<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => api.syncSupabaseSession({ email: payload.email, name: payload.name, mode: 'signup' }),
    );
  },

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return withFallback(
      () =>
        request<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => api.syncSupabaseSession({ email: payload.email, mode: 'login' }),
    );
  },

  loginDemo(): Promise<AuthResponse> {
    return withFallback(
      () =>
        request<AuthResponse>('/api/auth/demo', {
          method: 'POST',
        }),
      () => {
        const state = loadStaticWorkspace();
        const email = 'demo@ainotes.cloud';
        let user = state.users.find((u) => u.email === email);
        if (!user) {
          const now = new Date().toISOString();
          const userId = makeId('user');
          user = {
            id: userId,
            name: 'Elena Vance',
            email,
            avatarUrl: DEFAULT_AVATAR,
            themePreference: 'light',
            cloudProvider: 'AI Notes Cloud',
            cloudBucketName: 'ainotes-demo-vault',
            autoSync: true,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          };
          const starter = seedStarterForUser(userId, now);
          state.users.push(user);
          state.categories.push(...starter.categories);
          state.notes.push(...starter.notes);
        }
        state.activeEmail = user.email;
        saveStaticWorkspace(state);
        return { user, token: `static_${user.id}` };
      },
    );
  },

  syncSupabaseSession(payload: {
    email: string;
    name?: string;
    mode?: 'signup' | 'login';
  }): Promise<AuthResponse> {
    return withFallback(
      () =>
        request<AuthResponse>('/api/auth/supabase', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => {
        const state = loadStaticWorkspace();
        const cleanEmail = payload.email.trim().toLowerCase();
        const cleanName =
          typeof payload.name === 'string' && payload.name.trim().length >= 2
            ? payload.name.trim()
            : cleanEmail.split('@')[0] || 'AI Notes User';

        let user = state.users.find((u) => u.email === cleanEmail);
        if (user && payload.mode === 'signup') {
          throw new Error(
            'An account with this email already exists. Please sign in instead or use a different email.',
          );
        }

        if (!user) {
          const now = new Date().toISOString();
          const userId = makeId('user');
          const slug =
            cleanName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') || 'workspace';
          user = {
            id: userId,
            name: cleanName,
            email: cleanEmail,
            avatarUrl: DEFAULT_AVATAR,
            themePreference: 'light',
            cloudProvider: 'AI Notes Cloud',
            cloudBucketName: `ainotes-${slug}-vault`,
            autoSync: true,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          };
          const starter = seedStarterForUser(userId, now);
          state.users.push(user);
          state.categories.push(...starter.categories);
          state.notes.push(...starter.notes);
        } else if (payload.name && payload.name.trim().length >= 2 && user.name !== cleanName) {
          user.name = cleanName;
          user.updatedAt = new Date().toISOString();
        }

        state.activeEmail = user.email;
        saveStaticWorkspace(state);
        return { user, token: `static_${user.id}` };
      },
    );
  },

  logout(): Promise<{ ok: boolean }> {
    return withFallback(
      () =>
        request<{ ok: boolean }>('/api/auth/logout', {
          method: 'POST',
        }),
      () => {
        const state = loadStaticWorkspace();
        state.activeEmail = null;
        saveStaticWorkspace(state);
        return { ok: true };
      },
    );
  },

  me(): Promise<{ user: UserProfile }> {
    return withFallback(
      () => request<{ user: UserProfile }>('/api/auth/me'),
      () => {
        const state = loadStaticWorkspace();
        return { user: getActiveStaticUser(state) };
      },
    );
  },

  updateAccount(payload: {
    name?: string;
    themePreference?: ThemePreference;
    cloudProvider?: CloudProvider;
    cloudBucketName?: string;
    autoSync?: boolean;
  }): Promise<{ user: UserProfile }> {
    return withFallback(
      () =>
        request<{ user: UserProfile }>('/api/account', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        if (typeof payload.name === 'string' && payload.name.trim().length >= 2) {
          user.name = payload.name.trim();
        }
        if (payload.themePreference === 'light' || payload.themePreference === 'dark') {
          user.themePreference = payload.themePreference;
        }
        if (payload.cloudProvider) {
          user.cloudProvider = payload.cloudProvider;
        }
        if (typeof payload.cloudBucketName === 'string' && payload.cloudBucketName.trim().length >= 3) {
          user.cloudBucketName = payload.cloudBucketName.trim();
        }
        if (typeof payload.autoSync === 'boolean') {
          user.autoSync = payload.autoSync;
        }
        user.updatedAt = new Date().toISOString();
        saveStaticWorkspace(state);
        return { user };
      },
    );
  },

  getCategories(): Promise<{ categories: CategoryItem[] }> {
    return withFallback(
      () => request<{ categories: CategoryItem[] }>('/api/categories'),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        return {
          categories: state.categories.filter((c) => c.userId === user.id),
        };
      },
    );
  },

  createCategory(payload: { name: string; accentColor?: string }): Promise<{ category: CategoryItem }> {
    return withFallback(
      () =>
        request<{ category: CategoryItem }>('/api/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const cleanName = payload.name.trim();
        const duplicate = state.categories.find(
          (c) => c.userId === user.id && c.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (duplicate) {
          throw new Error('A category with this name already exists.');
        }
        const count = state.categories.filter((c) => c.userId === user.id).length;
        const category: CategoryItem = {
          id: makeId('cat'),
          userId: user.id,
          name: cleanName,
          accentColor: payload.accentColor || CATEGORY_COLORS[count % CATEGORY_COLORS.length],
          createdAt: new Date().toISOString(),
        };
        state.categories.push(category);
        saveStaticWorkspace(state);
        return { category };
      },
    );
  },

  deleteCategory(id: string): Promise<{ ok: boolean; fallbackCategoryId: string }> {
    return withFallback(
      () =>
        request<{ ok: boolean; fallbackCategoryId: string }>(
          `/api/categories/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const idx = state.categories.findIndex((c) => c.id === id && c.userId === user.id);
        if (idx === -1) throw new Error('Category not found.');
        const target = state.categories[idx];
        if (target.name.toLowerCase() === 'general') {
          throw new Error('The default General category cannot be deleted.');
        }
        const fallback =
          state.categories.find(
            (c) => c.userId === user.id && c.id !== id && c.name.toLowerCase() === 'general',
          ) || state.categories.find((c) => c.userId === user.id && c.id !== id);
        if (!fallback) throw new Error('At least one category must remain.');

        const now = new Date().toISOString();
        for (const note of state.notes) {
          if (note.userId === user.id && note.categoryId === id) {
            note.categoryId = fallback.id;
            note.updatedAt = now;
          }
        }
        state.categories.splice(idx, 1);
        saveStaticWorkspace(state);
        return { ok: true, fallbackCategoryId: fallback.id };
      },
    );
  },

  getNotes(): Promise<{ notes: NoteItem[] }> {
    return withFallback(
      () => request<{ notes: NoteItem[] }>('/api/notes'),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const notes = state.notes
          .filter((n) => n.userId === user.id)
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        return { notes };
      },
    );
  },

  createNote(payload: {
    title: string;
    content: string;
    categoryId: string;
    isPinned?: boolean;
  }): Promise<{ note: NoteItem }> {
    return withFallback(
      () =>
        request<{ note: NoteItem }>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const now = new Date().toISOString();
        const metrics = countMetrics(payload.content);
        const note: NoteItem = {
          id: makeId('note'),
          userId: user.id,
          title: payload.title.trim(),
          content: payload.content,
          categoryId: payload.categoryId,
          isPinned: Boolean(payload.isPinned),
          isArchived: false,
          wordCount: metrics.wordCount,
          charCount: metrics.charCount,
          syncVersion: 1,
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        state.notes.push(note);
        if (user.autoSync) user.lastSyncedAt = now;
        saveStaticWorkspace(state);
        return { note };
      },
    );
  },

  updateNote(
    id: string,
    payload: {
      title?: string;
      content?: string;
      categoryId?: string;
      isPinned?: boolean;
      isArchived?: boolean;
    },
  ): Promise<{ note: NoteItem }> {
    return withFallback(
      () =>
        request<{ note: NoteItem }>(`/api/notes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const note = state.notes.find((n) => n.id === id && n.userId === user.id);
        if (!note) throw new Error('Note not found.');
        if (typeof payload.title === 'string') note.title = payload.title.trim();
        if (typeof payload.content === 'string') {
          note.content = payload.content;
          const metrics = countMetrics(payload.content);
          note.wordCount = metrics.wordCount;
          note.charCount = metrics.charCount;
        }
        if (typeof payload.categoryId === 'string') note.categoryId = payload.categoryId;
        if (typeof payload.isPinned === 'boolean') note.isPinned = payload.isPinned;
        if (typeof payload.isArchived === 'boolean') note.isArchived = payload.isArchived;

        const now = new Date().toISOString();
        note.syncVersion += 1;
        note.syncedAt = now;
        note.updatedAt = now;
        if (user.autoSync) user.lastSyncedAt = now;
        saveStaticWorkspace(state);
        return { note };
      },
    );
  },

  deleteNote(id: string): Promise<{ ok: boolean }> {
    return withFallback(
      () =>
        request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const idx = state.notes.findIndex((n) => n.id === id && n.userId === user.id);
        if (idx === -1) throw new Error('Note not found.');
        state.notes.splice(idx, 1);
        saveStaticWorkspace(state);
        return { ok: true };
      },
    );
  },

  syncCloud(): Promise<{ summary: CloudSyncSummary }> {
    return withFallback(
      () =>
        request<{ summary: CloudSyncSummary }>('/api/cloud/sync', {
          method: 'POST',
        }),
      () => {
        const state = loadStaticWorkspace();
        const user = getActiveStaticUser(state);
        const now = new Date().toISOString();
        const userNotes = state.notes.filter((n) => n.userId === user.id);
        const userCategories = state.categories.filter((c) => c.userId === user.id);
        for (const note of userNotes) {
          note.syncedAt = now;
        }
        user.lastSyncedAt = now;
        user.updatedAt = now;
        saveStaticWorkspace(state);
        const storageBytes = new Blob([
          JSON.stringify({ notes: userNotes, categories: userCategories }),
        ]).size;
        return {
          summary: {
            syncedAt: now,
            noteCount: userNotes.length,
            categoryCount: userCategories.length,
            storageBytes,
            provider: user.cloudProvider,
            bucketName: user.cloudBucketName,
          },
        };
      },
    );
  },

  async exportCloudBackup(): Promise<Blob> {
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch('/api/cloud/export', {
        headers,
        credentials: 'include',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 || !contentType.includes('application/json')) {
        throw new BackendUnavailableError();
      }
      if (!res.ok) {
        throw new Error('Failed to export cloud archive.');
      }
      return res.blob();
    } catch (err) {
      if (!(err instanceof BackendUnavailableError)) {
        throw err;
      }
      const state = loadStaticWorkspace();
      const user = getActiveStaticUser(state);
      const userNotes = state.notes.filter((n) => n.userId === user.id);
      const userCategories = state.categories.filter((c) => c.userId === user.id);
      return new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              workspace: {
                owner: user.name,
                email: user.email,
                cloudProvider: user.cloudProvider,
                cloudBucketName: user.cloudBucketName,
              },
              categories: userCategories,
              notes: userNotes,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
    }
  },
};
