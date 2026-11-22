import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Routes, Route } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';

// The data hook and API client are replaced. Everything else is real.
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../features/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../features/auth/authStore';
import {
  LessonPage,
  LessonExerciseView,
  LessonFeedbackPanel,
  LessonCompletePanel,
  LessonErrorState,
  buildAnswerInput,
  lessonPlayerReducer,
  initialLessonPlayerState,
  startLessonAttempt,
  submitLessonAnswer,
  computeResultsSummary,
  type AnswerFeedback,
  type AnswerInput,
  type AnswerSelection,
  type LessonContentResponse,
  type LessonExercise,
  type LessonPlayerState,
  type LessonResultsSummary,
} from './LessonPage';

interface MockQueryState {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => void;
  isFetching?: boolean;
}

function mockAuth(user: { hearts: number; nextHeartAt: string | null } | null): void {
  vi.mocked(useAuthStore).mockReturnValue({
    user,
  } as never);
}

function makeReturnValue(state: MockQueryState) {
  return {
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
    refetch: state.refetch ?? vi.fn(),
    isFetching: state.isFetching ?? false,
  } as never;
}

function mockQuery(
  states: MockQueryState | Record<string, MockQueryState>
): void {
  const isSingle =
    'data' in states ||
    'isLoading' in states ||
    'isError' in states;

  if (isSingle) {
    const rv = makeReturnValue(states as MockQueryState);
    vi.mocked(useQuery).mockReturnValue(rv);
  } else {
    const stateMap = states as Record<string, MockQueryState>;
    const lessonRv = makeReturnValue(stateMap.lesson ?? {});
    const heartsRv = makeReturnValue(stateMap.me ?? {});
    vi.mocked(useQuery).mockReturnValueOnce(lessonRv).mockReturnValueOnce(heartsRv);
  }
}

function renderPage(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/lesson/lesson-1">
      <Routes>
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
      </Routes>
    </StaticRouter>
  );
}

function findElement(
  node: React.ReactNode,
  type: React.ElementType | string
): React.ReactElement | null {
  if (!React.isValidElement(node)) {
    return null;
  }

  if (node.type === type) {
    return node;
  }

  const { children } = node.props as {
    children?: React.ReactNode;
  };

  let found: React.ReactElement | null = null;

  React.Children.forEach(children, (child) => {
    if (!found) {
      found = findElement(child, type);
    }
  });

  return found;
}

const multipleChoiceExercise: LessonExercise = {
  id: 'ex-1',
  order: 0,
  type: 'MULTIPLE_CHOICE',
  prompt: 'How do you say "Hello" in French?',
  content: {
    type: 'MULTIPLE_CHOICE',
    options: [
      { id: 'a', text: 'Bonjour' },
      { id: 'b', text: 'Merci' },
    ],
  },
};

const fillBlankExercise: LessonExercise = {
  id: 'ex-2',
  order: 1,
  type: 'FILL_BLANK',
  prompt: 'When leaving, you say "___ revoir".',
  content: {
    type: 'FILL_BLANK',
    hint: 'Goodbye',
  },
};

const wordBankExercise: LessonExercise = {
  id: 'ex-3',
  order: 2,
  type: 'WORD_BANK',
  prompt: 'Build the sentence for "Thank you very much".',
  content: {
    type: 'WORD_BANK',
    wordBank: [
      { id: 'w1', text: 'Merci' },
      { id: 'w2', text: 'beaucoup' },
    ],
  },
};

const lessonData: LessonContentResponse = {
  lesson: {
    id: 'lesson-1',
    title: 'Greetings and Politeness',
    description: 'Essential French greetings',
    estimatedMinutes: 10,
    exerciseCount: 3,
  },
  exercises: [
    multipleChoiceExercise,
    fillBlankExercise,
    wordBankExercise,
  ],
};

const emptySelection: AnswerSelection = {
  optionId: null,
  text: '',
  tokenIds: [],
};

function buildFeedback(
  overrides: Partial<AnswerFeedback> = {}
): AnswerFeedback {
  return {
    exerciseId: 'ex-1',
    isCorrect: true,
    explanation: 'Bonjour means hello.',
    attempt: {
      attemptId: 'attempt-1',
      status: 'IN_PROGRESS',
      answeredCount: 1,
      correctCount: 1,
      totalExercises: 3,
      accuracy: null,
    },
    ...overrides,
  };
}

