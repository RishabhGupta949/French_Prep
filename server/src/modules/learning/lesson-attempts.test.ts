import {
  LEARNING_PATH_ID,
  getLearningPathRef,
  unitsCol,
  lessonsCol,
  lessonProgressCol,
  lessonProgressDoc,
  lessonDoc,
  exercisesCol,
  exerciseDoc,
  answerKeyDoc,
  lessonAttemptDoc,
  lessonAttemptsCol,
  answerDoc,
  userDoc,
  reviewItemDoc,
  generateId,
  now,
} from "../../lib/collections.js";

import { getDb } from "../../config/firebase.js";

import {
  LearningPathSchema,
  UnitSchema,
  LessonMetadataSchema,
  LessonProgressSchema,
  ExerciseSchema,
  AnswerKeySchema,
  LessonAttemptSchema,
  ReviewItemSchema,
} from "../../lib/schemas.js";

import { Timestamp } from "firebase-admin/firestore";

import type {
  LearningPath,
  Unit,
  LessonMetadata,
  LessonProgress,
  Exercise,
  AnswerKey,
  LessonAttempt,
  ReviewItem,
} from "../../lib/schemas.js";

// Records include the Firestore document ID.
export interface LearningPathRecord extends LearningPath {
  id: string;
}

export interface UnitRecord extends Unit {
  id: string;
}

export interface LessonRecord extends LessonMetadata {
  id: string;
}

export interface ExerciseRecord extends Exercise {
  id: string;
}

export interface AttemptRecord extends LessonAttempt {
  id: string;
}

// XP awarded the first time a lesson is completed. Repeat completions award 0.
export const XP_PER_COMPLETION = 10;

// Hearts constants.
export const MAX_HEARTS = 5;
export const HEART_REGEN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface HeartState {
  hearts: number;
  nextHeartAtMillis: number | null;
}

/**
 * Pure decision logic for heart regeneration.
 *
 * Calculates how many hearts should have regenerated since `nextHeartAtMillis`
 * using elapsed wall-clock time (DST-independent). Does not consume hearts.
 * All inputs/outputs are epoch milliseconds to avoid runtime Timestamp
 * dependencies in pure logic.
 */
export function planHeartRegeneration(
  user: { hearts?: number | null; nextHeartAtMillis?: number | null } | null,
  nowMillis: number,
): HeartState {
  let hearts = user?.hearts ?? MAX_HEARTS;
  let nextHeartAtMillis = user?.nextHeartAtMillis ?? null;

  if (hearts > MAX_HEARTS) {
    hearts = MAX_HEARTS;
  }

  if (hearts >= MAX_HEARTS) {
    return { hearts: MAX_HEARTS, nextHeartAtMillis: null };
  }

  if (nextHeartAtMillis === null) {
    nextHeartAtMillis = nowMillis + HEART_REGEN_INTERVAL_MS;
    return { hearts, nextHeartAtMillis };
  }

  if (nowMillis < nextHeartAtMillis) {
    return { hearts, nextHeartAtMillis };
  }

  const elapsedMs = nowMillis - nextHeartAtMillis;
  const intervalsPassed = Math.floor(elapsedMs / HEART_REGEN_INTERVAL_MS);
  const heartsToAdd = intervalsPassed + 1;

  const newHearts = Math.min(MAX_HEARTS, hearts + heartsToAdd);
  const actualAdded = newHearts - hearts;

  if (newHearts >= MAX_HEARTS) {
    nextHeartAtMillis = null;
  } else {
    nextHeartAtMillis =
      nextHeartAtMillis + actualAdded * HEART_REGEN_INTERVAL_MS;
  }

  return { hearts: newHearts, nextHeartAtMillis };
}

export interface ReviewQueueAction {
  type: "SET" | "DELETE" | "NONE";
  entry?: ReviewItem;
}

/**
 * Pure decision logic for review queue updates.
 *
 * - Accepted incorrect answer: add or update the exercise entry
 *   (exerciseId as doc ID), incrementing wrongCount and updating
 *   lastWrongAt while preserving createdAt.
 * - Accepted correct answer: remove the exercise from the queue
 *   if present.
 * - Returns NONE when no queue change is needed.
 */
