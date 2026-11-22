
import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  authMiddleware,
  type AuthenticatedRequest,
} from '../auth/auth.middleware.js';

import {
  getReviewExplanationFromNIM,
  NIMError,
} from './ai.service.js';

const router = Router();

const ReviewExplanationInputSchema = z.object({
  exerciseId: z.string().trim().min(1).max(200),
});

router.post(
  '/ai/review-explanation',
  authMiddleware,
  async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const parsed = ReviewExplanationInputSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid exerciseId is required.',
        },
      });
      return;
    }

    // User ID comes exclusively from the verified JWT.
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    try {
      const explanation = await getReviewExplanationFromNIM(
        userId,
        parsed.data.exerciseId,
      );

      res.status(200).json({
        explanation,
      });
    } catch (error) {
      if (error instanceof NIMError) {
        const code =
          error.statusCode === 404
            ? 'REVIEW_ITEM_NOT_FOUND'
            : error.statusCode === 409
              ? 'REVIEW_ANSWER_UNAVAILABLE'
              : 'AI_SERVICE_ERROR';

        res.status(error.statusCode).json({
          error: {
            code,
            message: error.message,
          },
        });

        return;
      }

      console.error('Review explanation failed:', error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to generate the explanation.',
        },
      });
    }
  },
);

export default router;
