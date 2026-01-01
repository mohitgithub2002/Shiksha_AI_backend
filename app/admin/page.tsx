'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalSchools: number;
  recentSchools: {
    last30Days: number;
    last7Days: number;
  };
  byState: Array<{ state: string | null; count: number }>;
  byCity: Array<{ city: string | null; count: number }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/schools/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-top">
          <div className="page-title-section">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome back! Here's what's happening with your schools.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 60, height: 28, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 100, height: 12 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card accent">
            <div className="stat-icon">🏫</div>
            <div className="stat-label">Total Schools</div>
            <div className="stat-value">{stats?.totalSchools || 0}</div>
            <div className="stat-change">All registered schools</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-label">This Month</div>
            <div className="stat-value">{stats?.recentSchools.last30Days || 0}</div>
            <div className="stat-change positive">New registrations</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-label">This Week</div>
            <div className="stat-value">{stats?.recentSchools.last7Days || 0}</div>
            <div className="stat-change">Last 7 days</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🗺️</div>
            <div className="stat-label">States Covered</div>
            <div className="stat-value">{stats?.byState?.length || 0}</div>
            <div className="stat-change">Geographic reach</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {/* Top States */}
        <div className="table-card">
          <div className="table-header">
            <h3 className="table-title">Schools by State</h3>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton skeleton-cell skeleton-cell-md" />
                  <div className="skeleton skeleton-cell skeleton-cell-sm" />
                </div>
              ))}
            </div>
          ) : stats?.byState && stats.byState.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th style={{ textAlign: 'right' }}>Schools</th>
                </tr>
              </thead>
              <tbody>
                {stats.byState.slice(0, 5).map((item, index) => (
                  <tr key={index}>
                    <td className="cell-primary">{item.state || 'Unknown'}</td>
                    <td className="text-right">
                      <span className="badge badge-info">{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p className="empty-description">No state data available yet</p>
            </div>
          )}
        </div>

        {/* Top Cities */}
        <div className="table-card">
          <div className="table-header">
            <h3 className="table-title">Schools by City</h3>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton skeleton-cell skeleton-cell-md" />
                  <div className="skeleton skeleton-cell skeleton-cell-sm" />
                </div>
              ))}
            </div>
          ) : stats?.byCity && stats.byCity.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th style={{ textAlign: 'right' }}>Schools</th>
                </tr>
              </thead>
              <tbody>
                {stats.byCity.slice(0, 5).map((item, index) => (
                  <tr key={index}>
                    <td className="cell-primary">{item.city || 'Unknown'}</td>
                    <td className="text-right">
                      <span className="badge badge-success">{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏙️</div>
              <p className="empty-description">No city data available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="table-card" style={{ marginTop: 24 }}>
        <div className="table-header">
          <h3 className="table-title">Quick Actions</h3>
        </div>
        <div style={{ padding: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="/admin/schools" className="btn btn-primary">
            <span>🏫</span> Manage Schools
          </a>
          <a href="/admin/schools" className="btn btn-secondary">
            <span>➕</span> Add New School
          </a>
        </div>
      </div>
    </div>
  );
}