export function planReviewQueueAction(
  existing: ReviewItem | null,
  isCorrect: boolean,
  lessonId: string,
  exerciseId: string,
  submittedAt: Timestamp,
): ReviewQueueAction {
  if (isCorrect) {
    if (existing) {
      return { type: "DELETE" };
    }
    return { type: "NONE" };
  }

  if (existing) {
    return {
      type: "SET",
      entry: {
        lessonId,
        status: "PENDING",
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: submittedAt,
        createdAt: existing.createdAt,
        updatedAt: submittedAt,
      },
    };
  }

  return {
    type: "SET",
    entry: {
      lessonId,
      status: "PENDING",
      wrongCount: 1,
      lastWrongAt: submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    },
  };
}

// Local calendar date key (YYYY-MM-DD) in the user's time zone. Uses
// Intl.DateTimeFormat so no new dependencies are required.
export function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function yesterdayDateKey(
  timestamp: Timestamp,
  timeZone: string,
): string {
  const now = timestamp.toDate();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = part("year");
  const month = part("month"); // 1-based
  const day = part("day");

  // Previous calendar day, computed purely on local date parts so it is
  // correct across DST transitions (a 24-hour subtraction is not).
  let prevYear = year;
  let prevMonth = month;
  let prevDay = day - 1;

  if (prevDay < 1) {
    prevMonth = month === 1 ? 12 : month - 1;
    prevYear = month === 1 ? year - 1 : year;
    prevDay = new Date(prevYear, prevMonth, 0).getDate();
  }

  return `${String(prevYear).padStart(4, "0")}-${String(prevMonth).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;
}

export interface DailyStatsInput {
  user: {
    timeZone?: string | null;
    dailyGoalXp?: number | null;
    dailyXp?: number | null;
    lastActiveDate?: string | null;
    currentStreak?: number | null;
    xpTotal?: number | null;
  } | null;
  now: Timestamp;
  xpAwarded: number;
}

export interface DailyStats {
  dailyXp: number;
  lastActiveDate: string;
  currentStreak: number;
  goalCompleted: boolean;
}

/**
 * Pure decision logic for daily XP and streak.
 *
 * Only XP-earning submissions (xpAwarded > 0) count as activity. Returns null
 * when no daily update is needed (e.g. repeat completion awarding 0 XP).
 */
export function planDailyStats(input: DailyStatsInput): DailyStats | null {
  if (input.xpAwarded <= 0) {
    return null;
  }

  const { user, now: submittedAt } = input;
  const timeZone = user?.timeZone ?? "UTC";
  const today = localDateKey(submittedAt.toDate(), timeZone);
  const yesterday = yesterdayDateKey(submittedAt, timeZone);

  let dailyXp = user?.dailyXp ?? 0;
  let lastActiveDate = user?.lastActiveDate ?? null;
  let currentStreak = user?.currentStreak ?? 0;

  if (lastActiveDate === today) {
    // Same local date: keep streak, accumulate XP.
    dailyXp += input.xpAwarded;
  } else {
    // New local date: reset daily XP, then add today's earnings.
    dailyXp = input.xpAwarded;
    lastActiveDate = today;
    // Consecutive day increments the streak; any other gap (including first
    // day) starts at 1.
    currentStreak = user?.lastActiveDate === yesterday ? currentStreak + 1 : 1;
  }

  const dailyGoalXp = user?.dailyGoalXp ?? 10;
  const goalCompleted = dailyXp >= dailyGoalXp;

  return { dailyXp, lastActiveDate, currentStreak, goalCompleted };
}

// Fetch the English-to-French learning path.
export async function getLearningPath(): Promise<LearningPathRecord | null> {
  const snapshot = await getLearningPathRef().get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...LearningPathSchema.parse(snapshot.data()),
  };
}

// Fetch all units belonging to the learning path.
export async function getUnits(
  pathId: string = LEARNING_PATH_ID,
): Promise<UnitRecord[]> {
  const snapshot = await unitsCol(pathId).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...UnitSchema.parse(doc.data()),
  }));
}

// Fetch all lessons belonging to the learning path.
export async function getLessons(
  pathId: string = LEARNING_PATH_ID,
): Promise<LessonRecord[]> {
  const snapshot = await lessonsCol(pathId).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...LessonMetadataSchema.parse(doc.data()),
  }));
}

// Fetch only the authenticated user's lesson progress.
export async function getUserLessonProgress(
  userId: string,
): Promise<Map<string, LessonProgress>> {
  const snapshot = await lessonProgressCol(userId).get();

  const progress = new Map<string, LessonProgress>();

  for (const doc of snapshot.docs) {
    progress.set(doc.id, LessonProgressSchema.parse(doc.data()));
  }

  return progress;
}

/**
 * Fetch an individual lesson by its document ID.
 */
export async function getLessonById(
  lessonId: string,
  pathId: string = LEARNING_PATH_ID,
): Promise<LessonRecord | null> {
  const snapshot = await lessonDoc(pathId, lessonId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...LessonMetadataSchema.parse(snapshot.data()),
  };
}

/**
 * Fetch all exercises belonging to a lesson.
 * Answer keys are stored separately and are never fetched here.
 */
export async function getExercisesForLesson(
  lessonId: string,
  pathId: string = LEARNING_PATH_ID,
): Promise<ExerciseRecord[]> {
  const snapshot = await exercisesCol(pathId, lessonId).get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...ExerciseSchema.parse(doc.data()),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Fetch a single exercise by its document ID.
 * Answer keys are stored separately and are never fetched here.
 */
export async function getExerciseById(
  lessonId: string,
  exerciseId: string,
  pathId: string = LEARNING_PATH_ID,
): Promise<ExerciseRecord | null> {
  const snapshot = await exerciseDoc(pathId, lessonId, exerciseId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...ExerciseSchema.parse(snapshot.data()),
  };
}

/**
 * Fetch the answer key for a single exercise.
 * The key is read on demand, never as a whole collection.
 */
export async function getAnswerKeyForExercise(
  lessonId: string,
  exerciseId: string,
  pathId: string = LEARNING_PATH_ID,
): Promise<AnswerKey | null> {
  const snapshot = await answerKeyDoc(pathId, lessonId, exerciseId).get();

  if (!snapshot.exists) {
    return null;
  }

  return AnswerKeySchema.parse(snapshot.data());
}

export async function getUserLessonProgressById(
  userId: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const snapshot = await lessonProgressDoc(userId, lessonId).get();

  if (!snapshot.exists) {
    return null;
  }

  return LessonProgressSchema.parse(snapshot.data());
}

// ---------------------------------------------------------------------------
// Lesson attempts
// ---------------------------------------------------------------------------

/**
 * Create an attempt document under the authenticated user.
 * Returns the generated document ID.
 */
export async function createLessonAttempt(
  userId: string,
  attempt: LessonAttempt,
): Promise<string> {
  const attemptId = generateId();

  await lessonAttemptDoc(userId, attemptId).set(attempt);

  return attemptId;
}

/**
 * Find an existing in-progress attempt for a lesson.
 * Returns the attempt if found, null otherwise.
 */
export async function getInProgressLessonAttempt(
  userId: string,
  lessonId: string
): Promise<AttemptRecord | null> {
  const snapshot = await lessonAttemptsCol(userId).get();

  const attempts = snapshot.docs
    .map(
      (doc): AttemptRecord => ({
        id: doc.id,
        ...LessonAttemptSchema.parse(doc.data()),
      })
    )
    .filter(
      (a): a is AttemptRecord => a.lessonId === lessonId && a.status === 'IN_PROGRESS'
    );

  // Return the most recent attempt by startedAt
  return (
    attempts.sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis())[0] ??
    null
  );
}

export interface LessonProgressStartUpdate {
  status: "IN_PROGRESS";
  startedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Decide whether starting an attempt may touch lesson progress.
 * A completed lesson must never be downgraded back to IN_PROGRESS.
 */
export function planProgressStart(
  existing: LessonProgress | null,
  startedAt: Timestamp,
): LessonProgressStartUpdate | null {
  if (existing?.status === "COMPLETED") {
    return null;
  }

  return {
    status: "IN_PROGRESS",
    startedAt: existing?.startedAt ?? startedAt,
    updatedAt: startedAt,
  };
}

export async function markLessonProgressInProgress(
  userId: string,
  lessonId: string,
  startedAt: Timestamp,
): Promise<void> {
  const db = getDb();
  const ref = lessonProgressDoc(userId, lessonId);

  // Read and write inside one transaction so a concurrent completion cannot
  // be overwritten by this stale IN_PROGRESS update.
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    const existing = snapshot.exists
      ? LessonProgressSchema.parse(snapshot.data())
      : null;

    const update = planProgressStart(existing, startedAt);

    if (!update) {
      return;
    }

    transaction.set(ref, update, { merge: true });
  });
}

export interface AnswerPlanInput {
  lessonId: string;
  isCorrect: boolean;
  submittedAnswer: unknown;
  now: Timestamp;
  attempt: LessonAttempt;
  answerExists: boolean;
  progress: LessonProgress | null;
}

export type AnswerPlanFailureReason =
  | "LESSON_MISMATCH"
  | "ATTEMPT_COMPLETED"
  | "DUPLICATE_ANSWER"
  | "NO_HEARTS";

export interface AttemptAnswerUpdate {
  status: "IN_PROGRESS" | "COMPLETED";
  answeredCount: number;
  correctCount: number;
  accuracy: number | null;
  completedAt: Timestamp | null;
  xpAwarded: number;
}

export type AnswerPlan =
  | {
      ok: true;
      answer: {
        submittedAnswer: unknown;
        isCorrect: boolean;
        createdAt: Timestamp;
      };
      attemptUpdate: AttemptAnswerUpdate;
      attemptCompleted: boolean;
      progressUpdate: LessonProgress | null;
      xpAwarded: number;
    }
  | {
      ok: false;
      reason: AnswerPlanFailureReason;
    };

/**
 * Pure decision logic for one answer submission.
 *
 * It receives the already-read attempt, answer existence flag and lesson
 * progress, and returns exactly what the transaction should write. Keeping
 * this separate makes counting, completion and bestAccuracy testable without
 * Firestore.
 */
export function planAnswerSubmission(input: AnswerPlanInput): AnswerPlan {
  const { attempt, answerExists, isCorrect, now: submittedAt } = input;

  if (attempt.lessonId !== input.lessonId) {
    return { ok: false, reason: "LESSON_MISMATCH" };
  }

  if (attempt.status === "COMPLETED") {
    return { ok: false, reason: "ATTEMPT_COMPLETED" };
  }

  if (answerExists) {
    return { ok: false, reason: "DUPLICATE_ANSWER" };
  }

  const answeredCount = attempt.answeredCount + 1;
  const correctCount = attempt.correctCount + (isCorrect ? 1 : 0);
  const attemptCompleted = answeredCount >= attempt.totalExercises;
  const accuracy = attemptCompleted
    ? (correctCount / attempt.totalExercises) * 100
    : null;

  const attemptUpdate: AttemptAnswerUpdate = {
    status: attemptCompleted ? "COMPLETED" : "IN_PROGRESS",
    answeredCount,
    correctCount,
    accuracy,
    completedAt: attemptCompleted ? submittedAt : null,
    xpAwarded: 0,
  };

  let progressUpdate: LessonProgress | null = null;
  let xpAwarded = 0;

  if (attemptCompleted) {
    const finalAccuracy = (correctCount / attempt.totalExercises) * 100;
    const existingBest = input.progress?.bestAccuracy ?? null;

    // Award XP only the first time the lesson is completed. A progress record
    // that is already COMPLETED means this is a repeat completion.
    const alreadyCompleted = input.progress?.status === "COMPLETED";
    xpAwarded = alreadyCompleted ? 0 : XP_PER_COMPLETION;

    progressUpdate = {
      status: "COMPLETED",
      startedAt: input.progress?.startedAt ?? attempt.startedAt,
      completedAt: submittedAt,
      firstCompletedAt: input.progress?.firstCompletedAt ?? submittedAt,
      bestAccuracy:
        existingBest === null
          ? finalAccuracy
          : Math.max(existingBest, finalAccuracy),
      xpAwarded: (input.progress?.xpAwarded ?? 0) + xpAwarded,
      updatedAt: submittedAt,
    };

    attemptUpdate.xpAwarded = xpAwarded;
  }

  return {
    ok: true,
    answer: {
      submittedAnswer: input.submittedAnswer,
      isCorrect,
      createdAt: submittedAt,
    },
    attemptUpdate,
    attemptCompleted,
    progressUpdate,
    xpAwarded,
  };
}

export interface SubmitAnswerTransactionInput {
  userId: string;
  lessonId: string;
  attemptId: string;
  exerciseId: string;
  submittedAnswer: unknown;
  isCorrect: boolean;
}

export type SubmitAnswerTransactionResult =
  | {
      ok: true;
      attempt: AttemptRecord;
      xpAwarded?: number;
      dailyXp?: number;
      goalCompleted?: boolean;
      currentStreak?: number;
      lastActiveDate?: string;
      hearts?: number;
      nextHeartAt?: string | null;
      reviewQueueAction?: ReviewQueueAction;
    }
  | {
      ok: false;
      reason: "ATTEMPT_NOT_FOUND" | AnswerPlanFailureReason;
    };

/**
 * Persist one answer and update the attempt inside a Firestore transaction.
 *
 * The attempt lives under users/{userId}, so another user's attempt ID simply
 * resolves to a missing document instead of being readable.
 */
export async function submitAnswerInTransaction(
  input: SubmitAnswerTransactionInput,
): Promise<SubmitAnswerTransactionResult> {
  const db = getDb();

  const attemptRef = lessonAttemptDoc(input.userId, input.attemptId);
  const answerRef = answerDoc(input.userId, input.attemptId, input.exerciseId);
  const progressRef = lessonProgressDoc(input.userId, input.lessonId);

  return db.runTransaction<SubmitAnswerTransactionResult>(
    async (transaction) => {
      // Use a single clock reading for all timestamps in this transaction.
      const submittedAt = now();

      // ---- reads (all reads happen before any write) ----
      const attemptSnapshot = await transaction.get(attemptRef);

      if (!attemptSnapshot.exists) {
        return { ok: false, reason: "ATTEMPT_NOT_FOUND" };
      }

      const attempt = LessonAttemptSchema.parse(attemptSnapshot.data());

      const answerSnapshot = await transaction.get(answerRef);

      const mayComplete =
        attempt.status === "IN_PROGRESS" &&
        attempt.lessonId === input.lessonId &&
        attempt.answeredCount + 1 >= attempt.totalExercises;

      const progressSnapshot = mayComplete
        ? await transaction.get(progressRef)
        : null;

      const progress = progressSnapshot?.exists
        ? LessonProgressSchema.parse(progressSnapshot.data())
        : null;

      // Read the user doc for XP/daily/heart state.
      const userRef = userDoc(input.userId);
      const userSnapshot = await transaction.get(userRef);
      const userData = userSnapshot.exists
        ? (userSnapshot.data() as Record<string, unknown>)
        : {};

      // Regenerate hearts based on elapsed time (DST-independent epoch millis).
      const heartState = planHeartRegeneration(
        userData,
        submittedAt.toMillis(),
      );

      // Reject submissions when no hearts remain.
      if (heartState.hearts <= 0) {
        return { ok: false, reason: "NO_HEARTS" };
      }

      const plan = planAnswerSubmission({
        lessonId: input.lessonId,
        isCorrect: input.isCorrect,
        submittedAnswer: input.submittedAnswer,
        now: submittedAt,
        attempt,
        answerExists: answerSnapshot.exists,
        progress,
      });

      if (!plan.ok) {
        return { ok: false, reason: plan.reason };
      }

      // Read review queue before any transaction writes.
      const reviewRef = reviewItemDoc(input.userId, input.exerciseId);
      const reviewSnapshot = await transaction.get(reviewRef);

      // ---- writes ----
      transaction.set(answerRef, plan.answer);
      transaction.set(attemptRef, plan.attemptUpdate, { merge: true });

      if (plan.progressUpdate) {
        transaction.set(progressRef, plan.progressUpdate, {
          merge: true,
        });
      }

      let dailyStats: DailyStats | null = null;
      let currentXp = 0;

      // Award global XP and daily stats once, inside the same transaction.
      if (plan.xpAwarded > 0) {
        currentXp = (userData.xpTotal as number | undefined) ?? 0;

        dailyStats = planDailyStats({
          user: {
            timeZone: userData.timeZone as string | undefined,
            dailyGoalXp: userData.dailyGoalXp as number | undefined,
            dailyXp: userData.dailyXp as number | undefined,
            lastActiveDate: userData.lastActiveDate as
              | string
              | null
              | undefined,
            currentStreak: userData.currentStreak as number | undefined,
            xpTotal: currentXp,
          },
          now: submittedAt,
          xpAwarded: plan.xpAwarded,
        });
      }

      // Heart consumption: only accepted incorrect answers consume a heart.
      let finalHearts = heartState.hearts;
      let finalNextHeartAtMillis = heartState.nextHeartAtMillis;
      let needsHeartWrite = false;

      if (!input.isCorrect) {
        finalHearts -= 1;
        needsHeartWrite = true;
        // If we dropped from max hearts, schedule the first regeneration.
        if (heartState.nextHeartAtMillis === null) {
          finalNextHeartAtMillis =
            submittedAt.toMillis() + HEART_REGEN_INTERVAL_MS;
        }
      }

      // Persist regenerated heart state even when the answer is correct.
      const storedHearts =
        (userData.hearts as number | undefined) ?? MAX_HEARTS;
      const storedNextHeartAtMillis =
        (userData.nextHeartAt as Timestamp | null | undefined)?.toMillis() ??
        null;
      const nextHeartAtEqual =
        (finalNextHeartAtMillis === null && storedNextHeartAtMillis === null) ||
        finalNextHeartAtMillis === storedNextHeartAtMillis;
      if (finalHearts !== storedHearts || !nextHeartAtEqual) {
        needsHeartWrite = true;
      }

      if (plan.xpAwarded > 0 || needsHeartWrite) {
        transaction.set(
          userRef,
          {
            ...(plan.xpAwarded > 0
              ? { xpTotal: currentXp + plan.xpAwarded }
              : {}),
            ...(dailyStats
              ? {
                  dailyXp: dailyStats.dailyXp,
                  lastActiveDate: dailyStats.lastActiveDate,
                  currentStreak: dailyStats.currentStreak,
                }
              : {}),
            hearts: finalHearts,
            nextHeartAt:
              finalNextHeartAtMillis !== null
                ? Timestamp.fromMillis(finalNextHeartAtMillis)
                : null,
            updatedAt: submittedAt,
          },
          { merge: true },
        );
      }

      // Review queue: incorrect answers add/update an entry; correct answers
      // remove the exercise from the queue. All inside the same transaction.

      // Review queue: incorrect answers add/update; correct answers remove.
      let reviewQueueAction: ReviewQueueAction | undefined;

      if (!input.isCorrect) {
        const existing = reviewSnapshot.exists
          ? ReviewItemSchema.parse(reviewSnapshot.data())
          : null;

        reviewQueueAction = planReviewQueueAction(
          existing,
          false,
          input.lessonId,
          input.exerciseId,
          submittedAt,
        );

        if (reviewQueueAction.type === "SET" && reviewQueueAction.entry) {
          transaction.set(reviewRef, reviewQueueAction.entry, { merge: true });
        }
      } else {
        if (reviewSnapshot.exists) {
          reviewQueueAction = planReviewQueueAction(
            ReviewItemSchema.parse(reviewSnapshot.data()),
            true,
            input.lessonId,
            input.exerciseId,
            submittedAt,
          );

          transaction.delete(reviewRef);
        } else {
          reviewQueueAction = { type: "NONE" };
        }
      }

      return {
        ok: true,
        attempt: {
          id: attemptRef.id,
          ...attempt,
          ...plan.attemptUpdate,
        },
        xpAwarded: plan.xpAwarded,
        ...(dailyStats
          ? {
              dailyXp: dailyStats.dailyXp,
              goalCompleted: dailyStats.goalCompleted,
              currentStreak: dailyStats.currentStreak,
              lastActiveDate: dailyStats.lastActiveDate,
            }
          : {}),
        hearts: finalHearts,
        nextHeartAt:
          finalNextHeartAtMillis !== null
            ? new Date(finalNextHeartAtMillis).toISOString()
            : null,
        ...(reviewQueueAction ? { reviewQueueAction } : {}),
      };
    },
  );
}

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("deleteReviewQueueEntry", () => {
  const testUserId = "test-user-delete";
  const testExerciseId = "ex-delete-1";
  const testLessonId = "lesson-delete-1";

  beforeEach(async () => {
    const db = getDb();
    await reviewItemDoc(testUserId, testExerciseId).set({
      lessonId: testLessonId,
      status: "PENDING",
      wrongCount: 2,
      lastWrongAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  afterEach(async () => {
    const db = getDb();
    await reviewItemDoc(testUserId, testExerciseId).delete().catch(() => {});
  });

  it("deletes the review queue entry for the given user and exercise", async () => {
    const { deleteReviewQueueEntry } = await import("./learning.repository.js");
    
    await deleteReviewQueueEntry(testUserId, testExerciseId);

    const snapshot = await reviewItemDoc(testUserId, testExerciseId).get();
    expect(snapshot.exists).toBe(false);
  });

  it("does not affect other users review entries", async () => {
    const otherUserId = "other-user";
    const db = getDb();
    
    await reviewItemDoc(otherUserId, testExerciseId).set({
      lessonId: testLessonId,
      status: "PENDING",
      wrongCount: 1,
      lastWrongAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const { deleteReviewQueueEntry } = await import("./learning.repository.js");
    
    await deleteReviewQueueEntry(testUserId, testExerciseId);

    const testUserSnapshot = await reviewItemDoc(testUserId, testExerciseId).get();
    const otherUserSnapshot = await reviewItemDoc(otherUserId, testExerciseId).get();

    expect(testUserSnapshot.exists).toBe(false);
    expect(otherUserSnapshot.exists).toBe(true);

    await reviewItemDoc(otherUserId, testExerciseId).delete();
  });

  it("does not affect other exercises for the same user", async () => {
    const otherExerciseId = "ex-delete-2";
    const db = getDb();
    
    await reviewItemDoc(testUserId, otherExerciseId).set({
      lessonId: testLessonId,
      status: "PENDING",
      wrongCount: 1,
      lastWrongAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const { deleteReviewQueueEntry } = await import("./learning.repository.js");
    
    await deleteReviewQueueEntry(testUserId, testExerciseId);

    const targetSnapshot = await reviewItemDoc(testUserId, testExerciseId).get();
    const otherSnapshot = await reviewItemDoc(testUserId, otherExerciseId).get();

    expect(targetSnapshot.exists).toBe(false);
    expect(otherSnapshot.exists).toBe(true);

    await reviewItemDoc(testUserId, otherExerciseId).delete();
  });
});

describe("POST /api/me/review-queue/:exerciseId/understood", () => {
  const testUserId = "test-user-understood";
  const testExerciseId = "ex-understood-1";
  const testLessonId = "lesson-understood-1";

  beforeEach(async () => {
    const db = getDb();
    await reviewItemDoc(testUserId, testExerciseId).set({
      lessonId: testLessonId,
      status: "PENDING",
      wrongCount: 2,
      lastWrongAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  afterEach(async () => {
    const db = getDb();
    await reviewItemDoc(testUserId, testExerciseId).delete().catch(() => {});
  });

  it("deletes only the current user exercise entry on success", async () => {
    const { deleteReviewQueueEntryForUser } = await import("./learning.service.js");
    
    await deleteReviewQueueEntryForUser(testUserId, testExerciseId);

    const snapshot = await reviewItemDoc(testUserId, testExerciseId).get();
    expect(snapshot.exists).toBe(false);
  });

  it("does not mark exercise as completed or award XP", async () => {
    const { deleteReviewQueueEntryForUser } = await import("./learning.service.js");
    
    await deleteReviewQueueEntryForUser(testUserId, testExerciseId);

    const userSnapshot = await userDoc(testUserId).get();
    if (userSnapshot.exists) {
      const userData = userSnapshot.data() ?? {};
      expect(userData.xpTotal).toBeUndefined();
    }
  });
});
