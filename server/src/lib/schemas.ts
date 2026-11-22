import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

export const ExerciseTypeSchema = z.enum(['MULTIPLE_CHOICE', 'FILL_BLANK', 'WORD_BANK']);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export const LessonStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const AttemptStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED']);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

export const ReviewStatusSchema = z.enum(['PENDING', 'RESOLVED']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const RoleSchema = z.enum(['LEARNER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const DailyGoalSchema = z.enum(['10', '20', '30', '50']);
export type DailyGoal = z.infer<typeof DailyGoalSchema>;

export const OptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type Option = z.infer<typeof OptionSchema>;

export const WordBankTokenSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type WordBankToken = z.infer<typeof WordBankTokenSchema>;

export const ExerciseContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    options: z.array(OptionSchema).min(2),
  }),
  z.object({
    type: z.literal('FILL_BLANK'),
    hint: z.string().optional(),
  }),
  z.object({
    type: z.literal('WORD_BANK'),
    wordBank: z.array(WordBankTokenSchema).min(1),
  }),
]);
export type ExerciseContent = z.infer<typeof ExerciseContentSchema>;

export const ExerciseSchema = z.object({
  order: z.number().int().nonnegative(),
  type: ExerciseTypeSchema,
  prompt: z.string().min(1),
  content: ExerciseContentSchema,
  explanation: z.string().optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const AnswerKeySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    correctOptionId: z.string(),
  }),
  z.object({
    type: z.literal('FILL_BLANK'),
    acceptedAnswers: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('WORD_BANK'),
    correctTokenIds: z.array(z.string()).min(1),
  }),
]);
export type AnswerKey = z.infer<typeof AnswerKeySchema>;

export const LessonMetadataSchema = z.object({
  unitId: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  previousLessonId: z.string().nullable(),
  estimatedMinutes: z.number().int().positive(),
  exerciseCount: z.number().int().positive(),
});
export type LessonMetadata = z.infer<typeof LessonMetadataSchema>;

export const UnitSchema = z.object({
  title: z.string(),
  description: z.string(),
  order: z.number().int().nonnegative(),
});
export type Unit = z.infer<typeof UnitSchema>;

export const LearningPathSchema = z.object({
  sourceLanguage: z.string().length(2),
  targetLanguage: z.string().length(2),
  title: z.string(),
  description: z.string(),
});
export type LearningPath = z.infer<typeof LearningPathSchema>;

export const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  passwordHash: z.string(),
  role: RoleSchema.default('LEARNER'),
  targetLanguage: z.string().length(2).default('fr'),
  dailyGoalXp: z.number().int().positive().default(10),
  timeZone: z.string().min(1),
  xpTotal: z.number().int().nonnegative().default(0),
  dailyXp: z.number().int().nonnegative().default(0),
  lastActiveDate: z.string().nullable().optional(),
  currentStreak: z.number().int().nonnegative().default(0),
  hearts: z.number().int().min(0).max(5).default(5),
  nextHeartAt: z.custom<Timestamp>().nullable().optional(),
  onboardingCompletedAt: z.custom<Timestamp>().nullable().optional(),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
});
export type User = z.infer<typeof UserSchema>;

export const RefreshSessionSchema = z.object({
  tokenHash: z.string(),
  expiresAt: z.custom<Timestamp>(),
  revokedAt: z.custom<Timestamp>().nullable().optional(),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
});
export type RefreshSession = z.infer<typeof RefreshSessionSchema>;

export const LessonProgressSchema = z.object({
  status: LessonStatusSchema.default('IN_PROGRESS'),
  startedAt: z.custom<Timestamp>().nullable().optional(),
  completedAt: z.custom<Timestamp>().nullable().optional(),
  firstCompletedAt: z.custom<Timestamp>().nullable().optional(),
  bestAccuracy: z.number().min(0).max(100).nullable().optional(),
  xpAwarded: z.number().int().nonnegative().default(0),
  updatedAt: z.custom<Timestamp>(),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const LessonAttemptSchema = z.object({
  lessonId: z.string(),
  status: AttemptStatusSchema.default('IN_PROGRESS'),
  correctCount: z.number().int().nonnegative().default(0),
  answeredCount: z.number().int().nonnegative().default(0),
  totalExercises: z.number().int().positive(),
  accuracy: z.number().min(0).max(100).nullable().optional(),
  xpAwarded: z.number().int().nonnegative().default(0),
  startedAt: z.custom<Timestamp>(),
  completedAt: z.custom<Timestamp>().nullable().optional(),
});
export type LessonAttempt = z.infer<typeof LessonAttemptSchema>;

export const AnswerSchema = z.object({
  submittedAnswer: z.unknown(),
  isCorrect: z.boolean(),
  createdAt: z.custom<Timestamp>(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const ReviewItemSchema = z.object({
  lessonId: z.string(),
  status: ReviewStatusSchema.default('PENDING'),
  wrongCount: z.number().int().nonnegative().default(0),
  lastWrongAt: z.custom<Timestamp>(),
  resolvedAt: z.custom<Timestamp>().nullable().optional(),
  lastSubmittedAnswer: z.string().optional(),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const ReviewAttemptSchema = z.object({
  submittedAnswer: z.unknown(),
  isCorrect: z.boolean(),
  createdAt: z.custom<Timestamp>(),
});
export type ReviewAttempt = z.infer<typeof ReviewAttemptSchema>;

export const DailyActivitySchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  xpEarned: z.number().int().nonnegative().default(0),
  lessonsCompleted: z.number().int().nonnegative().default(0),
  reviewItemsResolved: z.number().int().nonnegative().default(0),
  updatedAt: z.custom<Timestamp>(),
});
export type DailyActivity = z.infer<typeof DailyActivitySchema>;

export const RegisterInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const OnboardingInputSchema = z.object({
  targetLanguage: z.string().length(2).default('fr'),
  dailyGoalXp: z.number().int().positive().refine((v) => [10, 20, 30, 50].includes(v)),
  timeZone: z.string().min(1),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const AnswerInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    answer: z.object({ optionId: z.string() }),
  }),
  z.object({
    type: z.literal('FILL_BLANK'),
    answer: z.object({ text: z.string() }),
  }),
  z.object({
    type: z.literal('WORD_BANK'),
    answer: z.object({ tokenIds: z.array(z.string()).min(1) }),
  }),
]);
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

export const StartLessonInputSchema = z.object({
  attemptId: z.string().optional(),
});
export type StartLessonInput = z.infer<typeof StartLessonInputSchema>;

export const AIChatInputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .max(10)
    .optional(),
});
export type AIChatInput = z.infer<typeof AIChatInputSchema>;