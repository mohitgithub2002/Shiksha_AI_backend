'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth/verify');
        const data = await response.json();
        if (data.success && data.data.authenticated) {
          router.replace('/admin');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.replace('/admin');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="login-page">
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Background Effects */}
      <div className="login-bg-effect login-bg-effect-1" />
      <div className="login-bg-effect login-bg-effect-2" />
      <div className="login-bg-effect login-bg-effect-3" />
      
      {/* Floating Education Icons */}
      <div className="floating-icons">
        <span className="floating-icon">📚</span>
        <span className="floating-icon">🎓</span>
        <span className="floating-icon">✏️</span>
        <span className="floating-icon">🏫</span>
        <span className="floating-icon">📖</span>
        <span className="floating-icon">🎯</span>
        <span className="floating-icon">💡</span>
        <span className="floating-icon">🔬</span>
        <span className="floating-icon">📐</span>
        <span className="floating-icon">🌟</span>
        <span className="floating-icon">📝</span>
        <span className="floating-icon">🧮</span>
      </div>
      
      {/* Glowing Orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />
      
      {/* Grid Decoration */}
      <div className="login-decoration">
        <div className="login-grid" />
      </div>
      
      <div className="login-container">
        {/* Login Card */}
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <span className="login-logo-icon">📚</span>
              <span className="login-logo-text">ShikshaAI</span>
            </div>
            <h1 className="login-title">Admin Portal</h1>
            <p className="login-subtitle">Sign in to access the admin dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <span className="login-error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="login-field">
              <label className="login-label" htmlFor="username">
                Username
              </label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">👤</span>
                <input
                  id="username"
                  type="text"
                  className="login-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="password">
                Password
              </label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">🔒</span>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <span className="login-button-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <span className="login-button-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Protected area. Authorized personnel only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

