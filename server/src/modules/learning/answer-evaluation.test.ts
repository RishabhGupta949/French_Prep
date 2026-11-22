import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The routes import the real auth middleware, so only the token verifier
// is mocked. This keeps the 401 behaviour genuine.
vi.mock('../auth/auth.service.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// Firestore is replaced with in-memory fakes so the evaluation logic can be
// exercised without an emulator or credentials. Pure helpers are kept real.
vi.mock('./learning.repository.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./learning.repository.js')>();

  return {
    ...actual,
    getLearningPath: vi.fn(),
    getUnits: vi.fn(),
    getLessons: vi.fn(),
    getUserLessonProgress: vi.fn(),
    getLessonById: vi.fn(),
    getUserLessonProgressById: vi.fn(),
    getExercisesForLesson: vi.fn(),
    getExerciseById: vi.fn(),
    getAnswerKeyForExercise: vi.fn(),
    createLessonAttempt: vi.fn(),
    markLessonProgressInProgress: vi.fn(),
    submitAnswerInTransaction: vi.fn(),
  };
});

import { verifyAccessToken } from '../auth/auth.service.js';
import {
  getLessonById,
  getUserLessonProgressById,
  getExerciseById,
  getAnswerKeyForExercise,
  submitAnswerInTransaction,
} from './learning.repository.js';
import learningRoutes from './learning.routes.js';
import {
  evaluateAnswer,
  normalizeFillBlankAnswer,
} from './learning.service.js';

import { Timestamp } from 'firebase-admin/firestore';

import type {
  AnswerKey,
  ExerciseContent,
} from '../../lib/schemas.js';
import type {
  ExerciseRecord,
  LessonRecord,
} from './learning.repository.js';

const multipleChoiceContent: ExerciseContent = {
  type: 'MULTIPLE_CHOICE',
  options: [
    { id: 'a', text: 'Bonjour' },
    { id: 'b', text: 'Merci' },
  ],
};

const multipleChoiceKey: AnswerKey = {
  type: 'MULTIPLE_CHOICE',
  correctOptionId: 'a',
};

const fillBlankKey: AnswerKey = {
  type: 'FILL_BLANK',
  acceptedAnswers: ['Au revoir'],
};

const accentKey: AnswerKey = {
  type: 'FILL_BLANK',
  acceptedAnswers: ['Très bien'],
};

const wordBankContent: ExerciseContent = {
  type: 'WORD_BANK',
  wordBank: [
    { id: 'w1', text: 'Merci' },
    { id: 'w2', text: 'beaucoup' },
  ],
};

const wordBankKey: AnswerKey = {
  type: 'WORD_BANK',
  correctTokenIds: ['w1', 'w2'],
};

function buildExercise(
  type: ExerciseRecord['type'],
  content: ExerciseContent
): ExerciseRecord {
  return {
    id: 'ex-1',
    order: 0,
    type,
    prompt: 'Prompt',
    content,
    explanation: 'Because that is the right answer.',
  };
}

function buildLesson(
  overrides: Partial<LessonRecord> = {}
): LessonRecord {
  return {
    id: 'lesson-1',
    unitId: 'unit-1',
    title: 'Lesson 1',
    description: 'First lesson',
    order: 0,
    sequence: 0,
    previousLessonId: null,
    estimatedMinutes: 5,
    exerciseCount: 1,
    ...overrides,
  };
}

describe('multiple choice evaluation', () => {
  it('accepts the correct option', () => {
    const result = evaluateAnswer(
      'MULTIPLE_CHOICE',
      multipleChoiceContent,
      multipleChoiceKey,
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('rejects an incorrect option', () => {
    const result = evaluateAnswer(
      'MULTIPLE_CHOICE',
      multipleChoiceContent,
      multipleChoiceKey,
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'b' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: false });
  });

  it('rejects an option that is not part of the exercise', () => {
    const result = evaluateAnswer(
      'MULTIPLE_CHOICE',
      multipleChoiceContent,
      multipleChoiceKey,
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'z' } }
    );

    expect(result).toEqual({ ok: false, reason: 'INVALID_OPTION' });
  });
});

