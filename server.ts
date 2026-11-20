import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'ai-notes-cloud.json');
const SESSION_COOKIE_NAME = 'ai_notes_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`ai-notes-workspace-secret-${__dirname}`)
    .digest('hex');

const DEFAULT_AVATAR = '/src/assets/images/user_avatar_portrait_1795152808598.jpg';

type ThemePreference = 'light' | 'dark';
type CloudProvider =
  | 'AI Notes Cloud'
  | 'Google Drive Mirror'
  | 'AWS S3 Vault'
  | 'Dropbox Sync';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  avatarUrl: string;
  themePreference: ThemePreference;
  cloudProvider: CloudProvider;
  cloudBucketName: string;
  autoSync: boolean;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredCategory {
  id: string;
  userId: string;
  name: string;
  accentColor: string;
  createdAt: string;
}

interface StoredNote {
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

interface DatabaseSchema {
  users: StoredUser[];
  categories: StoredCategory[];
  notes: StoredNote[];
}

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const VALID_PROVIDERS: CloudProvider[] = [
  'AI Notes Cloud',
  'Google Drive Mirror',
  'AWS S3 Vault',
  'Dropbox Sync',
];

const CATEGORY_COLORS = [
  '#2563EB',
  '#0D9488',
  '#D97706',
  '#4F46E5',
  '#64748B',
  '#0284C7',
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    }),
    'utf8',
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  if (!token || !token.includes('.')) {
    return null;
  }
  const [payload, sig] = token.split('.');
  if (!payload || !sig) {
    return null;
  }
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

function countMetrics(content: string): { wordCount: number; charCount: number } {
  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  return { wordCount, charCount: content.length };
}

