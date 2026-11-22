
import { useAuthStore } from '../auth/authStore';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuthStore();

  if (!user) return null;

  // Use dailyXp instead of calculating from total XP.
  const todaysXp = user.dailyXp ?? 0;
  const dailyGoalXp = user.dailyGoalXp ?? 0;

  const dailyProgress =
    dailyGoalXp > 0
      ? Math.min((todaysXp / dailyGoalXp) * 100, 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user.name}!
        </h1>
        <p className="mt-1 text-slate-600">
          Ready to continue your French journey?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg text-primary-600">
              ✨
            </div>
            <div>
              <p className="text-sm text-slate-500">Total XP</p>
              <p className="text-2xl font-bold text-slate-900">
                {user.xpTotal}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning-100 rounded-lg text-warning-600">
              ♥
            </div>
            <div>
              <p className="text-sm text-slate-500">Hearts</p>
              <p className="text-2xl font-bold text-slate-900">
                {user.hearts}/5
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg text-primary-600">
              🔥
            </div>
            <div>
              <p className="text-sm text-slate-500">Streak</p>
              <p className="text-2xl font-bold text-slate-900">
                {user.streak} days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-success-100 rounded-lg text-success-600">
              🎯
            </div>
            <div>
              <p className="text-sm text-slate-500">Daily Goal</p>
              <p className="text-2xl font-bold text-slate-900">
                {dailyGoalXp} XP
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-900">
            Today's Progress
          </h2>
          <span className="text-sm text-slate-500">
            {todaysXp} / {dailyGoalXp} XP
          </span>
        </div>

        <div
          className="w-full bg-slate-200 rounded-full h-3"
          role="progressbar"
          aria-valuenow={todaysXp}
          aria-valuemin={0}
          aria-valuemax={dailyGoalXp}
          aria-label="Today's XP progress"
        >
          <div
            className="bg-primary-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          Continue Learning
        </h2>
        <Link
          to="/learning-path"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          View Learning Path
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" />
    </div>
  );
}
