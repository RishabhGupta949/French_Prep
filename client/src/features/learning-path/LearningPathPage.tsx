import { Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuthStore } from "../../features/auth/authStore";

export type LessonStatus = "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";

export interface LearningPathLesson {
  id: string;
  unitId: string;
  title: string;
  description: string;
  order: number;
  sequence: number;
  previousLessonId: string | null;
  estimatedMinutes: number;
  exerciseCount: number;
  status: LessonStatus;
}

export interface LearningPathUnit {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: LearningPathLesson[];
}

export interface LearningPathData {
  learningPath: {
    id: string;
    title: string;
    description: string;
    sourceLanguage: string;
    targetLanguage: string;
  };
  units: LearningPathUnit[];
  progress: {
    completedLessons: number;
    totalLessons: number;
  };
}

export interface ReviewQueueEntry {
  exerciseId: string;
  lessonId: string;
  status: "PENDING" | "RESOLVED";
  wrongCount: number;
  lastWrongAt: string;
  firstQueuedAt: string;
  updatedAt: string;
  lastSubmittedAnswer: string | null;
}

export interface ReviewExplanationState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  explanation: string | null;
  exerciseId: string | null;
  lessonId: string | null;
}

export interface ReviewQueueResponse {
  reviewQueue: ReviewQueueEntry[];
}

export function fetchReviewQueue(): Promise<ReviewQueueResponse> {
  return api.get<ReviewQueueResponse>("/me/review-queue");
}

const STATUS_LABELS: Record<LessonStatus, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  UNLOCKED: "Unlocked",
  LOCKED: "Locked",
};

export function fetchLearningPath(): Promise<LearningPathData> {
  return api.get<LearningPathData>("/learning-path");
}

