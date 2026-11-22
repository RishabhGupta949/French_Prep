import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../../api/client';
import { useAuthStore } from '../auth/authStore';

const onboardingSchema = z.object({
  targetLanguage: z.literal('fr'),
  dailyGoalXp: z.number().refine((v) => [10, 20, 30, 50].includes(v)),
  timeZone: z.string().min(1, 'Time zone is required'),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

const DAILY_GOALS = [
  { value: 10, label: 'Casual', description: '10 XP/day', subtitle: '5 min practice' },
  { value: 20, label: 'Regular', description: '20 XP/day', subtitle: '10 min practice' },
  { value: 30, label: 'Serious', description: '30 XP/day', subtitle: '15 min practice' },
  { value: 50, label: 'Intense', description: '50 XP/day', subtitle: '25 min practice' },
];

const COMMON_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedTimeZone, setDetectedTimeZone] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      targetLanguage: 'fr',
      dailyGoalXp: 20,
      timeZone: '',
    },
  });

  const selectedGoal = watch('dailyGoalXp');

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimeZone(tz);
      setValue('timeZone', tz, { shouldValidate: true });
    } catch {
      // Ignore if detection fails
    }
  }, [setValue]);

  const onSubmit = async (data: OnboardingForm) => {
    setError(null);
    setIsLoading(true);
    try {
      await api.patch('/me/onboarding', data);
      updateUser({
        targetLanguage: data.targetLanguage,
        dailyGoalXp: data.dailyGoalXp,
        timeZone: data.timeZone,
        onboardingCompletedAt: new Date().toISOString(),
      });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Set up your profile</h1>
        <p className="mt-2 text-slate-600">Customize your French learning experience</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <fieldset>
          <legend className="text-lg font-medium text-slate-900 mb-4">Target Language</legend>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🇫🇷</span>
              <div>
                <p className="font-medium text-slate-900">French</p>
                <p className="text-sm text-slate-500">English → French</p>
              </div>
            </div>
            <input type="hidden" {...register('targetLanguage')} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-medium text-slate-900 mb-4">Daily XP Goal</legend>
          <div className="grid grid-cols-2 gap-4">
            {DAILY_GOALS.map((goal) => (
              <button
                key={goal.value}
                type="button"
                onClick={() => setValue('dailyGoalXp', goal.value, { shouldValidate: true })}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  selectedGoal === goal.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-primary-300'
                }`}
                aria-pressed={selectedGoal === goal.value}
              >
                <input
                  type="radio"
                  {...register('dailyGoalXp')}
                  value={goal.value}
                  className="sr-only"
                />
                <div className="text-center">
                  <p className="font-medium text-slate-900">{goal.label}</p>
                  <p className="text-sm text-primary-600">{goal.description}</p>
                  <p className="text-xs text-slate-500">{goal.subtitle}</p>
                </div>
                {selectedGoal === goal.value && (
                  <div className="absolute inset-0 border-2 border-primary-500 rounded-xl pointer-events-none" />
                )}
              </button>
            ))}
          </div>
          {errors.dailyGoalXp && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.dailyGoalXp.message}</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-lg font-medium text-slate-900 mb-4">Time Zone</legend>
          <div className="relative">
            <select
              {...register('timeZone')}
              className={`w-full px-4 py-3 rounded-lg border appearance-none bg-white ${
                errors.timeZone ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500'
              } focus:ring-2 focus:ring-offset-0 transition-colors`}
              aria-invalid={errors.timeZone ? 'true' : 'false'}
            >
              <option value="">Select your time zone</option>
              {COMMON_TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {detectedTimeZone && (
            <p className="mt-2 text-sm text-slate-500">
              Detected: <strong>{detectedTimeZone}</strong>
            </p>
          )}
          {errors.timeZone && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.timeZone.message}</p>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Setting up...' : 'Start Learning'}
        </button>
      </form>
    </div>
  );
}