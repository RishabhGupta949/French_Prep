import { useReducer } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuthStore } from "../../features/auth/authStore";

// ---------------------------------------------------------------------------
// Types mirroring the backend lesson + answer contracts
// ---------------------------------------------------------------------------

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface WordBankToken {
  id: string;
  text: string;
}

export type LessonExercise =
  | {
      id: string;
      order: number;
      type: "MULTIPLE_CHOICE";
      prompt: string;
      content: {
        type: "MULTIPLE_CHOICE";
        options: ExerciseOption[];
      };
    }
  | {
      id: string;
      order: number;
      type: "FILL_BLANK";
      prompt: string;
      content: {
        type: "FILL_BLANK";
        hint?: string;
      };
    }
  | {
      id: string;
      order: number;
      type: "WORD_BANK";
      prompt: string;
      content: {
        type: "WORD_BANK";
        wordBank: WordBankToken[];
      };
    };

export interface LessonContentResponse {
  lesson: {
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    exerciseCount: number;
  };
  exercises: LessonExercise[];
}

export interface StartAttemptResponse {
  attemptId: string;
  lessonId: string;
  status: string;
  totalExercises: number;
  answeredCount: number;
}

export type AnswerInput =
  | { type: "MULTIPLE_CHOICE"; answer: { optionId: string } }
  | { type: "FILL_BLANK"; answer: { text: string } }
  | { type: "WORD_BANK"; answer: { tokenIds: string[] } };

// ---------------------------------------------------------------------------
// Attempt and answer response types
// ---------------------------------------------------------------------------

export interface AttemptSummary {
  attemptId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  answeredCount: number;
  correctCount: number;
  totalExercises: number;
  accuracy: number | null;

  // Gamification fields returned inside the attempt object.
  xpAwarded?: number;
  dailyXp?: number;
  goalCompleted?: boolean;
  currentStreak?: number;
  lastActiveDate?: string;
  hearts?: number;
  nextHeartAt?: string | null;
}