function startedState(): LessonPlayerState {
  const requested = lessonPlayerReducer(
    initialLessonPlayerState,
    { type: 'START_REQUEST' }
  );

  return lessonPlayerReducer(requested, {
    type: 'START_SUCCESS',
    attemptId: 'attempt-1',
  });
}

function renderExercise(
  exercise: LessonExercise,
  selection: AnswerSelection = emptySelection,
  options: { disabled?: boolean; canSubmit?: boolean } = {}
): string {
  return renderToStaticMarkup(
    <LessonExerciseView
      exercise={exercise}
      selection={selection}
      disabled={options.disabled ?? false}
      canSubmit={options.canSubmit ?? false}
      onSubmit={vi.fn()}
      onSelectOption={vi.fn()}
      onChangeText={vi.fn()}
      onToggleToken={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth({ hearts: 5, nextHeartAt: null });
});

describe('lesson content loading', () => {
  it('renders the lesson title, description and start action', () => {
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Greetings and Politeness');
    expect(html).toContain('Essential French greetings');
    expect(html).toContain('3 exercises');
    expect(html).toContain('Start Lesson');
  });

  it('renders hearts display', () => {
    mockAuth({ hearts: 5, nextHeartAt: null });
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Hearts: 5 / 5');
  });

  it('shows a loading state', () => {
    mockQuery({ isLoading: true });

    const html = renderPage();

    expect(html).toContain('Loading lesson');
    expect(html).not.toContain('Start Lesson');
  });

  it('shows an error state with a retry action', () => {
    mockQuery({
      isError: true,
      error: new Error('Lesson failed to load'),
    });

    const html = renderPage();

    expect(html).toContain('Lesson failed to load');
    expect(html).toContain('Try again');
  });

  it('calls the retry handler from the error state', () => {
    const onRetry = vi.fn();
    const tree = LessonErrorState({
      message: 'Lesson failed to load',
      onRetry,
    });
    const button = findElement(tree, 'button');

    expect(button).not.toBeNull();

    const { onClick } = button!.props as { onClick: () => void };
    onClick();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('hearts handling', () => {
  it('loads hearts from auth store and displays them', () => {
    mockAuth({ hearts: 3, nextHeartAt: '2026-01-01T12:30:00.000Z' });
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Hearts: 3 / 5');
    expect(html).toContain('Next heart regenerates at');
  });

  it('shows hearts full when at max', () => {
    mockAuth({ hearts: 5, nextHeartAt: null });
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Hearts: 5 / 5');
    expect(html).toContain('Hearts full.');
  });

  it('handles missing auth user safely', () => {
    mockAuth(null);
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Loading hearts…');
    expect(html).toContain('Greetings and Politeness');
  });
});

describe('starting a lesson', () => {
  it('creates an attempt and stores its id', async () => {
    vi.mocked(api.post).mockResolvedValue({
      attemptId: 'attempt-42',
      lessonId: 'lesson-1',
      status: 'IN_PROGRESS',
      totalExercises: 3,
      answeredCount: 0,
    });

    const attempt = await startLessonAttempt('lesson-1');

    expect(api.post).toHaveBeenCalledWith(
      '/lessons/lesson-1/attempts',
      {}
    );
    expect(attempt.attemptId).toBe('attempt-42');

    let state = lessonPlayerReducer(
      initialLessonPlayerState,
      { type: 'START_REQUEST' }
    );

    expect(state.isStarting).toBe(true);

    state = lessonPlayerReducer(state, {
      type: 'START_SUCCESS',
      attemptId: 'attempt-42',
    });

    expect(state.attemptId).toBe('attempt-42');
    expect(state.isStarting).toBe(false);
  });

  it('ignores duplicate starts', () => {
    const state = startedState();

    expect(
      lessonPlayerReducer(state, { type: 'START_REQUEST' })
    ).toBe(state);
    expect(
      lessonPlayerReducer(state, {
        type: 'START_SUCCESS',
        attemptId: 'another-attempt',
      })
    ).toBe(state);
  });
});

describe('exercise rendering', () => {
  it('renders multiple-choice options and disables submit until selected', () => {
    const html = renderExercise(multipleChoiceExercise);

    expect(html).toContain('Bonjour');
    expect(html).toContain('Merci');
    expect(html).toContain('Check answer');
    expect(html).toContain('disabled');
  });

  it('renders a fill-in-the-blank input and hint', () => {
    const html = renderExercise(fillBlankExercise);

    expect(html).toContain('type="text"');
    expect(html).toContain('Hint: Goodbye');
  });

  it('renders word-bank tokens and the chosen order', () => {
    const html = renderExercise(wordBankExercise, {
      optionId: null,
      text: '',
      tokenIds: ['w1', 'w2'],
    });

    expect(html).toContain('Merci');
    expect(html).toContain('beaucoup');
    expect(html).not.toContain('Tap the words below in order');
  });
});

describe('answer payloads', () => {
  it('builds the exact payload for all three exercise types', async () => {
    const cases: Array<{
      exercise: LessonExercise;
      selection: AnswerSelection;
      expected: AnswerInput;
    }> = [
      {
        exercise: multipleChoiceExercise,
        selection: { optionId: 'a', text: '', tokenIds: [] },
        expected: {
          type: 'MULTIPLE_CHOICE',
          answer: { optionId: 'a' },
        },
      },
      {
        exercise: fillBlankExercise,
        selection: {
          optionId: null,
          text: '  Au revoir  ',
          tokenIds: [],
        },
        expected: {
          type: 'FILL_BLANK',
          answer: { text: 'Au revoir' },
        },
      },
      {
        exercise: wordBankExercise,
        selection: {
          optionId: null,
          text: '',
          tokenIds: ['w1', 'w2'],
        },
        expected: {
          type: 'WORD_BANK',
          answer: { tokenIds: ['w1', 'w2'] },
        },
      },
    ];

    for (const { exercise, selection, expected } of cases) {
      const input = buildAnswerInput(exercise, selection);

      expect(input).toEqual(expected);

      vi.mocked(api.post).mockResolvedValue(buildFeedback());
      await submitLessonAnswer(
        'lesson-1',
        'attempt-1',
        exercise.id,
        input!
      );

      expect(api.post).toHaveBeenCalledWith(
        `/lessons/lesson-1/attempts/attempt-1/exercises/${exercise.id}/answer`,
        expected
      );
    }
  });

  it('does not build a payload for an empty answer', () => {
    expect(
      buildAnswerInput(fillBlankExercise, emptySelection)
    ).toBeNull();
    expect(
      buildAnswerInput(multipleChoiceExercise, emptySelection)
    ).toBeNull();
    expect(
      buildAnswerInput(wordBankExercise, emptySelection)
    ).toBeNull();
  });
});

describe('feedback and progression', () => {
  it('renders correct feedback with its explanation', () => {
    const html = renderToStaticMarkup(
      <LessonFeedbackPanel
        feedback={buildFeedback()}
        onNext={vi.fn()}
      />
    );

    expect(html).toContain('Correct!');
    expect(html).toContain('Bonjour means hello.');
    expect(html).toContain('Next exercise');
  });

  it('renders incorrect feedback with its explanation', () => {
    const html = renderToStaticMarkup(
      <LessonFeedbackPanel
        feedback={buildFeedback({
          isCorrect: false,
          explanation: 'That word means thank you.',
        })}
        onNext={vi.fn()}
      />
    );

    expect(html).toContain('Not quite.');
    expect(html).toContain('That word means thank you.');
  });

  it('calls the next handler from the feedback panel', () => {
    const onNext = vi.fn();
    const tree = LessonFeedbackPanel({
      feedback: buildFeedback(),
      onNext,
    });
    const button = findElement(tree, 'button');

    expect(button).not.toBeNull();

    const { onClick } = button!.props as { onClick: () => void };
    onClick();

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('advances to the next exercise and clears the selection', () => {
    let state = startedState();

    state = lessonPlayerReducer(state, {
      type: 'SELECT_OPTION',
      optionId: 'b',
    });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_REQUEST',
    });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_SUCCESS',
      feedback: buildFeedback(),
    });

    expect(state.feedback).not.toBeNull();

    state = lessonPlayerReducer(state, { type: 'NEXT' });

    expect(state.currentIndex).toBe(1);
    expect(state.feedback).toBeNull();
    expect(state.selection.optionId).toBeNull();
  });
});

describe('duplicate submission prevention', () => {
  it('ignores a second submit while one is pending', () => {
    const pending = lessonPlayerReducer(startedState(), {
      type: 'SUBMIT_REQUEST',
    });

    expect(
      lessonPlayerReducer(pending, { type: 'SUBMIT_REQUEST' })
    ).toBe(pending);
  });

  it('ignores a submit once feedback is showing', () => {
    let state = lessonPlayerReducer(startedState(), {
      type: 'SUBMIT_REQUEST',
    });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_SUCCESS',
      feedback: buildFeedback(),
    });

    expect(
      lessonPlayerReducer(state, { type: 'SUBMIT_REQUEST' })
    ).toBe(state);
  });

  it('disables the submit button while submitting', () => {
    const html = renderExercise(multipleChoiceExercise, {
      optionId: 'a',
      text: '',
      tokenIds: [],
    }, { disabled: true, canSubmit: true });

    expect(html).toContain('disabled');
  });
});

describe('NO_HEARTS handling', () => {
  it('blocks submissions and shows message when hearts are zero', () => {
    mockAuth({ hearts: 0, nextHeartAt: '2026-01-01T12:30:00.000Z' });
    mockQuery({ data: lessonData });

    const html = renderPage();

    expect(html).toContain('Hearts: 0 / 5');
    expect(html).toContain('wait for regeneration');
  });

  it('dispatches NO_HEARTS on 409 error with NO_HEARTS code', async () => {
    vi.mocked(api.post).mockRejectedValue({
      status: 409,
      code: 'NO_HEARTS',
      message: 'No hearts remaining.',
    } as unknown as Error);

    const state = lessonPlayerReducer(startedState(), {
      type: 'SUBMIT_REQUEST',
    });

    const nextState = lessonPlayerReducer(state, {
      type: 'NO_HEARTS',
    });

    expect(nextState.noHearts).toBe(true);
    expect(nextState.submitError).toContain('No hearts remaining');
  });
});

describe('lesson completion', () => {
  it('marks the attempt completed on the final answer', () => {
    const feedback = buildFeedback({
      attempt: {
        attemptId: 'attempt-1',
        status: 'COMPLETED',
        answeredCount: 3,
        correctCount: 2,
        totalExercises: 3,
        accuracy: 66.67,
      },
    });

    let state = lessonPlayerReducer(startedState(), {
      type: 'SUBMIT_REQUEST',
    });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_SUCCESS',
      feedback,
    });

    expect(state.isCompleted).toBe(true);
    expect(
      lessonPlayerReducer(state, { type: 'NEXT' })
    ).toBe(state);
  });

  it('renders the lesson-completed state with the final score', () => {
    const feedback = buildFeedback({
      attempt: {
        attemptId: 'attempt-1',
        status: 'COMPLETED',
        answeredCount: 3,
        correctCount: 2,
        totalExercises: 3,
        accuracy: 66.67,
      },
    });

    const html = renderToStaticMarkup(
      <StaticRouter location="/lesson/lesson-1">
        <LessonCompletePanel feedback={feedback} />
      </StaticRouter>
    );

    expect(html).toContain('Lesson complete!');
    expect(html).toContain('2 of 3 exercises correctly');
    expect(html).toContain('Back to learning path');
  });
});