export function LearningPathError({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div
      role="alert"
      className="bg-white rounded-xl border border-red-200 p-6 text-center space-y-4"
    >
      <p className="text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
      >
        {isRetrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

function LessonBadge({
  status,
  number,
}: {
  status: LessonStatus;
  number: number;
}) {
  const badgeClasses =
    status === "COMPLETED"
      ? "bg-success-100 text-success-600"
      : status === "LOCKED"
        ? "bg-slate-100 text-slate-400"
        : "bg-primary-100 text-primary-600";

  return (
    <div
      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-medium ${badgeClasses}`}
    >
      {status === "COMPLETED" ? "✓" : number}
    </div>
  );
}

function LessonRow({
  lesson,
  number,
}: {
  lesson: LearningPathLesson;
  number: number;
}) {
  const statusLabel = STATUS_LABELS[lesson.status];
  const meta = `${statusLabel} • ${lesson.exerciseCount} exercises • ~${lesson.estimatedMinutes} min`;

  if (lesson.status === "LOCKED") {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
      >
        <LessonBadge status={lesson.status} number={number} />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-slate-500">
            Lesson {number}: {lesson.title}
          </p>
          <p className="text-sm text-slate-500">{meta}</p>
        </div>
        <span aria-hidden="true" className="text-slate-400">
          🔒
        </span>
      </div>
    );
  }

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
    >
      <LessonBadge status={lesson.status} number={number} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-slate-900">
          Lesson {number}: {lesson.title}
        </p>
        <p className="text-sm text-slate-500">{meta}</p>
      </div>
    </Link>
  );
}

function GamificationStats({
  xpTotal,
  dailyXp,
  dailyGoalXp,
  currentStreak,
}: {
  xpTotal: number | null;
  dailyXp: number | null;
  dailyGoalXp: number | null;
  currentStreak: number | null;
}) {
  const dailyProgress =
    dailyXp !== null && dailyGoalXp !== null && dailyGoalXp > 0
      ? Math.min(100, Math.round((dailyXp / dailyGoalXp) * 100))
      : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        <span aria-hidden="true">⚡</span>
        Gamification
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-500 mb-1">Global XP</p>
          <p className="text-2xl font-bold text-slate-900">{xpTotal ?? "--"}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-500 mb-1">Current Streak</p>
          <p className="text-2xl font-bold text-slate-900">
            {currentStreak ?? "--"}
          </p>
          <p className="text-xs text-slate-500">days</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-500">Daily XP</span>
          <span className="font-medium text-slate-900">{dailyXp ?? "--"}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          {dailyProgress !== null ? (
            <div
              className="bg-primary-600 h-2 rounded-full"
              style={{ width: `${dailyProgress}%` }}
            />
          ) : (
            <div className="bg-slate-200 h-2 rounded-full" />
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>0 / {dailyGoalXp ?? "--"}</span>
          <span>Goal: {dailyGoalXp ?? "--"} XP</span>
        </div>
      </div>
    </div>
  );
}

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletItems: React.ReactNode[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        const bulletText = lines[i].trim().slice(2);
        bulletItems.push(
          <li key={i} className="ml-4 mb-1">
            {parseInlineMarkdown(bulletText)}
          </li>,
        );
        i++;
      }
      i--;
      elements.push(
        <ul key={`ul-${i}`} className="list-disc mb-2">
          {bulletItems}
        </ul>,
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="mb-2">
          {parseInlineMarkdown(trimmed)}
        </p>,
      );
    }
  }

  return <div>{elements}</div>;
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

interface ReviewQueueListProps {
  queue: ReviewQueueEntry[];
  explanationState: ReviewExplanationState;
  setExplanationState: React.Dispatch<
    React.SetStateAction<ReviewExplanationState>
  >;
  onUnderstood: (exerciseId: string) => void;
}

function ReviewQueueList({
  queue,
  explanationState,
  setExplanationState,
  onUnderstood,
}: ReviewQueueListProps) {
  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <div className="text-4xl mb-2">📝</div>
        <h3 className="font-medium text-slate-900 mb-1">Review Queue</h3>
        <p className="text-sm text-slate-500">No exercises to review yet.</p>
      </div>
    );
  }

  const handleExplainClick = (entry: ReviewQueueEntry) => {
    setExplanationState({
      isOpen: true,
      isLoading: true,
      error: null,
      explanation: null,
      exerciseId: entry.exerciseId,
      lessonId: entry.lessonId,
    });

    api
      .post<{ explanation: string }>("/ai/review-explanation", {
        exerciseId: entry.exerciseId,
      })
      .then((res) => {
        setExplanationState((prev) => ({
          ...prev,
          isLoading: false,
          explanation: res.explanation ?? null,
        }));
      })
      .catch((err) => {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to get AI explanation";
        setExplanationState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      });
  };

  const handleRetry = () => {
    if (!explanationState.exerciseId) return;
    setExplanationState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
    api
      .post<{ explanation: string }>("/ai/review-explanation", {
        exerciseId: explanationState.exerciseId,
      })
      .then((res) => {
        setExplanationState((prev) => ({
          ...prev,
          isLoading: false,
          explanation: res.explanation ?? null,
        }));
      })
      .catch((err) => {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to get AI explanation";
        setExplanationState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      });
  };

  const handleClose = () => {
    setExplanationState({
      isOpen: false,
      isLoading: false,
      error: null,
      explanation: null,
      exerciseId: null,
      lessonId: null,
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-slate-900">Review Queue</h3>
          <p className="text-sm text-slate-500">{queue.length} exercise(s)</p>
        </div>

        {queue.map((entry) => (
          <div
            key={entry.exerciseId}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-primary-50 transition-colors"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-600 font-medium text-sm">
              {entry.wrongCount}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">
                Exercise {entry.exerciseId}
              </p>
              <p className="text-xs text-slate-500">
                Lesson {entry.lessonId} •{" "}
                {entry.status === "PENDING" ? "Pending" : "Resolved"}
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {entry.wrongCount} attempt(s)
            </span>
            <button
              type="button"
              onClick={() => handleExplainClick(entry)}
              disabled={
                explanationState.isOpen &&
                explanationState.exerciseId === entry.exerciseId
              }
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Explain my mistake
            </button>
          </div>
        ))}
      </div>

      {explanationState.isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explanation-title"
        >
          <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex-shrink-0 flex items-start justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 border-b border-slate-200 bg-white">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="hidden sm:flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                    <svg
                      width="23"
                      height="23"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 18h.01" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h2
                      id="explanation-title"
                      className="text-xl sm:text-2xl font-bold text-slate-900"
                    >
                      Mistake Explanation
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Understand your mistake and learn the correct concept.
                    </p>

                    {explanationState.exerciseId && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Exercise: {explanationState.exerciseId}
                        </span>

                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Lesson: {explanationState.lessonId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Close explanation"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
                {explanationState.isLoading && (
                  <div className="min-h-[280px] flex flex-col items-center justify-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />

                    <div className="text-center">
                      <p className="font-semibold text-slate-800">
                        Analysing your mistake...
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Your AI coach is preparing an explanation.
                      </p>
                    </div>
                  </div>
                )}

                {!explanationState.isLoading && explanationState.error && (
                  <div className="min-h-[250px] flex items-center justify-center">
                    <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 9v4m0 4h.01" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      </div>

                      <div>
                        <h3 className="font-semibold text-red-800">
                          Unable to generate explanation
                        </h3>
                        <p className="mt-2 text-sm text-red-700">
                          {explanationState.error}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {!explanationState.isLoading &&
                  !explanationState.error &&
                  explanationState.explanation && (
                    <div className="w-full space-y-5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary-600" />
                        <h3 className="text-base font-semibold text-slate-800">
                          Why you missed this
                        </h3>
                      </div>

                      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
                        <div className="prose prose-slate prose-sm sm:prose-base max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:leading-7 prose-li:leading-7 prose-pre:overflow-x-auto prose-pre:max-w-full">
                          <MarkdownRenderer
                            text={explanationState.explanation}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                {!explanationState.isLoading &&
                  !explanationState.error &&
                  !explanationState.explanation && (
                    <div className="min-h-[220px] flex items-center justify-center">
                      <p className="text-sm text-slate-500">
                        No explanation is available for this exercise.
                      </p>
                    </div>
                  )}
              </div>

              {/* Fixed Footer */}
              {!explanationState.isLoading &&
                !explanationState.error &&
                explanationState.explanation && (
                  <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8 sm:py-5">
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-xs sm:text-sm text-slate-500">
                        Take a moment to understand the explanation before
                        continuing.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          onUnderstood(explanationState.exerciseId!)
                        }
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                        I have understood
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LearningPathPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["learning-path"],
    queryFn: fetchLearningPath,
  });
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
    enabled: Boolean(user),
  });

  const xpTotal = user?.xpTotal ?? null;
  const dailyGoalXp = user?.dailyGoalXp ?? null;
  const dailyXp = user?.dailyXp ?? null;
  const currentStreak = user?.streak ?? null;
  const reviewQueue = queueData?.reviewQueue ?? [];

  const [explanationState, setExplanationState] =
    useState<ReviewExplanationState>({
      isOpen: false,
      isLoading: false,
      error: null,
      explanation: null,
      exerciseId: null,
      lessonId: null,
    });

  const understoodMutation = useMutation({
    mutationFn: async (_exerciseId: string) => {
      await api.post(`/me/review-queue/${_exerciseId}/understood`, {});
    },
    onSuccess: (_data, _exerciseId) => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      setExplanationState({
        isOpen: false,
        isLoading: false,
        error: null,
        explanation: null,
        exerciseId: null,
        lessonId: null,
      });
    },
    onError: (err: unknown) => {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to remove review entry";
      setExplanationState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    },
  });

  const handleUnderstood = (exerciseId: string) => {
    understoodMutation.mutate(exerciseId);
  };

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Learning Path</h1>
      <p className="mt-1 text-slate-600">
        Progress through units and lessons to learn French
      </p>
    </div>
  );

  if (isLoading || queueLoading) {
    return (
      <div className="space-y-8">
        {header}
        <p
          role="status"
          className="bg-white rounded-xl border border-slate-200 p-6 text-slate-600"
        >
          Loading your learning path…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8">
        {header}
        <LearningPathError
          message={
            error instanceof Error
              ? error.message
              : "Failed to load your learning path"
          }
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8">
        {header}
        <p className="text-slate-600">No learning path is available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning Path</h1>
        <p className="mt-1 text-slate-600">
          {data.learningPath.title}: {data.learningPath.description}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {data.progress.completedLessons} of {data.progress.totalLessons}{" "}
          lessons completed
        </p>
      </div>

      <GamificationStats
        xpTotal={xpTotal}
        dailyXp={dailyXp}
        dailyGoalXp={dailyGoalXp}
        currentStreak={currentStreak}
      />

      <ReviewQueueList
        queue={reviewQueue}
        explanationState={explanationState}
        setExplanationState={setExplanationState}
        onUnderstood={handleUnderstood}
      />

      {data.units.map((unit) => (
        <section
          key={unit.id}
          className="bg-white rounded-xl border border-slate-200 p-6"
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {unit.title}
            </h2>
            <p className="text-sm text-slate-500">{unit.description}</p>
          </div>
          <div className="space-y-3">
            {unit.lessons.map((lesson, index) => (
              <LessonRow key={lesson.id} lesson={lesson} number={index + 1} />
            ))}
          </div>
        </section>
      ))}

      {data.units.length === 0 && (
        <p className="text-slate-600">No lessons are available yet.</p>
      )}
    </div>
  );
}
