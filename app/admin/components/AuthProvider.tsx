'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for login page
      if (pathname === '/admin/login') {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/auth/verify');
        const data = await response.json();

        if (data.success && data.data.authenticated) {
          setUser(data.data.user);
        } else {
          // Not authenticated, redirect to login
          router.replace('/admin/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.replace('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  const logout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      setUser(null);
      router.replace('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading state while checking auth
  if (loading && pathname !== '/admin/login') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0b0f',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid #2a2e38',
            borderTopColor: '#ff6b4a',
            borderRadius: '50%',
            animation: 'spin 800ms linear infinite',
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