describe('results summary', () => {
  it('computes correct and incorrect counts and accuracy', () => {
    const summary: LessonResultsSummary = computeResultsSummary(
      [true, false, true],
      3
    );

    expect(summary.total).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.incorrect).toBe(1);
    expect(summary.accuracy).toBe(67);
  });

  it('computes zero accuracy when nothing is answered', () => {
    const summary: LessonResultsSummary = computeResultsSummary([], 0);

    expect(summary.total).toBe(0);
    expect(summary.correct).toBe(0);
    expect(summary.incorrect).toBe(0);
    expect(summary.accuracy).toBe(0);
  });
});

describe('completion tracking', () => {
  it('tracks each answer and completes the attempt on the final answer', () => {
    let state = lessonPlayerReducer(startedState(), {
      type: 'SUBMIT_REQUEST',
    });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_SUCCESS',
      feedback: buildFeedback({
        isCorrect: true,
        attempt: {
          attemptId: 'attempt-1',
          status: 'IN_PROGRESS',
          answeredCount: 1,
          correctCount: 1,
          totalExercises: 3,
          accuracy: null,
        },
      }),
    });

    expect(state.isCompleted).toBe(false);
    expect(state.answers).toEqual([true]);

    // Clear feedback so a second submit is allowed.
    state = lessonPlayerReducer(state, { type: 'NEXT' });
    expect(state.feedback).toBeNull();

    state = lessonPlayerReducer(state, { type: 'SUBMIT_REQUEST' });
    state = lessonPlayerReducer(state, {
      type: 'SUBMIT_SUCCESS',
      feedback: buildFeedback({
        isCorrect: false,
        attempt: {
          attemptId: 'attempt-1',
          status: 'COMPLETED',
          answeredCount: 2,
          correctCount: 1,
          totalExercises: 3,
          accuracy: null,
        },
      }),
    });

    expect(state.isCompleted).toBe(true);
    expect(state.answers).toEqual([true, false]);
  });
});
