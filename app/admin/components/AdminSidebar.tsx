'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Don't render sidebar on login page
  if (pathname === '/admin/login') {
    return null;
  }

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">📚</span>
          <span className="logo-text">ShikshaAI</span>
        </div>
        <span className="logo-badge">Admin</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">Overview</span>
          <a
            href="/admin"
            className={`nav-link ${isActive('/admin') && pathname === '/admin' ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
        </div>

        <div className="nav-section">
          <span className="nav-section-title">Management</span>
          <a
            href="/admin/schools"
            className={`nav-link ${isActive('/admin/schools') ? 'active' : ''}`}
          >
            <span className="nav-icon">🏫</span>
            Schools
          </a>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.username || 'Admin User'}</span>
            <span className="user-role">Super Admin</span>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={logout}
          title="Sign out"
        >
          <span className="logout-icon">🚪</span>
          <span className="logout-text">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

