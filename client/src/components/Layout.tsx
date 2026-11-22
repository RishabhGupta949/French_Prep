import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { api } from '../api/client';

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const navigation = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/learning-path', label: 'Learn' },
  ];

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore errors
    }
    logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="text-xl font-bold text-primary-600">
                FrenchPrep
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                {navigation.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'text-primary-600'
                        : 'text-slate-600 hover:text-primary-600'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-warning-500">♥</span>
                    <span>{user.hearts}/5</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-warning-500">✨</span>
                    <span>{user.xpTotal} XP</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-primary-500">🔥</span>
                    <span>{user.streak} day streak</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}