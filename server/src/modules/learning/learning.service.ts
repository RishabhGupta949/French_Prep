import {
  getLearningPath,
  getUnits,
  getLessons,
  getUserLessonProgress,
  getLessonById,
  getUserLessonProgressById,
  getExercisesForLesson,
  getExerciseById,
  getAnswerKeyForExercise,
  createLessonAttempt,
  markLessonProgressInProgress,
  submitAnswerInTransaction,
  planHeartRegeneration,
  getInProgressLessonAttempt,
  startLessonAttemptAtomically,
  deleteReviewQueueEntry,
  type LearningPathRecord,
  type UnitRecord,
  type LessonRecord,
  type ExerciseRecord,
} from './learning.repository.js';

import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase.js';

import { userDoc, reviewItemsCol, reviewItemDoc } from '../../lib/collections.js';
import { now } from '../../lib/collections.js';

import {
  ReviewItemSchema,
} from '../../lib/schemas.js';
import type {
  AnswerInput,
  AnswerKey,
  ExerciseContent,
  ExerciseType,
  LessonAttempt,
  LessonProgress,
  ReviewItem,
} from '../../lib/schemas.js';

export type LearningLessonStatus =
  | 'LOCKED'
  | 'UNLOCKED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface LearningPathLesson extends LessonRecord {
  status: LearningLessonStatus;
}

export interface LearningPathUnit extends UnitRecord {
  lessons: LearningPathLesson[];
}

export interface LearningPathResponse {
  learningPath: LearningPathRecord;
  units: LearningPathUnit[];
  progress: {
    completedLessons: number;
    totalLessons: number;
  };
}

function sortLessons(a: LessonRecord, b: LessonRecord): number {
  return (
    a.sequence - b.sequence ||
    a.order - b.order ||
    a.id.localeCompare(b.id)
  );
}

function calculateLessonStatus(
  lesson: LessonRecord,
  lessonProgress: LessonProgress | undefined,
  calculatedStatuses: Map<string, LearningLessonStatus>
): LearningLessonStatus {
  // A lesson with a prerequisite stays locked until
  // that prerequisite is actually completed.
  if (lesson.previousLessonId !== null) {
    const previousStatus = calculatedStatuses.get(
      lesson.previousLessonId
    );

    if (previousStatus !== 'COMPLETED') {
      return 'LOCKED';
    }
  }

  if (lessonProgress?.status === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (lessonProgress?.status === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }

  return 'UNLOCKED';
}

export async function getLearningPathForUser(
  userId: string
): Promise<LearningPathResponse | null> {
  // Fetch independent Firestore resources concurrently.
  const [
    learningPath,
    units,
    lessons,
    userProgress,
  ] = await Promise.all([
    getLearningPath(),
    getUnits(),
    getLessons(),
    getUserLessonProgress(userId),
  ]);

  if (!learningPath) {
    return null;
  }

  // Sort units by their configured order.
  const sortedUnits = [...units].sort(
    (a, b) => a.order - b.order
  );

  // Sort all lessons by their learning sequence.
  const sortedLessons = [...lessons].sort(sortLessons);

  // Calculate statuses sequentially so that a locked
  // prerequisite cannot accidentally unlock later lessons.
  const calculatedStatuses = new Map<
    string,
    LearningLessonStatus
  >();

  for (const lesson of sortedLessons) {
    const progress = userProgress.get(lesson.id);

    const status = calculateLessonStatus(
      lesson,
      progress,
      calculatedStatuses
    );

    calculatedStatuses.set(lesson.id, status);
  }

  // Associate lessons with their corresponding units.
  const unitsWithLessons: LearningPathUnit[] =
    sortedUnits.map((unit) => ({
      ...unit,
      lessons: sortedLessons
        .filter((lesson) => lesson.unitId === unit.id)
        .map((lesson) => ({
          ...lesson,
          status: calculatedStatuses.get(lesson.id)!,
        })),
    }));

  const completedLessons = Array.from(
    calculatedStatuses.values()
  ).filter((status) => status === 'COMPLETED').length;

  return {
    learningPath,
    units: unitsWithLessons,
    progress: {
      completedLessons,
      totalLessons: sortedLessons.length,
    },
  };
}


export type LessonAccessResult =
  | {
      allowed: true;
      lesson: LessonRecord;
    }
  | {
      allowed: false;
      reason: 'NOT_FOUND' | 'LOCKED';
    };

export async function checkLessonAccess(
  userId: string,
  lessonId: string
): Promise<LessonAccessResult> {
  // First, check whether the lesson exists.
  const lesson = await getLessonById(lessonId);

  if (!lesson) {
    return {
      allowed: false,
      reason: 'NOT_FOUND',
    };
  }

  // The first lesson has no prerequisite.
  if (lesson.previousLessonId === null) {
    return {
      allowed: true,
      lesson,
    };
  }

  // Check the authenticated user's previous lesson.
  const previousProgress = await getUserLessonProgressById(
    userId,
    lesson.previousLessonId
  );

  // The previous lesson must actually be completed.
  if (previousProgress?.status !== 'COMPLETED') {
    return {
      allowed: false,
      reason: 'LOCKED',
    };
  }

  return {
    allowed: true,
    lesson,
  };
}


export interface PublicExercise
  extends Pick<ExerciseRecord, 'id' | 'order' | 'type' | 'prompt' | 'content'> {}

export interface LessonContentResponse {
  lesson: {
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    exerciseCount: number;
  };
  exercises: PublicExercise[];
}

export type LessonContentResult =
  | {
      allowed: true;
      data: LessonContentResponse;
    }
  | {
      allowed: false;
      reason: 'NOT_FOUND' | 'LOCKED';
    };

export async function getLessonContentForUser(
  userId: string,
  lessonId: string
): Promise<LessonContentResult> {
  // First verify that this user can access the lesson.
  const access = await checkLessonAccess(userId, lessonId);

  if (!access.allowed) {
    return access;
  }

  const lesson = access.lesson;

  // Fetch exercises only after access has been verified.
  const exercises = await getExercisesForLesson(lessonId);

  // Return only fields needed by the frontend.
  // Explanation is intentionally excluded because it may reveal answers.
  const publicExercises: PublicExercise[] = exercises.map(
    ({ id, order, type, prompt, content }) => ({
      id,
      order,
      type,
      prompt,
      content,
    })
  );

  return {
    allowed: true,
    data: {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        exerciseCount: lesson.exerciseCount,
      },
      exercises: publicExercises,
    },
  };
}


