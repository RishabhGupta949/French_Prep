import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../../api/client';
import { useAuthStore } from './authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post<{ user: any; accessToken: string }>('/auth/login', data);
      setAuth(response.user, response.accessToken);
      navigate(response.user.onboardingCompletedAt ? '/dashboard' : '/onboarding');
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
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Welcome back</h1>
        <p className="text-center text-slate-500 mb-8">Sign in to continue learning French</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500'
              } focus:ring-2 focus:ring-offset-0 transition-colors`}
              placeholder="you@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="current-password"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500'
              } focus:ring-2 focus:ring-offset-0 transition-colors`}
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}