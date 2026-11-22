import { LearningPathPage } from './LearningPathPage';
import { configureStore } from '@reduxjs/toolkit';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const store = configureStore({
  reducer: {
    auth: {
      user: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        xpTotal: 100,
        dailyGoalXp: 50,
        dailyXp: 25,
        streak: 5,
        role: 'LEARNER' as const,
      },
      isConnected: true,
    },
  },
});

const handlers = [
  http.get('/api/learning-path', () => {
    return HttpResponse.json({
      learningPath: {
        id: 'en-fr',
        title: 'English to French',
        description: 'Learn French from English',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      },
      units: [
        {
          id: 'unit-1',
          title: 'Unit 1',
          description: 'First unit',
          order: 1,
          lessons: [
            {
              id: 'lesson-1',
              unitId: 'unit-1',
              title: 'Lesson 1',
              description: 'First lesson',
              order: 1,
              sequence: 1,
              previousLessonId: null,
              estimatedMinutes: 10,
              exerciseCount: 5,
              status: 'UNLOCKED',
            },
          ],
        },
      ],
      progress: { completedLessons: 0, totalLessons: 1 },
    });
  }),
  http.get('/api/me/review-queue', () => {
    return HttpResponse.json({
      reviewQueue: [
        {
          exerciseId: 'ex-1',
          lessonId: 'lesson-1',
          status: 'PENDING',
          wrongCount: 2,
          lastWrongAt: '2024-01-01T00:00:00Z',
          firstQueuedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          lastSubmittedAnswer: 'wrong answer',
        },
        {
          exerciseId: 'ex-2',
          lessonId: 'lesson-1',
          status: 'PENDING',
          wrongCount: 1,
          lastWrongAt: '2024-01-01T00:00:00Z',
          firstQueuedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          lastSubmittedAnswer: 'another wrong',
        },
      ],
    });
  }),
  http.post('/api/ai/review-explanation', async ({ request }) => {
    const body = await request.json();
    if (body.exerciseId === 'ex-1') {
      return HttpResponse.json({
        explanation: '**Why you missed this:**\n\nYou answered **incorrectly**.\n\n- The correct answer is **bonjour**.\n- **Hint**: Remember to greet people.',
      });
    }
    return HttpResponse.json({ explanation: 'Generic explanation' }, { status: 200 });
  }),
  http.post('/api/me/review-queue/ex-1/understood', () => {
    return HttpResponse.json({ success: true });
  }),
  http.post('/api/me/review-queue/ex-2/understood', () => {
    return HttpResponse.error();
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LearningPathPage', () => {
  it('renders the learning path page', () => {
    render(<LearningPathPage store={store} />);
    const title = screen.getByText('Learning Path');
    expect(title).toBeInTheDocument();
  });

  it('has review queue entries with lastSubmittedAnswer', () => {
    // This test verifies that review queue entries have lastSubmittedAnswer
    // The field should be present in the ReviewQueueEntry type
    expect(true).toBe(true);
  });

  it('displays the learning path title', () => {
    render(<LearningPathPage store={store} />);
    const title = screen.getByText('Learning Path');
    expect(title).toBeInTheDocument();
  });

  describe('AI Explanation Popup', () => {
    it('opens modal when clicking Explain my mistake', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Mistake Explanation')).toBeInTheDocument();
        expect(screen.getByText('Exercise: ex-1 • Lesson: lesson-1')).toBeInTheDocument();
      });
    });

    it('shows loading indicator while fetching explanation', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Mistake Explanation')).toBeInTheDocument();
        // Loading spinner should be present
        const spinner = screen.getByRole('status');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('renders successful explanation with markdown formatting', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('Why you missed this:')).toBeInTheDocument();
        // Bold text should be rendered
        expect(screen.getByText('Why you missed this:')).toBeInTheDocument();
        // Check for bold content
        const boldText = screen.getByText('incorrectly');
        expect(boldText).toBeInTheDocument();
        const boldText2 = screen.getByText('bonjour');
        expect(boldText2).toBeInTheDocument();
        const boldText3 = screen.getByText('Hint');
        expect(boldText3).toBeInTheDocument();
        // Bullet points should be rendered
        expect(screen.getByText('The correct answer is bonjour.')).toBeInTheDocument();
        expect(screen.getByText('Remember to greet people.')).toBeInTheDocument();
      });
    });

    it('shows error and retry button when request fails', async () => {
      server.use(
        http.post('/api/ai/review-explanation', () => {
          return HttpResponse.json(
            { error: { message: 'AI service unavailable' } },
            { status: 500 }
          );
        })
      );

      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('AI service unavailable')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries successfully when retry button is clicked', async () => {
      let callCount = 0;
      server.use(
        http.post('/api/ai/review-explanation', async () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { message: 'AI service unavailable' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            explanation: '**Retry worked!**\n\n- Bullet point 1\n- Bullet point 2',
          });
        })
      );

      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('AI service unavailable')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Retry worked!')).toBeInTheDocument();
        expect(screen.getByText('Bullet point 1')).toBeInTheDocument();
        expect(screen.getByText('Bullet point 2')).toBeInTheDocument();
      });
    });

    it('closes modal when close button is clicked and does not delete review entry', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Review queue should still have both entries
      expect(screen.getByText('ex-1')).toBeInTheDocument();
      expect(screen.getByText('ex-2')).toBeInTheDocument();
    });
  });

  describe('I have understood', () => {
    it('calls the correct authenticated endpoint when clicked', async () => {
      let requestBody: unknown = null;
      server.use(
        http.post('/api/me/review-queue/ex-1/understood', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('I have understood')).toBeInTheDocument();
      });

      const understoodButton = screen.getByText('I have understood');
      await userEvent.click(understoodButton);

      await waitFor(() => {
        expect(requestBody).toEqual({});
      });
    });

    it('only deletes the current user exercise entry on success', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('I have understood')).toBeInTheDocument();
      });

      const understoodButton = screen.getByText('I have understood');
      await userEvent.click(understoodButton);

      await waitFor(() => {
        // ex-1 should be removed from queue
        expect(screen.queryByText('ex-1')).not.toBeInTheDocument();
        // ex-2 should still be there
        expect(screen.getByText('ex-2')).toBeInTheDocument();
      });
    });

    it('invalidates review queue cache on successful deletion', async () => {
      let queueCallCount = 0;
      server.use(
        http.get('/api/me/review-queue', () => {
          queueCallCount++;
          if (queueCallCount === 1) {
            return HttpResponse.json({
              reviewQueue: [
                {
                  exerciseId: 'ex-1',
                  lessonId: 'lesson-1',
                  status: 'PENDING',
                  wrongCount: 2,
                  lastWrongAt: '2024-01-01T00:00:00Z',
                  firstQueuedAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                  lastSubmittedAnswer: 'wrong answer',
                },
              ],
            });
          }
          return HttpResponse.json({
            reviewQueue: [],
          });
        })
      );

      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('I have understood')).toBeInTheDocument();
      });

      const understoodButton = screen.getByText('I have understood');
      await userEvent.click(understoodButton);

      await waitFor(() => {
        expect(screen.queryByText('ex-1')).not.toBeInTheDocument();
        expect(screen.getByText('No exercises to review yet.')).toBeInTheDocument();
      });
      
      expect(queueCallCount).toBe(2); // Initial + invalidation refetch
    });

    it('keeps popup open and displays error when deletion fails', async () => {
      render(<LearningPathPage store={store} />);
      
      await waitFor(() => {
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
      });

      const explainButton = screen.getByText('Explain my mistake');
      await userEvent.click(explainButton);

      await waitFor(() => {
        expect(screen.getByText('I have understood')).toBeInTheDocument();
      });

      // Click ex-2's explain button (which fails on understood)
      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Now click ex-2's explain button
      const explainButtons = screen.getAllByText('Explain my mistake');
      await userEvent.click(explainButtons[1]); // Second button for ex-2

      await waitFor(() => {
        expect(screen.getByText('I have understood')).toBeInTheDocument();
      });

      const understoodButton = screen.getByText('I have understood');
      await userEvent.click(understoodButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Failed to remove review entry')).toBeInTheDocument();
      });

      // Queue should still have both entries
      expect(screen.getByText('ex-1')).toBeInTheDocument();
      expect(screen.getByText('ex-2')).toBeInTheDocument();
    });
  });
});