// ---------------------------------------------------------------------------
// Answer evaluation
// ---------------------------------------------------------------------------

export type AnswerEvaluationResult =
  | { ok: true; isCorrect: boolean }
  | {
      ok: false;
      reason: 'TYPE_MISMATCH' | 'INVALID_OPTION' | 'INVALID_TOKEN';
    };

/**
 * Normalize a fill-in-the-blank answer for comparison.
 *
 * - Unicode normalization keeps accented characters consistent.
 * - Collapsing whitespace ignores extra spaces and line breaks.
 * - Lowercasing makes the comparison case-insensitive.
 *
 * Diacritics are intentionally preserved: "eleve" is NOT "élève".
 */
export function normalizeFillBlankAnswer(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function evaluateMultipleChoiceAnswer(
  submittedOptionId: string,
  content: Extract<ExerciseContent, { type: 'MULTIPLE_CHOICE' }>,
  answerKey: Extract<AnswerKey, { type: 'MULTIPLE_CHOICE' }>
): AnswerEvaluationResult {
  // The option must belong to the exercise the student was shown.
  const optionExists = content.options.some(
    (option) => option.id === submittedOptionId
  );

  if (!optionExists) {
    return { ok: false, reason: 'INVALID_OPTION' };
  }

  return {
    ok: true,
    isCorrect: submittedOptionId === answerKey.correctOptionId,
  };
}

export function evaluateFillBlankAnswer(
  submittedText: string,
  answerKey: Extract<AnswerKey, { type: 'FILL_BLANK' }>
): AnswerEvaluationResult {
  const normalizedSubmission = normalizeFillBlankAnswer(submittedText);

  const isCorrect = answerKey.acceptedAnswers.some(
    (accepted) =>
      normalizeFillBlankAnswer(accepted) === normalizedSubmission
  );

  return { ok: true, isCorrect };
}

export function evaluateWordBankAnswer(
  submittedTokenIds: string[],
  content: Extract<ExerciseContent, { type: 'WORD_BANK' }>,
  answerKey: Extract<AnswerKey, { type: 'WORD_BANK' }>
): AnswerEvaluationResult {
  // Every submitted token must exist in this exercise's word bank.
  const knownTokenIds = new Set(
    content.wordBank.map((token) => token.id)
  );

  const hasUnknownToken = submittedTokenIds.some(
    (tokenId) => !knownTokenIds.has(tokenId)
  );

  if (hasUnknownToken) {
    return { ok: false, reason: 'INVALID_TOKEN' };
  }

  // Word order matters, so compare position by position.
  const isCorrect =
    submittedTokenIds.length === answerKey.correctTokenIds.length &&
    submittedTokenIds.every(
      (tokenId, index) =>
        tokenId === answerKey.correctTokenIds[index]
    );

  return { ok: true, isCorrect };
}

/**
 * Evaluate a submitted answer against the stored exercise and answer key.
 *
 * The exercise type stored in Firestore is authoritative. A client that
 * sends a different type is rejected instead of being graded with the
 * wrong comparator.
 */
export function evaluateAnswer(
  exerciseType: ExerciseType,
  content: ExerciseContent,
  answerKey: AnswerKey,
  input: AnswerInput
): AnswerEvaluationResult {
  if (input.type !== exerciseType) {
    return { ok: false, reason: 'TYPE_MISMATCH' };
  }

  switch (input.type) {
    case 'MULTIPLE_CHOICE': {
      if (
        content.type !== 'MULTIPLE_CHOICE' ||
        answerKey.type !== 'MULTIPLE_CHOICE'
      ) {
        return { ok: false, reason: 'TYPE_MISMATCH' };
      }

      return evaluateMultipleChoiceAnswer(
        input.answer.optionId,
        content,
        answerKey
      );
    }

    case 'FILL_BLANK': {
      if (answerKey.type !== 'FILL_BLANK') {
        return { ok: false, reason: 'TYPE_MISMATCH' };
      }

      return evaluateFillBlankAnswer(input.answer.text, answerKey);
    }

    case 'WORD_BANK': {
      if (
        content.type !== 'WORD_BANK' ||
        answerKey.type !== 'WORD_BANK'
      ) {
        return { ok: false, reason: 'TYPE_MISMATCH' };
      }

      return evaluateWordBankAnswer(
        input.answer.tokenIds,
        content,
        answerKey
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Lesson attempts
// ---------------------------------------------------------------------------

export interface LessonAttemptStartResponse {
  attemptId: string;
  lessonId: string;
  status: 'IN_PROGRESS';
  totalExercises: number;
  answeredCount: number;
}

export type LessonAttemptStartResult =
  | { allowed: true; data: LessonAttemptStartResponse }
  | {
      allowed: false;
      reason:
        | 'LESSON_NOT_FOUND'
        | 'LESSON_LOCKED'
        | 'LESSON_COMPLETED';
    };

export async function startLessonAttemptForUser(
  userId: string,
  lessonId: string
): Promise<LessonAttemptStartResult> {
  // First check lesson access
  const access = await checkLessonAccess(userId, lessonId);

  if (!access.allowed) {
    return {
      allowed: false,
      reason:
        access.reason === 'LOCKED'
          ? 'LESSON_LOCKED'
          : 'LESSON_NOT_FOUND',
    };
  }

  // If lesson is already COMPLETED, reject the start attempt
  const progress = await getUserLessonProgressById(userId, lessonId);
  if (progress?.status === 'COMPLETED') {
    return {
      allowed: false,
      reason: 'LESSON_COMPLETED',
    };
  }

  const totalExercises = access.lesson.exerciseCount;
  const startedAt = Timestamp.now();

  // Atomically check for existing IN_PROGRESS attempt and create new if absent.
  // This prevents race conditions from concurrent start requests: the transaction
  // ensures only one request can create/resume an IN_PROGRESS attempt per user+lesson.
const transactionalResult = await startLessonAttemptAtomically(
  userId,
  lessonId,
  startedAt,
  totalExercises
);

  if (transactionalResult.created) {
    // New attempt created - also mark lesson progress IN_PROGRESS
    await markLessonProgressInProgress(userId, lessonId, startedAt);
  } else {
    // Existing attempt resumed - its startedAt was already set in the transaction
  }

  const attempt = transactionalResult.attempt;

  return {
    allowed: true,
    data: {
      attemptId: attempt.id,
      lessonId,
      status: 'IN_PROGRESS',
      totalExercises: attempt.totalExercises,
      answeredCount: attempt.answeredCount,
    },
  };
}

export interface AttemptAnswerFeedback {
  exerciseId: string;
  isCorrect: boolean;
  explanation: string;
  attempt: {
    attemptId: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    answeredCount: number;
    correctCount: number;
    totalExercises: number;
    accuracy: number | null;
    xpAwarded?: number;
    dailyXp?: number;
    goalCompleted?: boolean;
    currentStreak?: number;
    lastActiveDate?: string;
    hearts?: number;
    nextHeartAt?: string | null;
  };
}

export type AttemptAnswerFailureReason =
  | 'LESSON_NOT_FOUND'
  | 'LESSON_LOCKED'
  | 'EXERCISE_NOT_FOUND'
  | 'ANSWER_KEY_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'ATTEMPT_NOT_FOUND'
  | 'LESSON_MISMATCH'
  | 'ATTEMPT_COMPLETED'
  | 'DUPLICATE_ANSWER'
  | 'NO_HEARTS';

export type AttemptAnswerResult =
  | { allowed: true; data: AttemptAnswerFeedback }
  | { allowed: false; reason: AttemptAnswerFailureReason };

export async function submitAttemptAnswerForUser(
  userId: string,
  lessonId: string,
  attemptId: string,
  exerciseId: string,
  input: AnswerInput
): Promise<AttemptAnswerResult> {
  // Locked lessons must never accept answers.
  const access = await checkLessonAccess(userId, lessonId);

  if (!access.allowed) {
    return {
      allowed: false,
      reason:
        access.reason === 'LOCKED'
          ? 'LESSON_LOCKED'
          : 'LESSON_NOT_FOUND',
    };
  }

  // The exercise path already scopes it to this lesson.
  const exercise = await getExerciseById(lessonId, exerciseId);

  if (!exercise) {
    return { allowed: false, reason: 'EXERCISE_NOT_FOUND' };
  }

  const answerKey = await getAnswerKeyForExercise(
    lessonId,
    exerciseId
  );

  if (!answerKey) {
    return { allowed: false, reason: 'ANSWER_KEY_NOT_FOUND' };
  }

  // The stored exercise type is authoritative; the client only describes
  // what it submitted.
  const evaluation = evaluateAnswer(
    exercise.type,
    exercise.content,
    answerKey,
    input
  );

  if (!evaluation.ok) {
    return { allowed: false, reason: 'INVALID_INPUT' };
  }

  const transaction = await submitAnswerInTransaction({
    userId,
    lessonId,
    attemptId,
    exerciseId,
    submittedAnswer: input.answer,
    isCorrect: evaluation.isCorrect,
  });

  if (!transaction.ok) {
    return { allowed: false, reason: transaction.reason };
  }

  const attempt = transaction.attempt;

  // Only safe feedback leaves the server. The answer key stays private.
      return {
        allowed: true,
        data: {
          exerciseId: exercise.id,
          isCorrect: evaluation.isCorrect,
          explanation: exercise.explanation ?? '',
          attempt: {
            attemptId: attempt.id,
            status: attempt.status,
            answeredCount: attempt.answeredCount,
            correctCount: attempt.correctCount,
            totalExercises: attempt.totalExercises,
            accuracy: attempt.accuracy ?? null,
            // Hearts are returned on every accepted answer response.
            hearts: transaction.hearts,
            nextHeartAt: transaction.nextHeartAt,
            // XP and daily stats are returned only in the completed attempt
            // response.
            ...(attempt.status === 'COMPLETED'
              ? {
                  xpAwarded: attempt.xpAwarded,
                  dailyXp: transaction.dailyXp,
                  goalCompleted: transaction.goalCompleted,
                  currentStreak: transaction.currentStreak,
                  lastActiveDate: transaction.lastActiveDate,
                }
              : {}),
          },
        },
      };
}

export interface UserHeartState {
  hearts: number;
  nextHeartAt: string | null;
}

/**
 * Retrieve the user's current calculated heart state.
 *
 * Reads the stored hearts/nextHeartAt and applies time-based regeneration
 * without persisting. Persistence happens on answer submission.
 */
export async function getUserHeartStateForUser(
  userId: string
): Promise<UserHeartState> {
  const userSnapshot = await userDoc(userId).get();
  const userData = userSnapshot.exists
    ? (userSnapshot.data() as Record<string, unknown>)
    : {};

  const heartState = planHeartRegeneration(
    {
      hearts: userData.hearts as number | undefined,
      nextHeartAtMillis:
        (userData.nextHeartAt as Timestamp | undefined)?.toMillis() ?? null,
    },
    now().toMillis()
  );

  return {
    hearts: heartState.hearts,
    nextHeartAt: heartState.nextHeartAtMillis !== null
      ? new Date(heartState.nextHeartAtMillis).toISOString()
      : null,
  };
}

export interface ReviewQueueEntry {
  exerciseId: string;
  lessonId: string;
  status: 'PENDING' | 'RESOLVED';
  wrongCount: number;
  lastWrongAt: string;
  firstQueuedAt: string;
  updatedAt: string;
}

/**
 * Retrieve the authenticated user's review queue.
 *
 * Returns all queued exercise entries (lesson IDs, timestamps, and counts).
 * Answer keys are never included.
 */
export async function getUserReviewQueueForUser(
  userId: string
): Promise<ReviewQueueEntry[]> {
  const snapshot = await reviewItemsCol(userId).get();

  const entries: ReviewQueueEntry[] = [];

  for (const doc of snapshot.docs) {
    const item = ReviewItemSchema.parse(doc.data());

    entries.push({
      exerciseId: doc.id,
      lessonId: item.lessonId,
      status: item.status,
      wrongCount: item.wrongCount,
      lastWrongAt: item.lastWrongAt.toDate().toISOString(),
      firstQueuedAt: item.createdAt.toDate().toISOString(),
      updatedAt: item.updatedAt.toDate().toISOString(),
    });
  }

  return entries;
}

export async function deleteReviewQueueEntryForUser(
  userId: string,
  exerciseId: string
): Promise<void> {
  await reviewItemDoc(userId, exerciseId).delete();
}
