import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const pollIntervalRef = useRef(null);

  // 1. Detect tokens returned from GitHub OAuth sequence in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 2. Decode user session details from JWT token
  useEffect(() => {
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        setUser(JSON.parse(jsonPayload));
      } catch (err) {
        console.error('Invalid JWT token:', err);
        handleLogout();
      }
    }
  }, [token]);

  // 3. Fetch Event log lists from backend (supporting query filtering by repo)
  const fetchEventsList = async (showSpinner = false, targetRepo = selectedRepo) => {
    if (!token) return;
    if (showSpinner) setFetching(true);
    
    try {
      const url = targetRepo
        ? `${API_URL}/api/events?repo=${encodeURIComponent(targetRepo)}`
        : `${API_URL}/api/events`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setEvents(response.data);

      // Populate the dropdown list dynamically from unique repository names
      if (!targetRepo) {
        const uniqueRepos = [...new Set(response.data.map((event) => event.repo_name))].filter(Boolean);
        setRepos(uniqueRepos);
      }
    } catch (err) {
      console.error('Failed to retrieve event logs:', err.message);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      if (showSpinner) setFetching(false);
    }
  };

  // 4. Setup polling mechanism for live updates
  useEffect(() => {
    if (token) {
      // First fetch
      fetchEventsList(true);

      // Start interval polling every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        fetchEventsList(false);
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [token, selectedRepo]);

  const handleRepoChange = (e) => {
    const nextRepo = e.target.value;
    setSelectedRepo(nextRepo);
    fetchEventsList(true, nextRepo);
  };

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${API_URL}/auth/github`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setEvents([]);
    setSelectedEvent(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  // Parse helper for payload summary info
  const parsePayloadInfo = (event) => {
    let repo = 'N/A';
    let summary = event.activitySummary || 'Webhook activity logged';
    
    try {
      const parsed = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
      repo = parsed.repository?.full_name || 'N/A';
      
      if (!event.activitySummary) {
        if (event.event_type === 'issues') {
          summary = `${parsed.action || 'updated'} issue: "${parsed.issue?.title || ''}"`;
        } else if (event.event_type === 'pull_request') {
          summary = `${parsed.action || 'updated'} PR: "${parsed.pull_request?.title || ''}"`;
        } else {
          summary = `${event.event_type} event triggered`;
        }
      }
    } catch (e) {
      if (!event.activitySummary) summary = 'Invalid JSON body';
    }

    return { repo, summary };
  };

  // Statistics calculation helpers
  const totalCount = events.length;
  const processedCount = events.filter((e) => e.status === 'processed').length;
  const failedCount = events.filter((e) => e.status === 'failed').length;

  // Format creation timestamp helper
  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="app-container">
      {token && user ? (
        /* Authenticated Dashboard View */
        <>
          <nav className="navbar">
            <div className="brand-section">
              <div className="logo-dot"></div>
              <span className="brand-title">GitSync console</span>
            </div>
            <div className="user-badge">
              <span className="username-display">@{user.username}</span>
              <button className="btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </nav>

          <main className="dashboard-content">
            <div>
              <h2 className="section-title" style={{ marginBottom: '8px' }}>Integrations Dashboard</h2>
              <p style={{ color: 'var(--primary-muted)', fontSize: '0.9rem' }}>
                Monitor webhook events, verify signatures, and analyze delivery states.
              </p>
            </div>

            {/* Statistics Row */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-header">Total Logs</span>
                <span className="stat-number">{totalCount}</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(48, 209, 88, 0.15)' }}>
                <span className="stat-header" style={{ color: 'var(--status-processed-text)' }}>Processed</span>
                <span className="stat-number" style={{ color: 'var(--status-processed-text)' }}>{processedCount}</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(255, 69, 58, 0.15)' }}>
                <span className="stat-header" style={{ color: 'var(--status-failed-text)' }}>Failed</span>
                <span className="stat-number" style={{ color: 'var(--status-failed-text)' }}>{failedCount}</span>
              </div>
            </div>

            {/* Webhook Logs Feed */}
            <div className="table-panel">
              <div className="table-header-bar">
                <span className="table-title">Webhook Deliveries</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select
                    value={selectedRepo}
                    onChange={handleRepoChange}
                    disabled={fetching}
                    style={{
                      background: 'var(--bg-surface)',
                      color: '#ffffff',
                      border: '1px solid var(--border-dim)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Repositories</option>
                    {repos.map((repo) => (
                      <option key={repo} value={repo}>
                        {repo}
                      </option>
                    ))}
                  </select>
                  <button className="refresh-button" onClick={() => fetchEventsList(true)} disabled={fetching}>
                    {fetching ? 'Syncing...' : 'Sync Feed'}
                  </button>
                </div>
              </div>

              {events.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Repo</th>
                      <th>Activity Summary</th>
                      <th>Delivery ID</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => {
                      const { repo, summary } = parsePayloadInfo(event);
                      
                      // Match visual badges based on issue vs. PR vs other
                      const iconClass =
                        event.event_type === 'issues'
                          ? 'icon-issues'
                          : event.event_type === 'pull_request'
                          ? 'icon-pr'
                          : 'icon-other';

                      return (
                        <tr key={event.id} onClick={() => setSelectedEvent(event)}>
                          <td>
                            <div className="event-type-container">
                              <span className={`event-icon ${iconClass}`}>{event.event_type}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '500' }}>{repo}</span>
                          </td>
                          <td style={{ color: 'var(--primary-muted)' }}>{summary}</td>
                          <td>
                            <span className="id-pill">{event.github_delivery_id.slice(0, 8)}</span>
                          </td>
                          <td>
                            <span className={`status-badge status-${event.status}`}>
                              {event.status}
                            </span>
                          </td>
                          <td>
                            <span className="timestamp">{formatTime(event.created_at)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">🔌</span>
                  No Webhook events captured yet. Make a push or trigger an issue on your repo.
                </div>
              )}
            </div>
          </main>

          {/* Payload Inspector Side Drawer */}
          {selectedEvent && (
            <div className="drawer-overlay" onClick={() => setSelectedEvent(null)}>
              <div className="drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <span className="drawer-title">Webhook Payload Inspector</span>
                  <button className="drawer-close" onClick={() => setSelectedEvent(null)}>
                    &times;
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-meta-grid">
                    <span className="drawer-meta-label">Event Type:</span>
                    <span>
                      <span className={`event-icon icon-${selectedEvent.event_type === 'issues' ? 'issues' : selectedEvent.event_type === 'pull_request' ? 'pr' : 'other'}`}>
                        {selectedEvent.event_type}
                      </span>
                    </span>

                    <span className="drawer-meta-label">Delivery ID:</span>
                    <span className="monospace">{selectedEvent.github_delivery_id}</span>

                    <span className="drawer-meta-label">Logged At:</span>
                    <span className="monospace">{new Date(selectedEvent.created_at).toLocaleString()}</span>

                    <span className="drawer-meta-label">Processing Status:</span>
                    <span>
                      <span className={`status-badge status-${selectedEvent.status}`}>
                        {selectedEvent.status}
                      </span>
                    </span>
                  </div>

                  <span className="drawer-meta-label" style={{ marginTop: '12px', display: 'block' }}>
                    Raw JSON Event Payload:
                  </span>
                  
                  <div className="payload-container">
                    <pre>
                      <code>
                        {(() => {
                          try {
                            const parsed = typeof selectedEvent.payload === 'string'
                              ? JSON.parse(selectedEvent.payload)
                              : selectedEvent.payload;
                            return JSON.stringify(parsed, null, 2);
                          } catch (e) {
                            return typeof selectedEvent.payload === 'string'
                              ? selectedEvent.payload
                              : JSON.stringify(selectedEvent.payload, null, 2);
                          }
                        })()}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Guest / Login View */
        <div style={{ display: 'flex', alignItems: 'center', justifyCenter: 'center', height: '100vh', margin: '0 auto' }}>
          <div className="login-card">
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>⚡</span>
            <h1 className="brand-title" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>GitSync</h1>
            <p style={{ color: 'var(--primary-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>
              Connect GitHub hooks, dispatch alerts to Slack, and examine logs inside a dark theme dashboard.
            </p>
            <button 
              className="btn btn-github" 
              onClick={handleLogin} 
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#ffffff',
                color: '#000000',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.95rem'
              }}
            >
              {loading ? 'Redirecting...' : 'Login with GitHub'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