describe('fill in the blank evaluation', () => {
  it('accepts the exact correct answer', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      fillBlankKey,
      { type: 'FILL_BLANK', answer: { text: 'Au revoir' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('compares case-insensitively', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      fillBlankKey,
      { type: 'FILL_BLANK', answer: { text: 'aU rEvOiR' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('ignores leading, trailing and repeated whitespace', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      fillBlankKey,
      { type: 'FILL_BLANK', answer: { text: '   Au    revoir  ' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('accepts a correct answer that keeps its French accents', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      accentKey,
      { type: 'FILL_BLANK', answer: { text: 'Très bien' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('rejects an answer that drops a required accent', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      accentKey,
      { type: 'FILL_BLANK', answer: { text: 'Tres bien' } }
    );

    expect(result).toEqual({ ok: true, isCorrect: false });
  });

  it('normalizes unicode without stripping diacritics', () => {
    // "é" can be a single code point (NFC) or "e" + combining accent (NFD).
    expect(normalizeFillBlankAnswer('e\u0301le\u0300ve')).toBe('élève');
  });
});

describe('word bank evaluation', () => {
  it('accepts the correct token order', () => {
    const result = evaluateAnswer(
      'WORD_BANK',
      wordBankContent,
      wordBankKey,
      { type: 'WORD_BANK', answer: { tokenIds: ['w1', 'w2'] } }
    );

    expect(result).toEqual({ ok: true, isCorrect: true });
  });

  it('rejects tokens in the wrong order', () => {
    const result = evaluateAnswer(
      'WORD_BANK',
      wordBankContent,
      wordBankKey,
      { type: 'WORD_BANK', answer: { tokenIds: ['w2', 'w1'] } }
    );

    expect(result).toEqual({ ok: true, isCorrect: false });
  });

  it('rejects a token that is not part of the word bank', () => {
    const result = evaluateAnswer(
      'WORD_BANK',
      wordBankContent,
      wordBankKey,
      { type: 'WORD_BANK', answer: { tokenIds: ['w1', 'w9'] } }
    );

    expect(result).toEqual({ ok: false, reason: 'INVALID_TOKEN' });
  });
});

describe('exercise type mismatch', () => {
  it('rejects a submission whose type differs from the exercise type', () => {
    const result = evaluateAnswer(
      'MULTIPLE_CHOICE',
      multipleChoiceContent,
      multipleChoiceKey,
      { type: 'FILL_BLANK', answer: { text: 'Bonjour' } }
    );

    expect(result).toEqual({ ok: false, reason: 'TYPE_MISMATCH' });
  });

  it('rejects an answer key that does not match the exercise type', () => {
    const result = evaluateAnswer(
      'FILL_BLANK',
      { type: 'FILL_BLANK' },
      multipleChoiceKey,
      { type: 'FILL_BLANK', answer: { text: 'Bonjour' } }
    );

    expect(result).toEqual({ ok: false, reason: 'TYPE_MISMATCH' });
  });
});

describe('POST /api/lessons/:lessonId/attempts/:attemptId/exercises/:exerciseId/answer', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.resetAllMocks();

    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: 'user-1',
      email: 'learner@example.com',
      role: 'LEARNER',
      sid: 'session-1',
    });

    const app = express();
    app.use(express.json());
    app.use('/api', learningRoutes);

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function postAnswer(
    lessonId: string,
    exerciseId: string,
    body: unknown,
    withAuth = true
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (withAuth) {
      headers.Authorization = 'Bearer test-token';
    }

    return fetch(
      `${baseUrl}/api/lessons/${lessonId}/attempts/attempt-1/exercises/${exerciseId}/answer`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );
  }

  it('returns 401 when the request is not authenticated', async () => {
    const response = await postAnswer(
      'lesson-1',
      'ex-1',
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } },
      false
    );

    expect(response.status).toBe(401);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('returns 404 when the lesson does not exist', async () => {
    vi.mocked(getLessonById).mockResolvedValue(null);

    const response = await postAnswer(
      'missing-lesson',
      'ex-1',
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } }
    );

    expect(response.status).toBe(404);
  });

  it('returns 403 when the lesson is locked', async () => {
    vi.mocked(getLessonById).mockResolvedValue(
      buildLesson({ previousLessonId: 'lesson-0' })
    );
    vi.mocked(getUserLessonProgressById).mockResolvedValue(null);

    const response = await postAnswer(
      'lesson-1',
      'ex-1',
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } }
    );

    expect(response.status).toBe(403);
  });

  it('returns 404 when the exercise does not exist', async () => {
    vi.mocked(getLessonById).mockResolvedValue(buildLesson());
    vi.mocked(getExerciseById).mockResolvedValue(null);

    const response = await postAnswer(
      'lesson-1',
      'missing-exercise',
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } }
    );

    expect(response.status).toBe(404);
  });

  it('returns evaluation feedback without leaking the answer key', async () => {
    vi.mocked(getLessonById).mockResolvedValue(buildLesson());
    vi.mocked(getExerciseById).mockResolvedValue(
      buildExercise('MULTIPLE_CHOICE', multipleChoiceContent)
    );
    vi.mocked(getAnswerKeyForExercise).mockResolvedValue(
      multipleChoiceKey
    );
    vi.mocked(submitAnswerInTransaction).mockResolvedValue({
      ok: true,
      attempt: {
        id: 'attempt-1',
        lessonId: 'lesson-1',
        status: 'IN_PROGRESS',
        correctCount: 1,
        answeredCount: 1,
        totalExercises: 3,
        accuracy: null,
        xpAwarded: 0,
        startedAt: Timestamp.fromMillis(0),
      },
    });

    const response = await postAnswer(
      'lesson-1',
      'ex-1',
      { type: 'MULTIPLE_CHOICE', answer: { optionId: 'a' } }
    );

    const text = await response.text();

    expect(response.status).toBe(200);

    const body = JSON.parse(text);

    expect(body).toEqual({
      exerciseId: 'ex-1',
      isCorrect: true,
      explanation: 'Because that is the right answer.',
      attempt: {
        attemptId: 'attempt-1',
        status: 'IN_PROGRESS',
        answeredCount: 1,
        correctCount: 1,
        totalExercises: 3,
        accuracy: null,
      },
    });

    expect(Object.keys(body).sort()).toEqual([
      'attempt',
      'exerciseId',
      'explanation',
      'isCorrect',
    ]);

    expect(text).not.toContain('correctOptionId');
    expect(text).not.toContain('acceptedAnswers');
    expect(text).not.toContain('correctTokenIds');
  });

  it('returns 400 when the answer type does not match the exercise', async () => {
    vi.mocked(getLessonById).mockResolvedValue(buildLesson());
    vi.mocked(getExerciseById).mockResolvedValue(
      buildExercise('MULTIPLE_CHOICE', multipleChoiceContent)
    );
    vi.mocked(getAnswerKeyForExercise).mockResolvedValue(
      multipleChoiceKey
    );

    const response = await postAnswer(
      'lesson-1',
      'ex-1',
      { type: 'FILL_BLANK', answer: { text: 'Bonjour' } }
    );

    expect(response.status).toBe(400);
  });
});
