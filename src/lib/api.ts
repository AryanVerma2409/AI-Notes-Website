import { supabase } from '../supabaseClient';
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

export type StorageBackendMode = 'express' | 'supabase-db' | 'local-browser';

let detectedBackendMode: StorageBackendMode = 'express';

export function getStorageBackendMode(): StorageBackendMode {
  return detectedBackendMode;
}

export const SUPABASE_SCHEMA_SQL = `create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_url text not null default '/src/assets/images/user_avatar_portrait_1795152808598.jpg',
  theme_preference text not null default 'light',
  cloud_provider text not null default 'AI Notes Cloud',
  cloud_bucket_name text not null default 'ainotes-cloud-vault',
  auto_sync boolean not null default true,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  accent_color text not null default '#2563EB',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  word_count integer not null default 0,
  char_count integer not null default 0,
  sync_version integer not null default 1,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage own categories" on public.categories;
create policy "Users can manage own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own notes" on public.notes;
create policy "Users can manage own notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

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

class SupabaseTableMissingError extends Error {
  constructor() {
    super('Supabase tables not initialized');
    this.name = 'SupabaseTableMissingError';
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

// --- Supabase Cloud Database Helpers ---
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

interface SbProfileRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  theme_preference: string;
  cloud_provider: string;
  cloud_bucket_name: string;
  auto_sync: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

interface SbCategoryRow {
  id: string;
  user_id: string;
  name: string;
  accent_color: string;
  created_at: string;
}

interface SbNoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  word_count: number;
  char_count: number;
  sync_version: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

function mapSbProfile(row: SbProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url || DEFAULT_AVATAR,
    themePreference: row.theme_preference === 'dark' ? 'dark' : 'light',
    cloudProvider: (row.cloud_provider as CloudProvider) || 'AI Notes Cloud',
    cloudBucketName: row.cloud_bucket_name || 'ainotes-cloud-vault',
    autoSync: Boolean(row.auto_sync),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSbCategory(row: SbCategoryRow): CategoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    accentColor: row.accent_color || '#2563EB',
    createdAt: row.created_at,
  };
}

function mapSbNote(row: SbNoteRow, fallbackCategoryId: string): NoteItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content || '',
    categoryId: row.category_id || fallbackCategoryId,
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    wordCount: row.word_count || 0,
    charCount: row.char_count || 0,
    syncVersion: row.sync_version || 1,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSupabaseAuthUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user || null;
}

async function ensureSupabaseStarterData(userId: string): Promise<CategoryItem[]> {
  const { data: existingCats, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (catErr) {
    if (isMissingTableError(catErr)) throw new SupabaseTableMissingError();
    throw new Error(catErr.message);
  }

  if (existingCats && existingCats.length > 0) {
    return (existingCats as SbCategoryRow[]).map(mapSbCategory);
  }

  const starterRows = [
    { user_id: userId, name: 'General', accent_color: '#64748B' },
    { user_id: userId, name: 'Work', accent_color: '#2563EB' },
    { user_id: userId, name: 'Ideas', accent_color: '#0D9488' },
    { user_id: userId, name: 'Research', accent_color: '#4F46E5' },
    { user_id: userId, name: 'Personal', accent_color: '#D97706' },
  ];

  const { data: insertedCats, error: insertCatErr } = await supabase
    .from('categories')
    .insert(starterRows)
    .select('*');

  if (insertCatErr) {
    if (isMissingTableError(insertCatErr)) throw new SupabaseTableMissingError();
    throw new Error(insertCatErr.message);
  }

  const cats = ((insertedCats || []) as SbCategoryRow[]).map(mapSbCategory);
  const generalCat = cats.find((c) => c.name === 'General') || cats[0];

  if (generalCat) {
    const welcomeContent =
      'Your notes are synchronized with Supabase Cloud Database and available across every computer and browser.\n\nQuick tips:\n- Click Create Notes in the sidebar to open the quick composer modal.\n- Assign notes to Work, Ideas, Research, Personal, or create your own categories.\n- Open Account Settings to customize your theme or export a JSON archive.';
    const metrics = countMetrics(welcomeContent);
    await supabase.from('notes').insert({
      user_id: userId,
      title: 'Welcome to AI Notes Cloud Workspace',
      content: welcomeContent,
      category_id: generalCat.id,
      is_pinned: true,
      is_archived: false,
      word_count: metrics.wordCount,
      char_count: metrics.charCount,
      sync_version: 1,
    });
  }

  return cats;
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

  detectedBackendMode = 'express';
  return data as T;
}

async function withCloudRouting<T>(
  remoteCall: () => Promise<T>,
  supabaseDbCall: ((sbUserId: string, sbEmail: string, sbMetaName?: string) => Promise<T>) | null,
  localFallbackCall: () => T,
): Promise<T> {
  if (supabaseDbCall) {
    try {
      const sbUser = await getSupabaseAuthUser();
      if (sbUser && sbUser.email) {
        const metaName =
          (typeof sbUser.user_metadata?.full_name === 'string' && sbUser.user_metadata.full_name) ||
          (typeof sbUser.user_metadata?.display_name === 'string' &&
            sbUser.user_metadata.display_name) ||
          (typeof sbUser.user_metadata?.name === 'string' && sbUser.user_metadata.name) ||
          undefined;
        const result = await supabaseDbCall(sbUser.id, sbUser.email, metaName);
        detectedBackendMode = 'supabase-db';
        return result;
      }
    } catch (sbErr) {
      if (!(sbErr instanceof SupabaseTableMissingError)) {
        throw sbErr;
      }
    }
  }

  try {
    return await remoteCall();
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) {
      throw err;
    }
    detectedBackendMode = 'local-browser';
    return localFallbackCall();
  }
}

export const api = {
  signup(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
    return withCloudRouting(
      () =>
        request<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      null,
      () => {
        throw new Error('Use Supabase Sign Up form.');
      },
    );
  },

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return withCloudRouting(
      () =>
        request<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      null,
      () => {
        throw new Error('Use Supabase Sign In form.');
      },
    );
  },

  loginDemo(): Promise<AuthResponse> {
    return withCloudRouting(
      () =>
        request<AuthResponse>('/api/auth/demo', {
          method: 'POST',
        }),
      null,
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
    return withCloudRouting(
      () =>
        request<AuthResponse>('/api/auth/supabase', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      async (sbUserId, sbEmail, sbMetaName) => {
        const { data: existing, error: fetchErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUserId)
          .maybeSingle();

        if (fetchErr) {
          if (isMissingTableError(fetchErr)) throw new SupabaseTableMissingError();
          throw new Error(fetchErr.message);
        }

        if (existing) {
          await ensureSupabaseStarterData(sbUserId);
          return {
            user: mapSbProfile(existing as SbProfileRow),
            token: `supabase_${sbUserId}`,
          };
        }

        const displayName =
          (payload.name && payload.name.trim()) ||
          sbMetaName ||
          sbEmail.split('@')[0] ||
          'AI Notes User';
        const slug =
          displayName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'workspace';

        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert({
            id: sbUserId,
            name: displayName,
            email: sbEmail,
            avatar_url: DEFAULT_AVATAR,
            theme_preference: 'light',
            cloud_provider: 'AI Notes Cloud',
            cloud_bucket_name: `ainotes-${slug}-vault`,
            auto_sync: true,
          })
          .select('*')
          .single();

        if (insertErr) {
          if (isMissingTableError(insertErr)) throw new SupabaseTableMissingError();
          throw new Error(insertErr.message);
        }

        await ensureSupabaseStarterData(sbUserId);

        return {
          user: mapSbProfile(inserted as SbProfileRow),
          token: `supabase_${sbUserId}`,
        };
      },
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
    return withCloudRouting(
      () =>
        request<{ ok: boolean }>('/api/auth/logout', {
          method: 'POST',
        }),
      async () => ({ ok: true }),
      () => {
        const state = loadStaticWorkspace();
        state.activeEmail = null;
        saveStaticWorkspace(state);
        return { ok: true };
      },
    );
  },

  me(): Promise<{ user: UserProfile }> {
    return withCloudRouting(
      () => request<{ user: UserProfile }>('/api/auth/me'),
      async (sbUserId, sbEmail, sbMetaName) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUserId)
          .single();
        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }
        return { user: mapSbProfile(data as SbProfileRow) };
      },
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
    return withCloudRouting(
      () =>
        request<{ user: UserProfile }>('/api/account', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      async (sbUserId) => {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (typeof payload.name === 'string' && payload.name.trim().length >= 2) {
          updates.name = payload.name.trim();
        }
        if (payload.themePreference === 'light' || payload.themePreference === 'dark') {
          updates.theme_preference = payload.themePreference;
        }
        if (payload.cloudProvider) {
          updates.cloud_provider = payload.cloudProvider;
        }
        if (typeof payload.cloudBucketName === 'string' && payload.cloudBucketName.trim().length >= 3) {
          updates.cloud_bucket_name = payload.cloudBucketName.trim();
        }
        if (typeof payload.autoSync === 'boolean') {
          updates.auto_sync = payload.autoSync;
        }

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', sbUserId)
          .select('*')
          .single();

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }
        return { user: mapSbProfile(data as SbProfileRow) };
      },
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
    return withCloudRouting(
      () => request<{ categories: CategoryItem[] }>('/api/categories'),
      async (sbUserId) => {
        const categories = await ensureSupabaseStarterData(sbUserId);
        return { categories };
      },
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
    return withCloudRouting(
      () =>
        request<{ category: CategoryItem }>('/api/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      async (sbUserId) => {
        const existing = await ensureSupabaseStarterData(sbUserId);
        const cleanName = payload.name.trim();
        if (existing.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
          throw new Error('A category with this name already exists.');
        }

        const { data, error } = await supabase
          .from('categories')
          .insert({
            user_id: sbUserId,
            name: cleanName,
            accent_color:
              payload.accentColor || CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
          })
          .select('*')
          .single();

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }
        return { category: mapSbCategory(data as SbCategoryRow) };
      },
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
    return withCloudRouting(
      () =>
        request<{ ok: boolean; fallbackCategoryId: string }>(
          `/api/categories/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ),
      async (sbUserId) => {
        const cats = await ensureSupabaseStarterData(sbUserId);
        const target = cats.find((c) => c.id === id);
        if (!target) throw new Error('Category not found.');
        if (target.name.toLowerCase() === 'general') {
          throw new Error('The default General category cannot be deleted.');
        }
        const fallback =
          cats.find((c) => c.id !== id && c.name.toLowerCase() === 'general') ||
          cats.find((c) => c.id !== id);
        if (!fallback) throw new Error('At least one category must remain.');

        await supabase
          .from('notes')
          .update({ category_id: fallback.id, updated_at: new Date().toISOString() })
          .eq('user_id', sbUserId)
          .eq('category_id', id);

        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('user_id', sbUserId);

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }
        return { ok: true, fallbackCategoryId: fallback.id };
      },
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
    return withCloudRouting(
      () => request<{ notes: NoteItem[] }>('/api/notes'),
      async (sbUserId) => {
        const cats = await ensureSupabaseStarterData(sbUserId);
        const fallbackCatId = cats[0]?.id || '';
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', sbUserId)
          .order('is_pinned', { ascending: false })
          .order('updated_at', { ascending: false });

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }

        return {
          notes: ((data || []) as SbNoteRow[]).map((row) => mapSbNote(row, fallbackCatId)),
        };
      },
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
    return withCloudRouting(
      () =>
        request<{ note: NoteItem }>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      async (sbUserId) => {
        const now = new Date().toISOString();
        const metrics = countMetrics(payload.content);
        const { data, error } = await supabase
          .from('notes')
          .insert({
            user_id: sbUserId,
            title: payload.title.trim(),
            content: payload.content,
            category_id: payload.categoryId || null,
            is_pinned: Boolean(payload.isPinned),
            is_archived: false,
            word_count: metrics.wordCount,
            char_count: metrics.charCount,
            sync_version: 1,
            synced_at: now,
          })
          .select('*')
          .single();

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }

        await supabase
          .from('profiles')
          .update({ last_synced_at: now, updated_at: now })
          .eq('id', sbUserId);

        return { note: mapSbNote(data as SbNoteRow, payload.categoryId) };
      },
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
    return withCloudRouting(
      () =>
        request<{ note: NoteItem }>(`/api/notes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      async (sbUserId) => {
        const { data: current, error: getErr } = await supabase
          .from('notes')
          .select('sync_version, category_id')
          .eq('id', id)
          .eq('user_id', sbUserId)
          .single();

        if (getErr) {
          if (isMissingTableError(getErr)) throw new SupabaseTableMissingError();
          throw new Error(getErr.message);
        }

        const now = new Date().toISOString();
        const updates: Record<string, unknown> = {
          sync_version: ((current as { sync_version?: number })?.sync_version || 1) + 1,
          synced_at: now,
          updated_at: now,
        };
        if (typeof payload.title === 'string') updates.title = payload.title.trim();
        if (typeof payload.content === 'string') {
          updates.content = payload.content;
          const metrics = countMetrics(payload.content);
          updates.word_count = metrics.wordCount;
          updates.char_count = metrics.charCount;
        }
        if (typeof payload.categoryId === 'string') updates.category_id = payload.categoryId;
        if (typeof payload.isPinned === 'boolean') updates.is_pinned = payload.isPinned;
        if (typeof payload.isArchived === 'boolean') updates.is_archived = payload.isArchived;

        const { data, error } = await supabase
          .from('notes')
          .update(updates)
          .eq('id', id)
          .eq('user_id', sbUserId)
          .select('*')
          .single();

        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }

        await supabase
          .from('profiles')
          .update({ last_synced_at: now, updated_at: now })
          .eq('id', sbUserId);

        const fallbackCat = (current as { category_id?: string })?.category_id || '';
        return { note: mapSbNote(data as SbNoteRow, payload.categoryId || fallbackCat) };
      },
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
    return withCloudRouting(
      () =>
        request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      async (sbUserId) => {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .eq('user_id', sbUserId);
        if (error) {
          if (isMissingTableError(error)) throw new SupabaseTableMissingError();
          throw new Error(error.message);
        }
        return { ok: true };
      },
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
    return withCloudRouting(
      () =>
        request<{ summary: CloudSyncSummary }>('/api/cloud/sync', {
          method: 'POST',
        }),
      async (sbUserId) => {
        const now = new Date().toISOString();
        const [{ data: profile }, { data: notes }, { data: cats }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', sbUserId).single(),
          supabase.from('notes').select('*').eq('user_id', sbUserId),
          supabase.from('categories').select('*').eq('user_id', sbUserId),
        ]);

        await supabase
          .from('profiles')
          .update({ last_synced_at: now, updated_at: now })
          .eq('id', sbUserId);

        const storageBytes = new Blob([
          JSON.stringify({ notes: notes || [], categories: cats || [] }),
        ]).size;

        const p = profile as SbProfileRow | null;
        return {
          summary: {
            syncedAt: now,
            noteCount: (notes || []).length,
            categoryCount: (cats || []).length,
            storageBytes,
            provider: (p?.cloud_provider as CloudProvider) || 'AI Notes Cloud',
            bucketName: p?.cloud_bucket_name || 'ainotes-cloud-vault',
          },
        };
      },
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
    return withCloudRouting(
      async () => {
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
      },
      async (sbUserId) => {
        const [{ data: profile }, { data: cats }, { data: notes }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', sbUserId).single(),
          supabase.from('categories').select('*').eq('user_id', sbUserId),
          supabase.from('notes').select('*').eq('user_id', sbUserId),
        ]);
        const p = profile as SbProfileRow | null;
        return new Blob(
          [
            JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                workspace: {
                  owner: p?.name || 'AI Notes User',
                  email: p?.email || '',
                  cloudProvider: p?.cloud_provider || 'AI Notes Cloud',
                  cloudBucketName: p?.cloud_bucket_name || 'ainotes-cloud-vault',
                },
                categories: cats || [],
                notes: notes || [],
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        );
      },
      () => {
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
      },
    );
  },
};