export interface LessonResultsSummary {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export function computeResultsSummary(
  answers: boolean[],
  totalExercises: number,
): LessonResultsSummary {
  const correct = answers.filter((isCorrect) => isCorrect).length;
  const total = totalExercises > 0 ? totalExercises : answers.length;
  const incorrect = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return { total, correct, incorrect, accuracy };
}

export interface AnswerFeedback {
  exerciseId: string;
  isCorrect: boolean;
  explanation: string;
  attempt: AttemptSummary;
}

export interface HeartState {
  hearts: number;
  nextHeartAt: string | null;
}

export function fetchUserHearts(): Promise<HeartState> {
  return api.get<HeartState>("/me/hearts");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export function fetchLessonContent(
  lessonId: string,
): Promise<LessonContentResponse> {
  return api.get<LessonContentResponse>(`/lessons/${lessonId}`);
}

export function startLessonAttempt(
  lessonId: string,
): Promise<StartAttemptResponse> {
  return api.post<StartAttemptResponse>(`/lessons/${lessonId}/attempts`, {});
}

export function submitLessonAnswer(
  lessonId: string,
  attemptId: string,
  exerciseId: string,
  input: AnswerInput,
): Promise<AnswerFeedback> {
  return api.post<AnswerFeedback>(
    `/lessons/${lessonId}/attempts/${attemptId}/exercises/${exerciseId}/answer`,
    input,
  );
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

export interface AnswerSelection {
  optionId: string | null;
  text: string;
  tokenIds: string[];
}

export interface LessonPlayerState {
  attemptId: string | null;
  isStarting: boolean;
  startError: string | null;
  currentIndex: number;
  isSubmitting: boolean;
  submitError: string | null;
  feedback: AnswerFeedback | null;
  isCompleted: boolean;
  selection: AnswerSelection;
  answers: boolean[];
  hearts: number | null;
  nextHeartAt: string | null;
  noHearts: boolean;
}

export type LessonPlayerAction =
  | { type: "START_REQUEST" }
  | { type: "START_SUCCESS"; attemptId: string }
  | { type: "START_FAILURE"; message: string }
  | { type: "SELECT_OPTION"; optionId: string }
  | { type: "SET_TEXT"; text: string }
  | { type: "TOGGLE_TOKEN"; tokenId: string }
  | { type: "SUBMIT_REQUEST" }
  | { type: "SUBMIT_SUCCESS"; feedback: AnswerFeedback }
  | { type: "SUBMIT_FAILURE"; message: string }
  | { type: "NO_HEARTS" }
  | { type: "UPDATE_HEARTS"; hearts: number; nextHeartAt: string | null }
  | { type: "NEXT" };

function emptySelection(): AnswerSelection {
  return {
    optionId: null,
    text: "",
    tokenIds: [],
  };
}

export const initialLessonPlayerState: LessonPlayerState = {
  attemptId: null,
  isStarting: false,
  startError: null,
  currentIndex: 0,
  isSubmitting: false,
  submitError: null,
  feedback: null,
  isCompleted: false,
  selection: emptySelection(),
  answers: [],
  hearts: null,
  nextHeartAt: null,
  noHearts: false,
};

// ---------------------------------------------------------------------------
// Player reducer
// ---------------------------------------------------------------------------

export function lessonPlayerReducer(
  state: LessonPlayerState,
  action: LessonPlayerAction,
): LessonPlayerState {
  switch (action.type) {
    case "START_REQUEST":
      // Ignore another start while one is pending or already started.
      if (state.attemptId || state.isStarting) {
        return state;
      }

      return {
        ...state,
        isStarting: true,
        startError: null,
      };

    case "START_SUCCESS":
      // Never replace an attempt that already exists.
      if (state.attemptId) {
        return state;
      }

      return {
        ...state,
        isStarting: false,
        attemptId: action.attemptId,
        startError: null,
      };

    case "START_FAILURE":
      return {
        ...state,
        isStarting: false,
        startError: action.message,
      };

    case "SELECT_OPTION":
      return {
        ...state,
        selection: {
          ...state.selection,
          optionId: action.optionId,
        },
      };

    case "SET_TEXT":
      return {
        ...state,
        selection: {
          ...state.selection,
          text: action.text,
        },
      };

    case "TOGGLE_TOKEN": {
      const isSelected = state.selection.tokenIds.includes(action.tokenId);

      const tokenIds = isSelected
        ? state.selection.tokenIds.filter(
            (tokenId) => tokenId !== action.tokenId,
          )
        : [...state.selection.tokenIds, action.tokenId];

      return {
        ...state,
        selection: {
          ...state.selection,
          tokenIds,
        },
      };
    }

    case "SUBMIT_REQUEST":
      // Ignore duplicate submissions.
      if (state.isSubmitting || state.feedback || state.isCompleted) {
        return state;
      }

      // Prevent submissions when no hearts remain.
      if (state.noHearts) {
        return state;
      }

      return {
        ...state,
        isSubmitting: true,
        submitError: null,
      };

    case "SUBMIT_SUCCESS":
      // Ignore a response that does not belong to a pending submission.
      if (!state.isSubmitting) {
        return state;
      }

      return {
        ...state,
        isSubmitting: false,
        answers: [...state.answers, action.feedback.isCorrect],
        feedback: action.feedback,

        // Backend returns these values inside feedback.attempt.
        hearts: action.feedback.attempt.hearts ?? state.hearts ?? null,
        nextHeartAt:
          action.feedback.attempt.nextHeartAt ?? state.nextHeartAt ?? null,

        isCompleted: action.feedback.attempt.status === "COMPLETED",
      };

    case "SUBMIT_FAILURE":
      return {
        ...state,
        isSubmitting: false,
        submitError: action.message,
      };

    case "NO_HEARTS":
      return {
        ...state,
        noHearts: true,
        submitError:
          "No hearts remaining. Wait for a heart to regenerate before answering again.",
      };

    case "UPDATE_HEARTS":
      return {
        ...state,
        hearts: action.hearts,
        nextHeartAt: action.nextHeartAt,
        noHearts: action.hearts <= 0,
      };

    case "NEXT":
      if (!state.feedback || state.isCompleted) {
        return state;
      }

      return {
        ...state,
        currentIndex: state.currentIndex + 1,
        feedback: null,
        submitError: null,
        selection: emptySelection(),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Answer input builder
// ---------------------------------------------------------------------------

export function buildAnswerInput(
  exercise: LessonExercise,
  selection: AnswerSelection,
): AnswerInput | null {
  switch (exercise.type) {
    case "MULTIPLE_CHOICE":
      return selection.optionId
        ? {
            type: "MULTIPLE_CHOICE",
            answer: {
              optionId: selection.optionId,
            },
          }
        : null;

    case "FILL_BLANK": {
      const text = selection.text.trim();

      return text
        ? {
            type: "FILL_BLANK",
            answer: { text },
          }
        : null;
    }

    case "WORD_BANK":
      return selection.tokenIds.length > 0
        ? {
            type: "WORD_BANK",
            answer: {
              tokenIds: [...selection.tokenIds],
            },
          }
        : null;

    default:
      return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}

// ---------------------------------------------------------------------------
// Presentational components
// ---------------------------------------------------------------------------

export function LessonErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
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
        className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

export function LessonExerciseView({
  exercise,
  selection,
  disabled,
  canSubmit,
  onSubmit,
  onSelectOption,
  onChangeText,
  onToggleToken,
}: {
  exercise: LessonExercise;
  selection: AnswerSelection;
  disabled: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onSelectOption: (optionId: string) => void;
  onChangeText: (text: string) => void;
  onToggleToken: (tokenId: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {exercise.prompt}
      </h2>

      {exercise.type === "MULTIPLE_CHOICE" && (
        <div className="space-y-3">
          {exercise.content.options.map((option) => {
            const selected = selection.optionId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onSelectOption(option.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selected
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 hover:border-primary-300"
                }`}
              >
                {option.text}
              </button>
            );
          })}
        </div>
      )}

      {exercise.type === "FILL_BLANK" && (
        <div className="space-y-2">
          <input
            type="text"
            value={selection.text}
            disabled={disabled}
            onChange={(event) => onChangeText(event.target.value)}
            placeholder="Type your answer in French"
            aria-label="Your answer"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {exercise.content.hint && (
            <p className="text-sm text-slate-500">
              Hint: {exercise.content.hint}
            </p>
          )}
        </div>
      )}

      {exercise.type === "WORD_BANK" && (
        <div className="space-y-4">
          <div className="min-h-[56px] flex flex-wrap gap-2 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            {selection.tokenIds.length === 0 ? (
              <p className="text-sm text-slate-400">
                Tap the words below in order
              </p>
            ) : (
              selection.tokenIds.map((tokenId, index) => {
                const token = exercise.content.wordBank.find(
                  (item) => item.id === tokenId,
                );

                return (
                  <button
                    key={`${tokenId}-${index}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggleToken(tokenId)}
                    className="px-3 py-2 rounded-lg bg-primary-100 text-primary-700"
                  >
                    {token?.text ?? tokenId}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {exercise.content.wordBank.map((token) => {
              const selected = selection.tokenIds.includes(token.id);

              return (
                <button
                  key={token.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onToggleToken(token.id)}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    selected
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-slate-200 hover:border-primary-300"
                  }`}
                >
                  {token.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
        className="w-full px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Check answer
      </button>
    </div>
  );
}

export function LessonFeedbackPanel({
  feedback,
  onNext,
}: {
  feedback: AnswerFeedback;
  onNext: () => void;
}) {
  return (
    <div
      role="status"
      className={`rounded-xl border p-6 space-y-3 ${
        feedback.isCorrect
          ? "border-success-100 bg-success-100"
          : "border-red-200 bg-red-50"
      }`}
    >
      <p
        className={`font-semibold ${
          feedback.isCorrect ? "text-success-600" : "text-red-700"
        }`}
      >
        {feedback.isCorrect ? "Correct!" : "Not quite."}
      </p>

      {feedback.explanation && (
        <p className="text-slate-700">{feedback.explanation}</p>
      )}

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
      >
        Next exercise
      </button>
    </div>
  );
}

export function LessonCompletePanel({
  feedback,
}: {
  feedback: AnswerFeedback;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
      <div className="text-5xl">🎉</div>

      <h2 className="text-2xl font-bold text-slate-900">
        Lesson complete!
      </h2>

      <p className="text-slate-600">
        You answered {feedback.attempt.correctCount} of{" "}
        {feedback.attempt.totalExercises} exercises correctly.
      </p>

      <div
        className={`rounded-lg p-4 text-left ${
          feedback.isCorrect ? "bg-success-100" : "bg-red-50"
        }`}
      >
        <p
          className={`font-semibold ${
            feedback.isCorrect ? "text-success-600" : "text-red-700"
          }`}
        >
          {feedback.isCorrect ? "Correct!" : "Not quite."}
        </p>

        {feedback.explanation && (
          <p className="text-slate-700">{feedback.explanation}</p>
        )}
      </div>

      <Link
        to="/learning-path"
        className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
      >
        Back to learning path
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function LessonPage() {
  const { lessonId } = useParams();
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchLessonContent(lessonId!),
    enabled: Boolean(lessonId),
  });

  const [state, dispatch] = useReducer(lessonPlayerReducer, {
    ...initialLessonPlayerState,
    hearts: user?.hearts ?? null,
    nextHeartAt: user?.nextHeartAt ?? null,
    noHearts: (user?.hearts ?? 0) <= 0,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <p
          role="status"
          className="bg-white rounded-xl border border-slate-200 p-6 text-slate-600"
        >
          Loading lesson…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto">
        <LessonErrorState
          message={getErrorMessage(error, "Failed to load this lesson")}
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-slate-600">Lesson not found.</p>
      </div>
    );
  }

  const exercises = data.exercises;
  const exercise = exercises[state.currentIndex];
  const input = exercise
    ? buildAnswerInput(exercise, state.selection)
    : null;

  const heartsDisplay =
    state.hearts !== null
      ? `Hearts: ${state.hearts} / 5`
      : "Loading hearts…";

  const nextHeartDisplay = state.nextHeartAt
    ? `Next heart regenerates at ${new Date(
        state.nextHeartAt,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : state.hearts === 5
      ? "Hearts full."
      : "";

  // -------------------------------------------------------------------------
  // Start lesson
  // -------------------------------------------------------------------------

  async function handleStart() {
    if (
      !lessonId ||
      state.attemptId ||
      state.isStarting ||
      state.isCompleted
    ) {
      return;
    }

    dispatch({ type: "START_REQUEST" });

    try {
      const attempt = await startLessonAttempt(lessonId);

      dispatch({
        type: "START_SUCCESS",
        attemptId: attempt.attemptId,
      });
    } catch (startError) {
      dispatch({
        type: "START_FAILURE",
        message: getErrorMessage(startError, "Failed to start the lesson"),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Submit answer
  // -------------------------------------------------------------------------

  async function handleSubmit() {
    if (
      !lessonId ||
      !state.attemptId ||
      !exercise ||
      !input ||
      state.isSubmitting ||
      state.feedback
    ) {
      return;
    }

    dispatch({ type: "SUBMIT_REQUEST" });

    try {
      const feedback = await submitLessonAnswer(
        lessonId,
        state.attemptId,
        exercise.id,
        input,
      );

      dispatch({
        type: "SUBMIT_SUCCESS",
        feedback,
      });

      // ---------------------------------------------------------------------
      // Update global auth state using the backend response.
      //
      // IMPORTANT:
      // Gamification fields are nested inside feedback.attempt.
      // ---------------------------------------------------------------------

      updateUser({
        ...(feedback.attempt.xpAwarded !== undefined
          ? {
              xpTotal:
                (user?.xpTotal ?? 0) + feedback.attempt.xpAwarded,
            }
          : {}),

        ...(feedback.attempt.dailyXp !== undefined
          ? {
              dailyXp: feedback.attempt.dailyXp,
            }
          : {}),

        ...(feedback.attempt.currentStreak !== undefined
          ? {
              streak: feedback.attempt.currentStreak,
            }
          : {}),

        ...(feedback.attempt.hearts !== undefined
          ? {
              hearts: feedback.attempt.hearts,
            }
          : {}),

        ...(feedback.attempt.nextHeartAt !== undefined
          ? {
              nextHeartAt: feedback.attempt.nextHeartAt,
            }
          : {}),
      });

      // Refresh review queue after every accepted answer.
      void queryClient.invalidateQueries({
        queryKey: ["review-queue"],
      });

      // Refresh lesson statuses when an attempt is completed.
      if (feedback.attempt.status === "COMPLETED") {
        void queryClient.invalidateQueries({
          queryKey: ["learning-path"],
        });
      }

      // Navigate to results after lesson completion.
      if (
        lessonId &&
        feedback.attempt.status === "COMPLETED"
      ) {
        const summary = computeResultsSummary(
          [...state.answers, feedback.isCorrect],
          feedback.attempt.totalExercises,
        );

        navigate(`/lesson/${lessonId}/results`, {
          state: {
            ...summary,

            xpAwarded: feedback.attempt.xpAwarded ?? null,
            dailyXp: feedback.attempt.dailyXp ?? null,
            goalCompleted: feedback.attempt.goalCompleted ?? null,
            currentStreak: feedback.attempt.currentStreak ?? null,
          },
        });
      }
    } catch (submitError) {
      if (
        submitError instanceof Error &&
        "status" in submitError &&
        (submitError as { status?: number; code?: string }).status === 409 &&
        (submitError as { status?: number; code?: string }).code ===
          "NO_HEARTS"
      ) {
        dispatch({ type: "NO_HEARTS" });
        return;
      }

      dispatch({
        type: "SUBMIT_FAILURE",
        message: getErrorMessage(
          submitError,
          "Failed to submit your answer",
        ),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {data.lesson.title}
        </h1>

        <p className="mt-1 text-slate-600">
          {data.lesson.description}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {exercises.length} exercises • ~{data.lesson.estimatedMinutes} min
        </p>

        <div className="mt-3 flex items-center gap-3 text-sm font-medium">
          <span
            className={`px-2 py-1 rounded ${
              state.noHearts
                ? "bg-red-100 text-red-700"
                : "bg-primary-100 text-primary-700"
            }`}
          >
            {heartsDisplay}
          </span>

          {state.noHearts ? (
            <span className="text-red-600">
              (wait for regeneration)
            </span>
          ) : state.nextHeartAt ? (
            <span className="text-slate-500">
              {nextHeartDisplay}
            </span>
          ) : state.hearts === 5 ? (
            <span className="text-slate-500">
              Hearts full.
            </span>
          ) : null}
        </div>
      </div>

      {state.attemptId === null && !state.isCompleted ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <p className="text-slate-600">
            Ready to practise this lesson?
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={state.isStarting}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
          >
            {state.isStarting ? "Starting…" : "Start Lesson"}
          </button>

          {state.startError && (
            <p role="alert" className="text-red-700">
              {state.startError}
            </p>
          )}
        </div>
      ) : state.isCompleted ? (
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-slate-600">
            Viewing results…
          </p>
        </div>
      ) : exercise ? (
        <>
          <p className="text-sm font-medium text-slate-500">
            Exercise {state.currentIndex + 1} of {exercises.length}
          </p>

          <LessonExerciseView
            exercise={exercise}
            selection={state.selection}
            disabled={
              state.isSubmitting ||
              state.feedback !== null ||
              state.noHearts
            }
            canSubmit={input !== null && !state.noHearts}
            onSubmit={handleSubmit}
            onSelectOption={(optionId) =>
              dispatch({
                type: "SELECT_OPTION",
                optionId,
              })
            }
            onChangeText={(text) =>
              dispatch({
                type: "SET_TEXT",
                text,
              })
            }
            onToggleToken={(tokenId) =>
              dispatch({
                type: "TOGGLE_TOKEN",
                tokenId,
              })
            }
          />

          {state.submitError && (
            <p role="alert" className="text-red-700">
              {state.submitError}
            </p>
          )}

          {state.noHearts && (
            <p role="alert" className="text-red-700">
              {state.submitError ??
                "No hearts remaining. Wait for a heart to regenerate."}
            </p>
          )}

          {state.feedback && (
            <LessonFeedbackPanel
              feedback={state.feedback}
              onNext={() => dispatch({ type: "NEXT" })}
            />
          )}
        </>
      ) : (
        <p className="text-slate-600">
          This lesson has no exercises yet.
        </p>
      )}
    </div>
  );
}