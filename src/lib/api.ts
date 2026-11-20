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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
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

export const api = {
  signup(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  loginDemo(): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/demo', {
      method: 'POST',
    });
  },

  syncSupabaseSession(payload: {
    email: string;
    name?: string;
    mode?: 'signup' | 'login';
  }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/supabase', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  me(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  updateAccount(payload: {
    name?: string;
    themePreference?: ThemePreference;
    cloudProvider?: CloudProvider;
    cloudBucketName?: string;
    autoSync?: boolean;
  }): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/account', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getCategories(): Promise<{ categories: CategoryItem[] }> {
    return request<{ categories: CategoryItem[] }>('/api/categories');
  },

  createCategory(payload: { name: string; accentColor?: string }): Promise<{ category: CategoryItem }> {
    return request<{ category: CategoryItem }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteCategory(id: string): Promise<{ ok: boolean; fallbackCategoryId: string }> {
    return request<{ ok: boolean; fallbackCategoryId: string }>(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  getNotes(): Promise<{ notes: NoteItem[] }> {
    return request<{ notes: NoteItem[] }>('/api/notes');
  },

  createNote(payload: {
    title: string;
    content: string;
    categoryId: string;
    isPinned?: boolean;
  }): Promise<{ note: NoteItem }> {
    return request<{ note: NoteItem }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    return request<{ note: NoteItem }>(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteNote(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  syncCloud(): Promise<{ summary: CloudSyncSummary }> {
    return request<{ summary: CloudSyncSummary }>('/api/cloud/sync', {
      method: 'POST',
    });
  },

  async exportCloudBackup(): Promise<Blob> {
    const token = getStoredToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch('/api/cloud/export', {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to export cloud archive.');
    }
    return res.blob();
  },
};
