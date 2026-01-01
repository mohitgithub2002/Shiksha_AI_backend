'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface School {
  id: number;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  ownerName: string | null;
  contactEmail: string | null;
  contactPhone: string;
  hasPassword: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface FormData {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  ownerName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
}

const initialFormData: FormData = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  ownerName: '',
  contactEmail: '',
  contactPhone: '',
  password: '',
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [submitting, setSubmitting] = useState(false);
  
  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Debounce timer for code check
  const codeCheckTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);
      
      const response = await fetch(`/api/admin/schools?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSchools(data.data.schools);
        setPagination(data.data.pagination);
      } else {
        showToast('error', data.error || 'Failed to fetch schools');
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error);
      showToast('error', 'Failed to fetch schools');
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = (type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkCodeAvailability = async (code: string, excludeId?: number) => {
    if (!code || code.length < 2) {
      setCodeStatus('idle');
      return;
    }
    
    setCodeStatus('checking');
    
    try {
      const params = new URLSearchParams({ code });
      if (excludeId) params.set('excludeId', excludeId.toString());
      
      const response = await fetch(`/api/admin/schools/check-code?${params}`);
      const data = await response.json();
      
      if (data.success && data.data.available) {
        setCodeStatus('available');
      } else {
        setCodeStatus('unavailable');
      }
    } catch (error) {
      setCodeStatus('idle');
    }
  };

  const handleCodeChange = (code: string, excludeId?: number) => {
    setFormData((prev) => ({ ...prev, code }));
    
    if (codeCheckTimer.current) {
      clearTimeout(codeCheckTimer.current);
    }
    
    codeCheckTimer.current = setTimeout(() => {
      checkCodeAvailability(code, excludeId);
    }, 500);
  };

  const validateForm = (): boolean => {
    const errors: Partial<FormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'School name is required';
    }
    
    if (!formData.code.trim()) {
      errors.code = 'School code is required';
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.code)) {
      errors.code = 'Code can only contain letters, numbers, hyphens, and underscores';
    }
    
    if (!formData.contactPhone.trim()) {
      errors.contactPhone = 'Contact phone number is required';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.contactPhone)) {
      errors.contactPhone = 'Invalid phone format';
    }
    
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      errors.contactEmail = 'Invalid email format';
    }
    
    if (formData.pinCode && !/^[0-9]{5,10}$/.test(formData.pinCode)) {
      errors.pinCode = 'Pin code should be 5-10 digits';
    }
    
    if (formData.password && formData.password.length > 0 && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    if (codeStatus === 'unavailable') {
      showToast('error', 'Please use a unique school code');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('success', 'School created successfully');
        setShowCreateModal(false);
        setFormData(initialFormData);
        setCodeStatus('idle');
        fetchSchools();
      } else {
        showToast('error', data.error || 'Failed to create school');
      }
    } catch (error) {
      showToast('error', 'Failed to create school');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedSchool) return;
    if (!validateForm()) return;
    if (codeStatus === 'unavailable') {
      showToast('error', 'Please use a unique school code');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(`/api/admin/schools/${selectedSchool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('success', 'School updated successfully');
        setShowEditModal(false);
        setSelectedSchool(null);
        setFormData(initialFormData);
        setCodeStatus('idle');
        fetchSchools();
      } else {
        showToast('error', data.error || 'Failed to update school');
      }
    } catch (error) {
      showToast('error', 'Failed to update school');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSchool) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(`/api/admin/schools/${selectedSchool.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('success', 'School deleted successfully');
        setShowDeleteModal(false);
        setSelectedSchool(null);
        fetchSchools();
      } else {
        showToast('error', data.error || 'Failed to delete school');
      }
    } catch (error) {
      showToast('error', 'Failed to delete school');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (school: School) => {
    setSelectedSchool(school);
    setFormData({
      name: school.name,
      code: school.code,
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      pinCode: school.pinCode || '',
      ownerName: school.ownerName || '',
      contactEmail: school.contactEmail || '',
      contactPhone: school.contactPhone || '',
      password: '', // Don't prefill password - leave empty for updates
    });
    setCodeStatus('idle');
    setFormErrors({});
    setShowEditModal(true);
  };

  const openViewModal = (school: School) => {
    setSelectedSchool(school);
    setShowViewModal(true);
  };

  const openDeleteModal = (school: School) => {
    setSelectedSchool(school);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowViewModal(false);
    setSelectedSchool(null);
    setFormData(initialFormData);
    setFormErrors({});
    setCodeStatus('idle');
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-top">
          <div className="page-title-section">
            <h1 className="page-title">Schools</h1>
            <p className="page-subtitle">Manage all registered schools in the ShikshaAI platform</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormData(initialFormData);
              setFormErrors({});
              setCodeStatus('idle');
              setShowCreateModal(true);
            }}
          >
            <span>➕</span> Add School
          </button>
        </div>
      </div>

      {/* Schools Table */}
      <div className="table-card">
        <div className="table-header">
          <h3 className="table-title">All Schools ({pagination?.totalCount || 0})</h3>
          <div className="table-actions">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-cell skeleton-cell-lg" />
                <div className="skeleton skeleton-cell skeleton-cell-sm" />
                <div className="skeleton skeleton-cell skeleton-cell-md" />
                <div className="skeleton skeleton-cell skeleton-cell-md" />
                <div className="skeleton skeleton-cell skeleton-cell-sm" />
              </div>
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏫</div>
            <h3 className="empty-title">No Schools Found</h3>
            <p className="empty-description">
              {search
                ? `No schools match your search "${search}"`
                : 'Get started by adding your first school to the platform.'}
            </p>
            {!search && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <span>➕</span> Add First School
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('name')}
                  >
                    School Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('code')}
                  >
                    Code {sortBy === 'code' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('city')}
                  >
                    Location {sortBy === 'city' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Contact</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('createdAt')}
                  >
                    Added {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td>
                      <div className="cell-primary">{school.name}</div>
                      {school.ownerName && (
                        <div className="cell-muted">Owner: {school.ownerName}</div>
                      )}
                    </td>
                    <td>
                      <span className="cell-code">{school.code}</span>
                    </td>
                    <td>
                      <div className="cell-secondary">
                        {school.city && school.state
                          ? `${school.city}, ${school.state}`
                          : school.city || school.state || '—'}
                      </div>
                      {school.pinCode && <div className="cell-muted">{school.pinCode}</div>}
                    </td>
                    <td>
                      {school.contactEmail || school.contactPhone ? (
                        <>
                          {school.contactEmail && (
                            <div className="cell-secondary">{school.contactEmail}</div>
                          )}
                          {school.contactPhone && (
                            <div className="cell-muted">{school.contactPhone}</div>
                          )}
                        </>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td className="cell-muted">{formatDate(school.createdAt)}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => openViewModal(school)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => openEditModal(school)}
                          title="Edit School"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => openDeleteModal(school)}
                          title="Delete School"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="table-footer">
                <div className="pagination-info">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                  {pagination.totalCount} schools
                </div>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    ««
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    «
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${pagination.page === pageNum ? 'active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="pagination-btn"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    »
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {showCreateModal ? 'Add New School' : 'Edit School'}
              </h2>
              <button className="modal-close" onClick={closeModals}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  School Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'error' : ''}`}
                  placeholder="Enter school name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
                {formErrors.name && <div className="form-error">{formErrors.name}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  School Code <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.code ? 'error' : ''} ${
                    codeStatus === 'available' ? 'success' : ''
                  }`}
                  placeholder="Enter unique code (e.g., DPS-DELHI-01)"
                  value={formData.code}
                  onChange={(e) =>
                    handleCodeChange(e.target.value.toUpperCase(), selectedSchool?.id)
                  }
                />
                {formErrors.code && <div className="form-error">{formErrors.code}</div>}
                {!formErrors.code && codeStatus !== 'idle' && (
                  <div className={`code-check ${codeStatus}`}>
                    {codeStatus === 'checking' && (
                      <>
                        <span className="code-check-spinner" />
                        <span>Checking availability...</span>
                      </>
                    )}
                    {codeStatus === 'available' && (
                      <>
                        <span>✓</span>
                        <span>Code is available</span>
                      </>
                    )}
                    {codeStatus === 'unavailable' && (
                      <>
                        <span>✗</span>
                        <span>Code is already in use</span>
                      </>
                    )}
                  </div>
                )}
                <div className="form-hint">
                  Unique identifier for the school (letters, numbers, hyphens, underscores only)
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Owner Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter owner/principal name"
                  value={formData.ownerName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ownerName: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className={`form-input ${formErrors.contactEmail ? 'error' : ''}`}
                    placeholder="school@example.com"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                  />
                  {formErrors.contactEmail && (
                    <div className="form-error">{formErrors.contactEmail}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Contact Phone <span className="required">*</span>
                  </label>
                  <input
                    type="tel"
                    className={`form-input ${formErrors.contactPhone ? 'error' : ''}`}
                    placeholder="+91 XXXXX XXXXX"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))
                    }
                  />
                  {formErrors.contactPhone && (
                    <div className="form-error">{formErrors.contactPhone}</div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password {showEditModal && selectedSchool?.hasPassword && <span className="form-hint-inline">(leave empty to keep current)</span>}
                </label>
                <input
                  type="password"
                  className={`form-input ${formErrors.password ? 'error' : ''}`}
                  placeholder={showEditModal ? 'Enter new password (optional)' : 'Set password for school owner login'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
                {formErrors.password && (
                  <div className="form-error">{formErrors.password}</div>
                )}
                <div className="form-hint">
                  Password for school owner to login (minimum 6 characters)
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Enter full address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter city"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter state"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">PIN Code</label>
                <input
                  type="text"
                  className={`form-input ${formErrors.pinCode ? 'error' : ''}`}
                  placeholder="Enter PIN code"
                  value={formData.pinCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pinCode: e.target.value }))}
                  style={{ maxWidth: 200 }}
                />
                {formErrors.pinCode && <div className="form-error">{formErrors.pinCode}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModals} disabled={submitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={showCreateModal ? handleCreate : handleUpdate}
                disabled={submitting || codeStatus === 'checking'}
              >
                {submitting ? (
                  <>
                    <span className="code-check-spinner" />
                    {showCreateModal ? 'Creating...' : 'Saving...'}
                  </>
                ) : showCreateModal ? (
                  'Create School'
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedSchool && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">School Details</h2>
              <button className="modal-close" onClick={closeModals}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: 'var(--admin-accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}
                  >
                    🏫
                  </div>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                      {selectedSchool.name}
                    </h3>
                    <span className="cell-code">{selectedSchool.code}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                {selectedSchool.ownerName && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>
                      Owner/Principal
                    </div>
                    <div>{selectedSchool.ownerName}</div>
                  </div>
                )}

                {(selectedSchool.contactEmail || selectedSchool.contactPhone) && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>
                      Contact Information
                    </div>
                    {selectedSchool.contactEmail && <div>{selectedSchool.contactEmail}</div>}
                    {selectedSchool.contactPhone && (
                      <div className="text-muted">{selectedSchool.contactPhone}</div>
                    )}
                  </div>
                )}

                {selectedSchool.address && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>
                      Address
                    </div>
                    <div>{selectedSchool.address}</div>
                  </div>
                )}

                {(selectedSchool.city || selectedSchool.state || selectedSchool.pinCode) && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>
                      Location
                    </div>
                    <div>
                      {[selectedSchool.city, selectedSchool.state, selectedSchool.pinCode]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                )}

                <div>
                  <div className="form-label" style={{ marginBottom: 4 }}>
                    Login Access
                  </div>
                  <div>
                    {selectedSchool.hasPassword ? (
                      <span className="badge badge-success">✓ Password Set</span>
                    ) : (
                      <span className="badge badge-warning">No Password</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="form-label" style={{ marginBottom: 4 }}>
                    Registered On
                  </div>
                  <div>{formatDate(selectedSchool.createdAt)}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModals}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeModals();
                  openEditModal(selectedSchool);
                }}
              >
                Edit School
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSchool && (
        <div className="modal-overlay" onClick={closeModals}>
          <div
            className="modal"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Delete School</h2>
              <button className="modal-close" onClick={closeModals}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--admin-error-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: 28,
                }}
              >
                ⚠️
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                Are you sure you want to delete this school?
              </h3>
              <p className="text-muted" style={{ marginBottom: 8 }}>
                <strong>{selectedSchool.name}</strong> ({selectedSchool.code})
              </p>
              <p className="text-muted" style={{ fontSize: 13 }}>
                This action cannot be undone. All associated data will be permanently removed.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={closeModals} disabled={submitting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="code-check-spinner" />
                    Deleting...
                  </>
                ) : (
                  'Delete School'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✗'}
              {toast.type === 'warning' && '⚠'}
            </span>
            <div className="toast-content">
              <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

