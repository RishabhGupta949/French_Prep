
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  RegisterInputSchema,
  LoginInputSchema,
  OnboardingInputSchema,
} from '../../lib/schemas.js';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  storeRefreshTokenHash,
  verifyAndRotateRefreshToken,
} from './auth.service.js';
import {
  createUserWithEmailLookup,
  findUserByEmail,
  getUserById,
  updateUserOnboarding,
  revokeSession,
  rotateRefreshSession,
} from './auth.repository.js';
import { authMiddleware, AuthenticatedRequest } from './auth.middleware.js';
import { generateSessionId } from './auth.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const data = RegisterInputSchema.parse(req.body);

    const existing = await findUserByEmail(data.email);

    if (existing) {
      res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      });
      return;
    }

    const userId = generateSessionId();
    const passwordHash = await hashPassword(data.password);

    await createUserWithEmailLookup(
      userId,
      data,
      passwordHash,
      'UTC',
      10,
    );

    const sessionId = generateSessionId();

    const accessToken = await createAccessToken(
      userId,
      data.email.toLowerCase(),
      'LEARNER',
      sessionId,
    );

    const refreshToken = await createRefreshToken(userId, sessionId);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await storeRefreshTokenHash(
      userId,
      sessionId,
      refreshToken,
      expiresAt,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: {
        id: userId,
        name: data.name,
        email: data.email.toLowerCase(),
        targetLanguage: 'fr',
        dailyGoalXp: 10,
        dailyXp: 0,
        timeZone: 'UTC',
        xpTotal: 0,
        hearts: 5,
        nextHeartAt: null,
        streak: 0,
        onboardingCompletedAt: null,
      },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      });
      return;
    }

    if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
      res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      });
      return;
    }

    console.error('Registration error:', error);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed',
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const data = LoginInputSchema.parse(req.body);

    const user = await findUserByEmail(data.email);

    if (!user) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      return;
    }

    const isValid = await verifyPassword(
      data.password,
      user.data.passwordHash,
    );

    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      return;
    }

    const sessionId = generateSessionId();

    const accessToken = await createAccessToken(
      user.id,
      user.data.email,
      user.data.role,
      sessionId,
    );

    const refreshToken = await createRefreshToken(user.id, sessionId);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await storeRefreshTokenHash(
      user.id,
      sessionId,
      refreshToken,
      expiresAt,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        name: user.data.name,
        email: user.data.email,
        targetLanguage: user.data.targetLanguage,
        dailyGoalXp: user.data.dailyGoalXp,
        dailyXp: user.data.dailyXp ?? 0,
        timeZone: user.data.timeZone,
        xpTotal: user.data.xpTotal,
        hearts: user.data.hearts,
        nextHeartAt:
          user.data.nextHeartAt?.toDate?.().toISOString() || null,
        streak: user.data.currentStreak ?? 0,
        onboardingCompletedAt:
          user.data.onboardingCompletedAt?.toDate?.().toISOString() || null,
      },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      });
      return;
    }

    console.error('Login error:', error);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------

router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token required',
        },
      });
      return;
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token',
        },
      });
      return;
    }

    const result = await verifyAndRotateRefreshToken(
      payload.sub,
      payload.sid,
      refreshToken,
    );

    if (!result) {
      res.clearCookie('refreshToken');

      res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or revoked refresh token',
        },
      });
      return;
    }

    const { newRefreshToken, newSessionId } = result;

    const accessToken = await createAccessToken(
      payload.sub,
      '',
      '',
      newSessionId,
    );

    const user = await getUserById(payload.sub);

    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await rotateRefreshSession(
      payload.sub,
      payload.sid,
      newSessionId,
      newRefreshToken,
      expiresAt,
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Token refresh failed',
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

router.post(
  '/auth/logout',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await revokeSession(req.user!.sub, req.user!.sid);

      res.clearCookie('refreshToken');

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout failed',
        },
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Get current authenticated user
// ---------------------------------------------------------------------------

router.get(
  '/auth/me',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await getUserById(req.user!.sub);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      res.json({
        user: {
          id: req.user!.sub,
          name: user.name,
          email: user.email,
          targetLanguage: user.targetLanguage,
          dailyGoalXp: user.dailyGoalXp,
          dailyXp: user.dailyXp ?? 0,
          timeZone: user.timeZone,
          xpTotal: user.xpTotal,
          hearts: user.hearts,
          nextHeartAt:
            user.nextHeartAt?.toDate?.().toISOString() || null,
          streak: user.currentStreak ?? 0,
          onboardingCompletedAt:
            user.onboardingCompletedAt?.toDate?.().toISOString() || null,
        },
        isOnboarded: !!user.onboardingCompletedAt,
      });
    } catch (error) {
      console.error('Me error:', error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user',
        },
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Complete onboarding
// ---------------------------------------------------------------------------

router.patch(
  '/me/onboarding',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = OnboardingInputSchema.parse(req.body);

      await updateUserOnboarding(req.user!.sub, data);

      const user = await getUserById(req.user!.sub);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      res.json({
        user: {
          id: req.user!.sub,
          name: user.name,
          email: user.email,
          targetLanguage: user.targetLanguage,
          dailyGoalXp: user.dailyGoalXp,
          dailyXp: user.dailyXp ?? 0,
          timeZone: user.timeZone,
          xpTotal: user.xpTotal,
          hearts: user.hearts,
          nextHeartAt:
            user.nextHeartAt?.toDate?.().toISOString() || null,
          streak: user.currentStreak ?? 0,
          onboardingCompletedAt:
            user.onboardingCompletedAt?.toDate?.().toISOString() || null,
        },
        isOnboarded: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid onboarding data',
          },
        });
        return;
      }

      console.error('Onboarding error:', error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Onboarding failed',
        },
      });
    }
  },
);

export default router;
