
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  targetLanguage: string;
  dailyGoalXp: number;
  dailyXp: number;
  timeZone: string;
  xpTotal: number;
  hearts: number;
  nextHeartAt: string | null;
  streak: number;
  onboardingCompletedAt: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isOnboarded: false,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isOnboarded: !!user.onboardingCompletedAt,
        }),

      // Update only the access token after successful refresh.
      setAccessToken: (accessToken) =>
        set({
          accessToken,
          isAuthenticated: true,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
          isOnboarded: state.user
            ? !!{ ...state.user, ...updates }.onboardingCompletedAt
            : false,
        })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isOnboarded: false,
        }),
    }),
    {
      name: 'frenchprep-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    },
  ),
);
