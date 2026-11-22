
import { Router, Response } from 'express';
import {
  authMiddleware,
  AuthenticatedRequest,
} from '../auth/auth.middleware.js';

import {
  getLearningPathForUser,
  getLessonContentForUser,
  startLessonAttemptForUser,
  submitAttemptAnswerForUser,
  getUserHeartStateForUser,
  getUserReviewQueueForUser,
  deleteReviewQueueEntryForUser,
} from './learning.service.js';

import { AnswerInputSchema } from '../../lib/schemas.js';

const router = Router();

// GET /api/learning-path
router.get(
  '/learning-path',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const result = await getLearningPathForUser(userId);

      if (!result) {
        return res.status(404).json({
          error: {
            code: 'LEARNING_PATH_NOT_FOUND',
            message: 'Learning path not found',
          },
        });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        'Learning path retrieval failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve learning path',
        },
      });
    }
  }
);


// GET /api/lessons/:lessonId
router.get(
  '/lessons/:lessonId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { lessonId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const result = await getLessonContentForUser(
        userId,
        lessonId
      );

      if (!result.allowed) {
        if (result.reason === 'NOT_FOUND') {
          return res.status(404).json({
            error: {
              code: 'LESSON_NOT_FOUND',
              message: 'Lesson not found',
            },
          });
        }

        return res.status(403).json({
          error: {
            code: 'LESSON_LOCKED',
            message: 'Complete the previous lesson to unlock this lesson',
          },
        });
      }

      return res.status(200).json(result.data);
    } catch (error) {
      console.error(
        'Lesson content retrieval failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve lesson content',
        },
      });
    }
  }
);

// POST /api/lessons/:lessonId/attempts
router.post(
  '/lessons/:lessonId/attempts',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { lessonId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      // The user ID always comes from the access token, never the body.
      const result = await startLessonAttemptForUser(
        userId,
        lessonId
      );

      if (!result.allowed) {
        if (result.reason === 'LESSON_NOT_FOUND') {
          return res.status(404).json({
            error: {
              code: 'LESSON_NOT_FOUND',
              message: 'Lesson not found',
            },
          });
        }

        if (result.reason === 'LESSON_COMPLETED') {
          return res.status(403).json({
            error: {
              code: 'LESSON_COMPLETED',
              message: 'This lesson has already been completed',
            },
          });
        }

        return res.status(403).json({
          error: {
            code: 'LESSON_LOCKED',
            message: 'Complete the previous lesson to unlock this lesson',
          },
        });
      }

      return res.status(201).json(result.data);
    } catch (error) {
      console.error(
        'Lesson attempt creation failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start lesson attempt',
        },
      });
    }
  }
);

// POST /api/lessons/:lessonId/attempts/:attemptId/exercises/:exerciseId/answer
router.post(
  '/lessons/:lessonId/attempts/:attemptId/exercises/:exerciseId/answer',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { lessonId, attemptId, exerciseId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      // The client describes what it submitted, never what is correct.
      const parsed = AnswerInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid answer payload',
          },
        });
      }

      const result = await submitAttemptAnswerForUser(
        userId,
        lessonId,
        attemptId,
        exerciseId,
        parsed.data
      );

      if (!result.allowed) {
        switch (result.reason) {
          case 'LESSON_NOT_FOUND':
            return res.status(404).json({
              error: {
                code: 'LESSON_NOT_FOUND',
                message: 'Lesson not found',
              },
            });

          case 'LESSON_LOCKED':
            return res.status(403).json({
              error: {
                code: 'LESSON_LOCKED',
                message:
                  'Complete the previous lesson to unlock this lesson',
              },
            });

          case 'EXERCISE_NOT_FOUND':
            return res.status(404).json({
              error: {
                code: 'EXERCISE_NOT_FOUND',
                message: 'Exercise not found',
              },
            });

          case 'ATTEMPT_NOT_FOUND':
            return res.status(404).json({
              error: {
                code: 'ATTEMPT_NOT_FOUND',
                message: 'Attempt not found',
              },
            });

          case 'LESSON_MISMATCH':
            return res.status(400).json({
              error: {
                code: 'ATTEMPT_LESSON_MISMATCH',
                message:
                  'Attempt does not belong to the requested lesson',
              },
            });

          case 'ATTEMPT_COMPLETED':
            return res.status(409).json({
              error: {
                code: 'ATTEMPT_COMPLETED',
                message:
                  'This attempt is already completed',
              },
            });

          case 'DUPLICATE_ANSWER':
            return res.status(409).json({
              error: {
                code: 'DUPLICATE_ANSWER',
                message:
                  'This exercise was already answered in this attempt',
              },
            });

          case 'NO_HEARTS':
            return res.status(409).json({
              error: {
                code: 'NO_HEARTS',
                message: 'No hearts remaining. Wait for regeneration.',
              },
            });

          case 'INVALID_INPUT':
            return res.status(400).json({
              error: {
                code: 'INVALID_ANSWER',
                message:
                  'Answer does not match the exercise or its content',
              },
            });

          case 'ANSWER_KEY_NOT_FOUND':
            return res.status(500).json({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Exercise is not configured for evaluation',
              },
            });
        }
      }

      return res.status(200).json(result.data);
    } catch (error) {
      console.error(
        'Answer submission failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit answer',
        },
      });
    }
  }
);

// GET /api/me/hearts
router.get(
  '/me/hearts',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const result = await getUserHeartStateForUser(userId);

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        'Heart state retrieval failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve heart state',
        },
      });
    }
  }
);

// GET /api/me/review-queue
router.get(
  '/me/review-queue',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const result = await getUserReviewQueueForUser(userId);

      return res.status(200).json({ reviewQueue: result });
    } catch (error) {
      console.error(
        'Review queue retrieval failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve review queue',
        },
      });
    }
  }
);

// POST /api/me/review-queue/:exerciseId/understood
router.post(
  '/me/review-queue/:exerciseId/understood',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const { exerciseId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      if (!exerciseId) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Exercise ID is required',
          },
        });
      }

      await deleteReviewQueueEntryForUser(userId, exerciseId);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(
        'Review queue deletion failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to remove review entry',
        },
      });
    }
  }
);

export default router;