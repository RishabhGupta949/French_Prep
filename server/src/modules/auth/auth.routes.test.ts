import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide valid env before auth modules load (auth.service calls getEnv() at module level).
vi.mock('../../config/env.js', () => ({
  getEnv: vi.fn(() => ({
    NODE_ENV: 'test',
    PORT: 3000,
    CLIENT_ORIGIN: 'http://localhost:5173',
    JWT_ACCESS_SECRET: 'test-access-secret-key-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-at-least-32-chars',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@example.com',
    FIREBASE_PRIVATE_KEY: 'test-private-key',
    FIRESTORE_EMULATOR_HOST: undefined,
    NVIDIA_NIM_API_KEY: 'test-nvidia-key',
    NVIDIA_NIM_BASE_URL: 'https://integrate.api.nvidia.com/v1',
    NVIDIA_NIM_MODEL: 'meta/llama-3.1-70b-instruct',
  })),
  validateEnv: vi.fn(),
}));

// Mock Firebase so repository imports resolve.
vi.mock('../../config/firebase.js', () => ({
  getDb: vi.fn(),
  initializeFirebase: vi.fn(),
}));

// Mock getUserById so the /me route can be tested without Firestore.
vi.mock('./auth.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth.repository.js')>();
  return {
    ...actual,
    getUserById: vi.fn(),
  };
});

// Mock authMiddleware as a pass-through.
vi.mock('./auth.middleware.js', () => ({
  authMiddleware: vi.fn(async (_req: any, _res: any, next: () => void) => {
    _req.user = {
      sub: 'user-1',
      email: 'learner@example.com',
      role: 'LEARNER',
      sid: 'session-1',
    };
    next();
  }),
}));

import { Timestamp } from 'firebase-admin/firestore';
import { getUserById } from './auth.repository.js';
import authRoutes from './auth.routes.js';

const NOW = Timestamp.fromDate(new Date('2026-01-01T12:00:00.000Z'));

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Learner',
    email: 'learner@example.com',
    targetLanguage: 'fr',
    passwordHash: 'hashed-password',
    role: 'LEARNER' as const,
    dailyGoalXp: 10,
    dailyXp: 7,
    timeZone: 'America/New_York',
    xpTotal: 42,
    hearts: 5,
    nextHeartAt: null,
    currentStreak: 3,
    onboardingCompletedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function findMeHandler(app: any) {
  const layer = app.stack.find(
    (l: any) => l.route?.path === '/auth/me' && l.route?.methods?.get
  );
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.mocked(getUserById).mockResolvedValue(buildUser());
  });

  it('returns dailyXp in the user payload', async () => {
    const handler = findMeHandler(authRoutes);

    const req: any = { user: { sub: 'user-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await handler(req, res, () => {});

    expect(res.json).toHaveBeenCalledTimes(1);
    const body = res.json.mock.calls[0][0];
    expect(body.user.dailyXp).toBe(7);
    expect(body.user.dailyGoalXp).toBe(10);
    expect(body.user.xpTotal).toBe(42);
    expect(body.user.streak).toBe(3);
  });

  it('handles missing dailyXp safely', async () => {
    vi.mocked(getUserById).mockResolvedValue(buildUser({ dailyXp: undefined }));

    const handler = findMeHandler(authRoutes);

    const req: any = { user: { sub: 'user-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await handler(req, res, () => {});

    expect(res.json).toHaveBeenCalledTimes(1);
    const body = res.json.mock.calls[0][0];
    expect(body.user.dailyXp).toBeUndefined();
    expect(body.user.dailyGoalXp).toBe(10);
  });

  it('returns 404 when the user is not found', async () => {
    vi.mocked(getUserById).mockResolvedValue(null);

    const handler = findMeHandler(authRoutes);

    const req: any = { user: { sub: 'user-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await handler(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });
});
