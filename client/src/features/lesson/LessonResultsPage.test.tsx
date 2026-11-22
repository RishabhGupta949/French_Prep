import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';

import { LessonResultsPage, type LessonResultsData } from './LessonResultsPage';

function renderResults(
  state: LessonResultsData | undefined
): string {
  return renderToStaticMarkup(
    <StaticRouter
      location={{
        pathname: '/lesson/lesson-1/results',
        state,
      }}
    >
      <Routes>
        <Route
          path="/lesson/:lessonId/results"
          element={<LessonResultsPage />}
        />
      </Routes>
    </StaticRouter>
  );
}

const summary: LessonResultsData = {
  total: 3,
  correct: 2,
  incorrect: 1,
  accuracy: 67,
  xpAwarded: 10,
  dailyXp: 10,
  goalCompleted: true,
  currentStreak: 2,
};

const summaryWithoutGamification: LessonResultsData = {
  total: 3,
  correct: 2,
  incorrect: 1,
  accuracy: 67,
  xpAwarded: null,
  dailyXp: null,
  goalCompleted: null,
  currentStreak: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('lesson results', () => {
  it('renders all summary values from navigation state', () => {
    const html = renderResults(summary);

    expect(html).toContain('Lesson complete!');
    expect(html).toContain('Lesson: lesson-1');
    expect(html).toContain('2 / 3');
    expect(html).toContain('Correct answers');
    expect(html).toContain('67%');
    expect(html).toContain('Accuracy');
    expect(html).toContain('1 of 3 exercises incorrect.');
  });

  it('renders gamification data from the final-answer response', () => {
    const html = renderResults(summary);

    expect(html).toContain('Gamification');
    expect(html).toContain('+10'); // XP earned
    expect(html).toContain('10 / 10'); // Daily XP
    expect(html).toContain('Goal: 10 XP');
    expect(html).toContain('Streak: 2 day(s)');
    expect(html).toContain('🎯 Daily goal completed!');
  });

  it('renders the completion message', () => {
    const html = renderResults(summary);

    expect(html).toContain('Lesson complete!');
  });

  it('handles missing navigation state safely without fabricated results', () => {
    const html = renderResults(undefined);

    expect(html).toContain('Results unavailable');
    expect(html).not.toContain('%');
    expect(html).not.toContain('Correct answers');
    expect(html).not.toContain('Gamification');
    expect(html).toContain('Complete the lesson to view');
  });

  it('handles missing gamification data safely without fabricated values', () => {
    const html = renderResults(summaryWithoutGamification);

    expect(html).toContain('Lesson complete!');
    expect(html).not.toContain('Gamification');
    expect(html).not.toContain('+');
    expect(html).not.toContain('Streak');
    expect(html).toContain('href="/learning-path"');
  });

  it('links back to the learning path', () => {
    const html = renderResults(summary);

    expect(html).toContain('href="/learning-path"');
    expect(html).toContain('Back to learning path');
  });
});
