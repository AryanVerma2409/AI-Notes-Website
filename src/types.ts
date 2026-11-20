export type ThemePreference = 'light' | 'dark';

export type CloudProvider =
  | 'AI Notes Cloud'
  | 'Google Drive Mirror'
  | 'AWS S3 Vault'
  | 'Dropbox Sync';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  themePreference: ThemePreference;
  cloudProvider: CloudProvider;
  cloudBucketName: string;
  autoSync: boolean;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryItem {
  id: string;
  userId: string;
  name: string;
  accentColor: string;
  createdAt: string;
}

export interface NoteItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  categoryId: string;
  isPinned: boolean;
  isArchived: boolean;
  wordCount: number;
  charCount: number;
  syncVersion: number;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  token: string;
}

export interface CloudSyncSummary {
  syncedAt: string;
  noteCount: number;
  categoryCount: number;
  storageBytes: number;
  provider: CloudProvider;
  bucketName: string;
}