function createStarterWorkspace(userId: string, now: string): {
  categories: StoredCategory[];
  notes: StoredNote[];
} {
  const catGeneral: StoredCategory = {
    id: `cat_${crypto.randomUUID()}`,
    userId,
    name: 'General',
    accentColor: '#64748B',
    createdAt: now,
  };
  const catWork: StoredCategory = {
    id: `cat_${crypto.randomUUID()}`,
    userId,
    name: 'Work',
    accentColor: '#2563EB',
    createdAt: now,
  };
  const catIdeas: StoredCategory = {
    id: `cat_${crypto.randomUUID()}`,
    userId,
    name: 'Ideas',
    accentColor: '#0D9488',
    createdAt: now,
  };
  const catResearch: StoredCategory = {
    id: `cat_${crypto.randomUUID()}`,
    userId,
    name: 'Research',
    accentColor: '#4F46E5',
    createdAt: now,
  };
  const catPersonal: StoredCategory = {
    id: `cat_${crypto.randomUUID()}`,
    userId,
    name: 'Personal',
    accentColor: '#D97706',
    createdAt: now,
  };

  const sampleNotes: Array<{
    title: string;
    content: string;
    categoryId: string;
    isPinned: boolean;
  }> = [
    {
      title: 'Welcome to AI Notes Cloud Workspace',
      categoryId: catGeneral.id,
      isPinned: true,
      content:
        'Your notes are automatically persisted and synchronized with cloud storage.\n\nQuick tips to organize effectively:\n- Use the sidebar Create Notes button to open the quick composer modal from anywhere.\n- Categorize notes into Work, Ideas, Research, Personal, or add your own custom categories.\n- Pin priority notes to keep them anchored at the top of Home and My Notes.\n- Open Account Settings to configure your cloud storage mirror, theme, and export snapshots.',
    },
    {
      title: 'Q4 Product Architecture & Sync Priorities',
      categoryId: catWork.id,
      isPinned: true,
      content:
        'Key milestones for the upcoming release cycle:\n\n1. Zero-latency optimistic note updates with automatic cloud conflict versioning.\n2. Streamlined category filtering and keyboard-friendly modal overlays.\n3. One-click JSON archive backups for portable workspace ownership.\n\nNext review scheduled for Thursday at 10:00 AM.',
    },
    {
      title: 'Weekend Reading & Synthesis List',
      categoryId: catResearch.id,
      isPinned: false,
      content:
        'Topics to explore and summarize:\n- Designing calm, high-signal productivity workspaces\n- Local-first vs cloud-authoritative sync topologies\n- Typographic hierarchy for long-form technical note-taking',
    },
    {
      title: 'Feature Concepts for Mobile Companion',
      categoryId: catIdeas.id,
      isPinned: false,
      content:
        'Capture fleeting ideas in under 5 seconds:\n- Voice-to-note quick capture shortcut\n- Automatic category suggestion based on recent projects\n- Offline queue that reconciles on reconnect',
    },
  ];

  const notes: StoredNote[] = sampleNotes.map((item, idx) => {
    const metrics = countMetrics(item.content);
    const ts = new Date(Date.now() - idx * 1000 * 60 * 18).toISOString();
    return {
      id: `note_${crypto.randomUUID()}`,
      userId,
      title: item.title,
      content: item.content,
      categoryId: item.categoryId,
      isPinned: item.isPinned,
      isArchived: false,
      wordCount: metrics.wordCount,
      charCount: metrics.charCount,
      syncVersion: 1,
      syncedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
  });

  return {
    categories: [catGeneral, catWork, catIdeas, catResearch, catPersonal],
    notes,
  };
}

function loadDatabase(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const now = new Date().toISOString();
    const demoId = 'user_demo_ainotes';
    const { hash, salt } = hashPassword('DemoNotes2026!');
    const starter = createStarterWorkspace(demoId, now);
    const initial: DatabaseSchema = {
      users: [
        {
          id: demoId,
          name: 'Elena Vance',
          email: 'demo@ainotes.cloud',
          passwordHash: hash,
          passwordSalt: salt,
          avatarUrl: DEFAULT_AVATAR,
          themePreference: 'light',
          cloudProvider: 'AI Notes Cloud',
          cloudBucketName: 'ainotes-eu-west-vault',
          autoSync: true,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
      categories: starter.categories,
      notes: starter.notes,
    };
    saveDatabase(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { users: [], categories: [], notes: [] };
  }
}

function saveDatabase(db: DatabaseSchema): void {
  ensureDataDir();
  const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

let dbState: DatabaseSchema = loadDatabase();

function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    themePreference: user.themePreference,
    cloudProvider: user.cloudProvider,
    cloudBucketName: user.cloudBucketName,
    autoSync: user.autoSync,
    lastSyncedAt: user.lastSyncedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      result[key] = decodeURIComponent(value);
    }
  }
  return result;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const exists = dbState.users.some((u) => u.id === userId);
  if (!exists) {
    res.status(401).json({ error: 'Session expired or user not found.' });
    return;
  }
  req.userId = userId;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Auth Routes
  app.post('/api/auth/signup', (req: Request, res: Response) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (cleanName.length < 2 || cleanName.length > 80) {
      res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (rawPassword.length < 6 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existingUser = dbState.users.find((u) => u.email === cleanEmail);
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const userId = `user_${crypto.randomUUID()}`;
    const { hash, salt } = hashPassword(rawPassword);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';

    const newUser: StoredUser = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hash,
      passwordSalt: salt,
      avatarUrl: DEFAULT_AVATAR,
      themePreference: 'light',
      cloudProvider: 'AI Notes Cloud',
      cloudBucketName: `ainotes-${slug}-vault`,
      autoSync: true,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const starter = createStarterWorkspace(userId, now);
    dbState.users.push(newUser);
    dbState.categories.push(...starter.categories);
    dbState.notes.push(...starter.notes);
    saveDatabase(dbState);

    const token = signSessionToken(userId);
    setSessionCookie(res, token);
    res.status(201).json({ user: sanitizeUser(newUser), token });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!cleanEmail || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = dbState.users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(rawPassword, user.passwordHash, user.passwordSalt)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/demo', (_req: Request, res: Response) => {
    const demoUser = dbState.users.find((u) => u.email === 'demo@ainotes.cloud') || dbState.users[0];
    if (!demoUser) {
      res.status(404).json({ error: 'Demo workspace unavailable.' });
      return;
    }
    const token = signSessionToken(demoUser.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(demoUser), token });
  });

  app.post('/api/auth/supabase', (req: Request, res: Response) => {
    const { email, name, mode } = req.body as {
      email?: string;
      name?: string;
      mode?: 'signup' | 'login';
    };
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' && name.trim().length >= 2
      ? name.trim()
      : cleanEmail.split('@')[0] || 'AI Notes User';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }

    let user = dbState.users.find((u) => u.email === cleanEmail);
    if (user && mode === 'signup') {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead or use a different email.',
      });
      return;
    }

    if (!user) {
      const now = new Date().toISOString();
      const userId = `user_${crypto.randomUUID()}`;
      const { hash, salt } = hashPassword(crypto.randomBytes(24).toString('hex'));
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';

      user = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        passwordHash: hash,
        passwordSalt: salt,
        avatarUrl: DEFAULT_AVATAR,
        themePreference: 'light',
        cloudProvider: 'AI Notes Cloud',
        cloudBucketName: `ainotes-${slug}-vault`,
        autoSync: true,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const starter = createStarterWorkspace(userId, now);
      dbState.users.push(user);
      dbState.categories.push(...starter.categories);
      dbState.notes.push(...starter.notes);
      saveDatabase(dbState);
    }

    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = dbState.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  // Account Settings & Cloud Storage Configuration
  app.patch('/api/account', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = dbState.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { name, themePreference, cloudProvider, cloudBucketName, autoSync } = req.body as {
      name?: string;
      themePreference?: ThemePreference;
      cloudProvider?: CloudProvider;
      cloudBucketName?: string;
      autoSync?: boolean;
    };

    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        res.status(400).json({ error: 'Display name must be between 2 and 80 characters.' });
        return;
      }
      user.name = trimmed;
    }

    if (themePreference === 'light' || themePreference === 'dark') {
      user.themePreference = themePreference;
    }

    if (cloudProvider && VALID_PROVIDERS.includes(cloudProvider)) {
      user.cloudProvider = cloudProvider;
    }

    if (typeof cloudBucketName === 'string') {
      const trimmedBucket = cloudBucketName.trim();
      if (trimmedBucket.length >= 3 && trimmedBucket.length <= 80) {
        user.cloudBucketName = trimmedBucket;
      }
    }

    if (typeof autoSync === 'boolean') {
      user.autoSync = autoSync;
    }

    user.updatedAt = new Date().toISOString();
    saveDatabase(dbState);
    res.json({ user: sanitizeUser(user) });
  });

  // Categories
  app.get('/api/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const categories = dbState.categories.filter((c) => c.userId === req.userId);
    res.json({ categories });
  });

  app.post('/api/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { name, accentColor } = req.body as { name?: string; accentColor?: string };
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 1 || cleanName.length > 36) {
      res.status(400).json({ error: 'Category name must be between 1 and 36 characters.' });
      return;
    }

    const duplicate = dbState.categories.find(
      (c) => c.userId === req.userId && c.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (duplicate) {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }

    const userCategoryCount = dbState.categories.filter((c) => c.userId === req.userId).length;
    const chosenColor =
      typeof accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(accentColor)
        ? accentColor
        : CATEGORY_COLORS[userCategoryCount % CATEGORY_COLORS.length];

    const category: StoredCategory = {
      id: `cat_${crypto.randomUUID()}`,
      userId: req.userId!,
      name: cleanName,
      accentColor: chosenColor,
      createdAt: new Date().toISOString(),
    };

    dbState.categories.push(category);
    saveDatabase(dbState);
    res.status(201).json({ category });
  });

  app.delete('/api/categories/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const catIndex = dbState.categories.findIndex(
      (c) => c.id === req.params.id && c.userId === req.userId,
    );
    if (catIndex === -1) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const target = dbState.categories[catIndex];
    if (target.name.toLowerCase() === 'general') {
      res.status(400).json({ error: 'The default General category cannot be deleted.' });
      return;
    }

    const fallback =
      dbState.categories.find(
        (c) => c.userId === req.userId && c.id !== target.id && c.name.toLowerCase() === 'general',
      ) || dbState.categories.find((c) => c.userId === req.userId && c.id !== target.id);

    if (!fallback) {
      res.status(400).json({ error: 'At least one category must remain in your workspace.' });
      return;
    }

    const now = new Date().toISOString();
    for (const note of dbState.notes) {
      if (note.userId === req.userId && note.categoryId === target.id) {
        note.categoryId = fallback.id;
        note.updatedAt = now;
      }
    }

    dbState.categories.splice(catIndex, 1);
    saveDatabase(dbState);
    res.json({ ok: true, fallbackCategoryId: fallback.id });
  });

  // Notes CRUD
  app.get('/api/notes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notes = dbState.notes
      .filter((n) => n.userId === req.userId)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    res.json({ notes });
  });

  app.post('/api/notes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { title, content, categoryId, isPinned } = req.body as {
      title?: string;
      content?: string;
      categoryId?: string;
      isPinned?: boolean;
    };

    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanContent = typeof content === 'string' ? content : '';

    if (cleanTitle.length < 1 || cleanTitle.length > 160) {
      res.status(400).json({ error: 'Note title must be between 1 and 160 characters.' });
      return;
    }
    if (cleanContent.length > 100000) {
      res.status(400).json({ error: 'Note content exceeds the 100,000 character limit.' });
      return;
    }

    const userCategories = dbState.categories.filter((c) => c.userId === req.userId);
    const validCategory =
      userCategories.find((c) => c.id === categoryId) || userCategories[0];

    if (!validCategory) {
      res.status(400).json({ error: 'No valid category found for note.' });
      return;
    }

    const now = new Date().toISOString();
    const metrics = countMetrics(cleanContent);
    const note: StoredNote = {
      id: `note_${crypto.randomUUID()}`,
      userId: req.userId!,
      title: cleanTitle,
      content: cleanContent,
      categoryId: validCategory.id,
      isPinned: Boolean(isPinned),
      isArchived: false,
      wordCount: metrics.wordCount,
      charCount: metrics.charCount,
      syncVersion: 1,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    dbState.notes.push(note);
    const user = dbState.users.find((u) => u.id === req.userId);
    if (user && user.autoSync) {
      user.lastSyncedAt = now;
    }
    saveDatabase(dbState);
    res.status(201).json({ note });
  });

  app.patch('/api/notes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const note = dbState.notes.find((n) => n.id === req.params.id && n.userId === req.userId);
    if (!note) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }

    const { title, content, categoryId, isPinned, isArchived } = req.body as {
      title?: string;
      content?: string;
      categoryId?: string;
      isPinned?: boolean;
      isArchived?: boolean;
    };

    if (typeof title === 'string') {
      const cleanTitle = title.trim();
      if (cleanTitle.length < 1 || cleanTitle.length > 160) {
        res.status(400).json({ error: 'Note title must be between 1 and 160 characters.' });
        return;
      }
      note.title = cleanTitle;
    }

    if (typeof content === 'string') {
      if (content.length > 100000) {
        res.status(400).json({ error: 'Note content exceeds the 100,000 character limit.' });
        return;
      }
      note.content = content;
      const metrics = countMetrics(content);
      note.wordCount = metrics.wordCount;
      note.charCount = metrics.charCount;
    }

    if (typeof categoryId === 'string') {
      const exists = dbState.categories.some(
        (c) => c.id === categoryId && c.userId === req.userId,
      );
      if (!exists) {
        res.status(400).json({ error: 'Invalid category selected.' });
        return;
      }
      note.categoryId = categoryId;
    }

    if (typeof isPinned === 'boolean') {
      note.isPinned = isPinned;
    }

    if (typeof isArchived === 'boolean') {
      note.isArchived = isArchived;
    }

    const now = new Date().toISOString();
    note.syncVersion += 1;
    note.syncedAt = now;
    note.updatedAt = now;

    const user = dbState.users.find((u) => u.id === req.userId);
    if (user && user.autoSync) {
      user.lastSyncedAt = now;
    }

    saveDatabase(dbState);
    res.json({ note });
  });

  app.delete('/api/notes/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = dbState.notes.findIndex(
      (n) => n.id === req.params.id && n.userId === req.userId,
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    dbState.notes.splice(idx, 1);
    const now = new Date().toISOString();
    const user = dbState.users.find((u) => u.id === req.userId);
    if (user && user.autoSync) {
      user.lastSyncedAt = now;
    }
    saveDatabase(dbState);
    res.json({ ok: true });
  });

  // Explicit Cloud Storage Sync & Export
  app.post('/api/cloud/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = dbState.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = new Date().toISOString();
    const userNotes = dbState.notes.filter((n) => n.userId === req.userId);
    const userCategories = dbState.categories.filter((c) => c.userId === req.userId);

    for (const note of userNotes) {
      note.syncedAt = now;
    }
    user.lastSyncedAt = now;
    user.updatedAt = now;
    saveDatabase(dbState);

    const storageBytes = Buffer.byteLength(
      JSON.stringify({ notes: userNotes, categories: userCategories }),
      'utf8',
    );

    res.json({
      summary: {
        syncedAt: now,
        noteCount: userNotes.length,
        categoryCount: userCategories.length,
        storageBytes,
        provider: user.cloudProvider,
        bucketName: user.cloudBucketName,
      },
    });
  });

  app.get('/api/cloud/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = dbState.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const userNotes = dbState.notes.filter((n) => n.userId === req.userId);
    const userCategories = dbState.categories.filter((c) => c.userId === req.userId);

    res.setHeader('Content-Disposition', 'attachment; filename="ai-notes-cloud-backup.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      workspace: {
        owner: user.name,
        email: user.email,
        cloudProvider: user.cloudProvider,
        cloudBucketName: user.cloudBucketName,
      },
      categories: userCategories,
      notes: userNotes,
    });
  });

  // Frontend Vite Dev Middleware or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Notes server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AI Notes server:', err);
  process.exit(1);
});
