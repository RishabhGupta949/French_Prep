import { Link, useLocation, useParams } from 'react-router-dom';

export interface LessonResultsSummary {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export interface LessonResultsData extends LessonResultsSummary {
  xpAwarded: number | null;
  dailyXp: number | null;
  goalCompleted: boolean | null;
  currentStreak: number | null;
}

export function LessonResultsPage() {
  const { lessonId } = useParams();
  const location = useLocation();
  const summary = location.state as LessonResultsData | undefined;

  if (!summary) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Results unavailable
          </h1>
          <p className="text-slate-600 mb-8">
            No results were found for this lesson. Complete the lesson to view
            your results.
          </p>
          <Link
            to="/learning-path"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to learning path
          </Link>
        </div>
      </div>
    );
  }

  const dailyProgress =
    summary.dailyXp !== null &&
    summary.goalCompleted !== null &&
    summary.dailyXp > 0
      ? Math.min(100, Math.round((summary.dailyXp / 10) * 100))
      : null;

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Lesson complete!
        </h1>
        <p className="text-slate-600 mb-8">Lesson: {lessonId}</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-primary-50 rounded-xl p-6">
            <p className="text-3xl font-bold text-primary-600">
              {summary.correct} / {summary.total}
            </p>
            <p className="text-sm text-primary-700">Correct answers</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-6">
            <p className="text-3xl font-bold text-slate-600">
              {summary.accuracy}%
            </p>
            <p className="text-sm text-slate-500">Accuracy</p>
          </div>
        </div>

        <p className="text-slate-600 mb-8">
          {summary.incorrect} of {summary.total} exercises incorrect.
        </p>

        {summary.xpAwarded !== null || summary.dailyXp !== null || summary.currentStreak !== null ? (
          <div className="bg-slate-50 rounded-xl p-6 mb-8 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Gamification
            </h3>
            {summary.xpAwarded !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">XP earned</span>
                <span className="font-medium text-slate-900">
                  +{summary.xpAwarded}
                </span>
              </div>
            )}
            {summary.dailyXp !== null && summary.currentStreak !== null && (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Daily XP</span>
                  <span className="font-medium text-slate-900">
                    {summary.dailyXp} / 10
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-success-600 h-2 rounded-full"
                    style={{
                      width: `${dailyProgress ?? 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Goal: 10 XP</span>
                  <span>
                    Streak: {summary.currentStreak} day(s)
                  </span>
                </div>
              </>
            )}
            {summary.goalCompleted !== null && summary.goalCompleted && (
              <p className="text-sm text-success-600 font-medium">
                🎯 Daily goal completed!
              </p>
            )}
          </div>
        ) : null}

        <Link
          to="/learning-path"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Back to learning path
        </Link>
      </div>
    </div>
  );
}
